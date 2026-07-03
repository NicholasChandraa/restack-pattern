# Deployment Verification — Cross-Domain Cookies

This is the checklist for actually proving auth cookies survive a real frontend/backend split
deployment. **Nobody has run through this against a live deployment yet** — it's written so
whoever does the first real deploy has a concrete list instead of finding out via a broken login.

## The hard constraint (read this first)

Cookies can only be shared across **subdomains of the same registrable domain** — e.g.
`app.example.com` and `api.example.com` share `example.com`, so a cookie can be scoped to
`.example.com` and both will see it. There is **no way** to share a cookie between two
genuinely unrelated domains (e.g. `myapp.vercel.app` and `myapp.up.railway.app`) — that's a
browser platform rule (the `Domain` cookie attribute only accepts the current or a parent
registrable domain), not something any app-level config can work around.

This matters specifically for `frontend/proxy.ts`: it runs on the frontend's own server and can
only see cookies the browser sends *to the frontend's domain*. If the backend is on a fully
unrelated domain, `proxy.ts` will never see `access_token`/`refresh_token`, no matter how
`SameSite`/`Secure` are configured — it will redirect every request to `/login` even for
genuinely logged-in users.

## Deployment Topology A — same apex domain (recommended)

Frontend at `app.example.com`, backend at `api.example.com`. Requires owning `example.com` and
pointing both subdomains at Vercel/Railway respectively.

1. Set `COOKIE_DOMAIN=.example.com` on the backend (added in `backend/src/config/env.ts` /
   used in `backend/src/domains/auth/auth.routes.ts`).
2. Set `FRONTEND_URL=https://app.example.com` on the backend.
3. Set `NEXT_PUBLIC_API_URL=https://api.example.com` on the frontend.
4. `COOKIE_SAME_SITE` can stay unset (defaults to `None` in production) since `Secure` is
   forced whenever `SameSite=None` — both subdomains will be HTTPS.
5. **Verify**: log in on `https://app.example.com`, check the Network tab's response headers on
   the login request. Both `access_token` and `refresh_token` should carry `Domain=.example.com`
   — that's what makes them visible to `app.example.com` too, not just `api.example.com`.
6. **Verify**: reload `https://app.example.com/dashboard` directly (fresh SSR request, not a
   client navigation) — `proxy.ts` should let it through without redirecting to `/login`.
7. **Verify**: wait 16+ minutes (past the 15m access-token TTL), then hit any page — you should
   stay logged in (refresh happens transparently on the first API 401), not get bounced to
   `/login`.

## Deployment Topology B — fully separate domains (e.g. default `*.vercel.app` + `*.up.railway.app`)

This is what you get with zero custom-domain setup. It's supported for **API calls** (the
browser will still send cookies cross-site to the backend on `fetch(..., {credentials:
"include"})`, since that's exactly what `SameSite=None; Secure` is for) but `proxy.ts`'s
SSR-side guard is blind here — see the constraint above.

1. Do **not** set `COOKIE_DOMAIN` (leave it unset — a cross-domain `Domain` attribute would be
   rejected by the browser anyway).
2. Set `FRONTEND_URL` / `NEXT_PUBLIC_API_URL` as normal (their own distinct domains).
3. Expect `proxy.ts` to redirect logged-in users to `/login` on every fresh page load, because
   it cannot see the backend's cookies. The actual API calls from client components will still
   work (login, `/api/user/me`, etc.) since those go directly browser → backend.
4. If you need real protected-route UX on this topology, the fix is architectural, not
   config: stop relying on `proxy.ts` for the auth redirect, and instead gate protected pages
   client-side — call `GET /api/user/me` on mount and redirect to `/login` on a 401. This
   trades the SSR-instant redirect for one that happens after first paint, but it's the only
   approach that actually works when there's no shared domain to put cookies on.

## What "done" looks like

This doc is done being useful once someone has actually run steps 5–7 above against a real
Topology A deployment (or implemented the Topology B fallback and verified *that*) and can
update `docs/concerns.md`'s Phase 1 roadmap item ("verify cookies work in prod") to `[x]` with
the real domain/platform combination that was tested.
