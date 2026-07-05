# Cookies & Deployment

How auth cookies are configured across local development and production, and a step-by-step
guide for deploying to Vercel. Verified against a real deployment on 2026-07-04
(`restack-pattern-backend.vercel.app` + `restack-pattern-frontend.vercel.app`, Postgres via
Vercel's Neon integration).

## No server-side auth gate — client-side check everywhere

Unlike a typical Next.js template, there is **no `middleware.ts`/`proxy.ts`**. Protected pages
check auth client-side instead — `frontend/domains/user/hooks/use-profile.ts` and
`frontend/components/require-auth.tsx` both call `GET /api/user/me` on mount and redirect
to `/login` on failure. This is deliberate (see `CLAUDE.md`'s Next.js 16 caveat): a server-side
cookie-presence check cannot work once frontend and backend are on different domains (the normal
case in production — see below), so rather than maintain two different behaviors for two
deployment shapes, the same client-side check is used in both. Trade-off: pages render first,
then redirect if the session check fails, instead of an instant SSR redirect.

## Local development — cookies just work, here's why

Running `pnpm --filter backend dev` (port 3001) and `pnpm --filter frontend dev` (port 3000),
you don't need to touch `COOKIE_SAME_SITE` or `COOKIE_DOMAIN` at all. Two things make this work
without configuration:

1. **`localhost` ignores port for cookie matching.** A cookie set by the backend for `localhost`
   (host-only, no explicit `Domain`) is visible to the frontend's `localhost:3000` too, because
   browsers scope cookies by *hostname*, not by port. `api.example.com` and `app.example.com` in
   production are a completely different situation (different hostnames) — this "it just works"
   behavior is specific to `localhost`.
2. **`NODE_ENV=development` picks safe defaults.** In `backend/src/domains/auth/auth.routes.ts`:
   `sameSite` defaults to `Lax` and `secure` to `false` whenever `NODE_ENV` isn't `production`.
   `Lax` is sent on top-level navigation and — combined with point 1 — on API calls between
   `localhost:3000` and `localhost:3001` too, since they're the same site. `secure: false` matters
   because local dev is plain HTTP, and a `Secure` cookie is silently dropped over HTTP.

If login doesn't seem to persist in dev, the near-universal cause is `backend/.env`'s
`FRONTEND_URL` not matching the URL you're actually loading the frontend from (CORS/CSRF checks
the `Origin` header against it) — not a cookie attribute problem. Leave `COOKIE_SAME_SITE` and
`COOKIE_DOMAIN` commented out in dev; they're production-only knobs.

## Production — two scenarios

### Scenario A: frontend and backend share an apex domain (recommended)

E.g. `app.example.com` (frontend) + `api.example.com` (backend), both under `example.com` that
you own and can point DNS for.

1. Set `COOKIE_DOMAIN=.example.com` on the backend.
2. Set `FRONTEND_URL=https://app.example.com` on the backend.
3. Set `NEXT_PUBLIC_API_URL=https://api.example.com` on the frontend.
4. Leave `COOKIE_SAME_SITE` unset — defaults to `None` in production, and `Secure` is forced
   whenever `SameSite=None`, which is fine since both subdomains are HTTPS.

**Verify**: log in, check the login response's `Set-Cookie` headers in DevTools' Network tab —
both `access_token` and `refresh_token` should show `Domain=.example.com`.

### Scenario B: frontend and backend on unrelated domains (default, zero setup)

E.g. default `*.vercel.app` project URLs — `vercel.app` is a public suffix, so two different
projects on it are different registrable domains even though they look similar. Same situation
as, say, a Vercel frontend + a Railway backend on `*.up.railway.app`.

1. Do **not** set `COOKIE_DOMAIN` — a cross-domain `Domain` attribute would be rejected by the
   browser anyway, so there's nothing to configure.
2. Set `FRONTEND_URL` / `NEXT_PUBLIC_API_URL` to each app's own domain, as normal.
3. That's it — no other difference from Scenario A. The client-side auth check
   (`fetch(..., {credentials: "include"})`) works across unrelated domains exactly the same way,
   as long as `SameSite=None; Secure` is set (which it is, automatically, in production). The
   only reason Scenario A exists at all is cosmetic — one clean domain instead of two unrelated
   `*.vercel.app` URLs.

This is the scenario actually exercised end to end on 2026-07-04 — see "Verified" below.

## Deploying to Vercel, step by step

Backend and frontend deploy as **two separate Vercel projects** from this one repo.

**1. Push the database schema** — point `backend/.env`'s `DATABASE_URL` at your production
Postgres and run `pnpm --filter backend db:push` (creates `users` / `auth_sessions`). Do this
*before* the first deploy: `env.ts` validates `DATABASE_URL` eagerly at cold start, so every
request 500s without a working connection, not just the DB-dependent ones.

**2. Create the two projects**, each pointing at this repo with `rootDirectory` set to `backend`
or `frontend` — this is what lets each project's build see the whole monorepo (needed for
`packages/shared`) while still treating its own subfolder as the app root.

```bash
vercel project add restack-pattern-backend
vercel project add restack-pattern-frontend
```

**3. Backend** — `backend/vercel.json` already ships correctly configured:

```json
{
  "framework": null,
  "installCommand": "pnpm install && pnpm --filter @restack/shared build",
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

Three things this avoids, if you're ever tempted to "simplify" it:
- **`framework: null` is required.** Vercel auto-detects Hono by looking for an
  `app`/`index`/`server` file in the project root or `src/` — that's why the entrypoint is
  `backend/src/hono-app.ts`, not `app.ts`. Without `framework: null`, Vercel can pick that file
  up directly as the function and ignore `backend/api/index.ts` entirely, producing a cryptic
  "Invalid export found in module" 500.
- **`backend/public/.gitkeep` must exist.** With `framework: null` and no static build output,
  Vercel still requires an `outputDirectory` (default `public`) to exist, even for an API-only
  project with zero static assets.
- **Build `@restack/shared` in `installCommand`, not `buildCommand`.** Any top-level
  `buildCommand` tells Vercel "this project produces static output," re-triggering the
  `outputDirectory` requirement above. `installCommand` doesn't have that side effect.

Env vars (Production): `DATABASE_URL`, `JWT_SECRET` (32+ chars, generate your own), `NODE_ENV=production`,
`FRONTEND_URL` (the frontend project's URL). Deploy from the **repo root**, not `--cwd backend`,
so the pnpm workspace is included:

```bash
vercel deploy --cwd . --project restack-pattern-backend --yes --prod
```

**4. Frontend** — env var `NEXT_PUBLIC_API_URL` = the backend project's URL, set *before* the
build (`NEXT_PUBLIC_*` vars are baked in at build time). Deploy the same way:

```bash
vercel deploy --cwd . --project restack-pattern-frontend --yes --prod
```

**5. Smoke test** — `curl https://<backend>.vercel.app/` should return `{"status":"ok"}`. In a
browser: register, confirm you land on `/dashboard`, click through to `/profile`. To confirm the
refresh flow specifically: DevTools → Application → Cookies → delete just `access_token` (leave
`refresh_token`) → reload — it should still work (401 on the first `/api/user/me` triggers an
automatic `/api/auth/refresh`, then the original request retries with the new token).

## Verified: Scenario B, Vercel + Vercel + Neon (2026-07-04)

Confirmed via curl (Origin header set to the frontend's domain, simulating a real cross-origin
browser fetch) and by manually testing in a real browser:
- Register sets `access_token`/`refresh_token` with `SameSite=None; Secure; HttpOnly`, host-only
  (no `Domain` attribute) — exactly as expected with `COOKIE_DOMAIN` unset.
- `GET /api/user/me` with the access_token cookie: 200. Without it: 401.
- `POST /api/auth/refresh` with only the refresh_token cookie: 200, issues a **new** rotated
  refresh_token (confirms single-use rotation) and a new access_token.
- Retrying `GET /api/user/me` with the new access_token: 200.
- In-browser: deleting only `access_token` and reloading `/profile` correctly triggers the
  automatic refresh and the page keeps working, with no re-login required.

Not yet verified: Scenario A (same apex domain) — everything above is Scenario B only.
