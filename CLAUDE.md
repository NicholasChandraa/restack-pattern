# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# RestackPattern

CLI scaffolding tool (in progress): `npx create-restack-pattern` — generates a full-stack monorepo with Next.js + Hono + Drizzle ORM using Semi-DDD (Feature-Driven) architecture. Right now this repo *is* the master template being hand-built (Phase 1); it isn't wrapped into a CLI yet.

## Monorepo Structure

```
restack-pattern/
├── frontend/          # Next.js 16 (App Router) — deploy to any static host
├── backend/           # Hono + Drizzle ORM — deploy to any Node.js host
├── packages/shared/   # Zod schemas — single source of truth, imported by FE and BE
└── docs/              # Planning & architecture docs (concerns.md tracks open decisions)
```

**Package manager:** pnpm workspaces (root `pnpm-workspace.yaml` lists `frontend`, `backend`, `packages/*`). Run all commands via `pnpm --filter <name>` from the repo root.

## Commands

```bash
pnpm --filter backend dev              # Backend on http://localhost:3001 (tsx watch)
pnpm --filter frontend dev             # Frontend on http://localhost:3000
pnpm --filter frontend lint            # ESLint (frontend only — backend/shared have no lint script)
pnpm --filter backend build            # tsc → backend/dist
pnpm --filter frontend build           # next build
pnpm --filter @restack/shared build    # tsc → packages/shared/dist (see gotcha below)

pnpm --filter backend db:push          # Push schema to DB (dev)
pnpm --filter backend db:generate      # Generate Drizzle migration files
pnpm --filter backend db:studio        # Open Drizzle Studio
```

```bash
pnpm --filter backend test             # Vitest — unit tests (mocked repos) + integration tests against local Postgres
```

Frontend has no test suite yet. Backend integration tests (`user.routes.test.ts`) hit the real local dev DB and clean up after themselves — make sure `DATABASE_URL` in `backend/.env` points at a disposable dev database before running them.

**Gotcha — `packages/shared` must be built, not just edited.** `@restack/shared`'s `package.json` points `main`/`types` at `dist/`, and `dist/` is gitignored. Backend and frontend both resolve imports from `@restack/shared` to that compiled output, not the TS source. After editing anything in `packages/shared/src`, run `pnpm --filter @restack/shared build` (or keep `pnpm --filter @restack/shared dev` running, which is `tsc --watch`) or the other packages will use stale types/values — or fail to resolve the import at all on a fresh clone before the first build. The root `pnpm dev` / `pnpm build` scripts (`pnpm --parallel dev|build`) run all three packages concurrently with no topological ordering, so on first-time setup prefer building `@restack/shared` once before starting backend/frontend.

## Architecture: Semi-DDD

Code is grouped by **business feature (domain)**, not file type.

### Backend (`backend/src/domains/[feature]/`)
| File | Responsibility |
|------|----------------|
| `.routes.ts` | HTTP endpoints + input validation (Zod, via `@hono/zod-validator`) |
| `.service.ts` | Business logic only — never touches DB directly |
| `.repo.ts` | Drizzle queries only — no business logic |
| `.model.ts` | Drizzle table definitions |

Note: `.schema.ts` is **not** duplicated per-domain in the backend. Zod schemas live directly in `packages/shared/src/schemas/[feature].schema.ts` and are imported back into the backend via `@restack/shared` (see `auth.routes.ts`, `auth.service.ts`). `docs/structure-pattern-planning..md` describes schemas as backend-owned and re-exported to shared — that was the original plan, not the current code. Treat `packages/shared` as the actual source of truth.

### Frontend (`frontend/domains/[feature]/`)
| Folder | Responsibility |
|--------|----------------|
| `components/` | UI only — no data fetching |
| `hooks/` | State + data fetching logic |
| `services/` | HTTP calls to backend only (thin wrappers around `frontend/shared/lib/api-client.ts`) |
| `types.ts` | Local type definitions |

`frontend/app/` is **routing only** — pages just render domain components, nothing else. `frontend/shared/` holds cross-domain reusables; Shadcn UI atoms live in `frontend/components/ui/` per `components.json`, not under `shared/`.

**Cross-domain rule:** `auth` domain may import from `user` domain (e.g. `usersTable` from `user.model.ts`). Reverse is not allowed.

## Next.js 16 caveat

`frontend` runs Next.js 16 (`next@16.2.9`), which has breaking changes vs. older Next.js versions and vs. training data. `frontend/AGENTS.md` (auto-loaded) instructs checking `node_modules/next/dist/docs/` before writing Next.js code. One concrete instance already in this repo: **`middleware.ts` has been renamed to `proxy.ts`** (`frontend/proxy.ts`, exporting a `proxy()` function with the same `config.matcher` shape old middleware used) — don't recreate a `middleware.ts` file expecting it to run.

`frontend/proxy.ts` checks whether an `access_token` **or** `refresh_token` cookie is *present* for non-public paths — it does not verify the JWT (that's intentional: `access_token` is short-lived, so presence-only lets an expired-but-refreshable session through instead of bouncing to `/login`). This is safe because the backend now enforces real verification separately: `backend/src/shared/middlewares/require-auth.ts` reads `access_token`, calls `authService.verifyAccessToken`, and 401s on failure — apply it to any route that needs to be actually protected (see `user.routes.ts` for the pattern: `userRoutes.get("/me", requireAuth, ...)`).

**Cross-domain deploys:** cookies can only be shared across subdomains of the same registrable domain — never across genuinely unrelated domains (e.g. default `*.vercel.app` + `*.up.railway.app`). If FE/BE don't share an apex domain, `frontend/proxy.ts` can never see the backend's cookies, no matter the cookie config — this is a browser platform constraint, not a bug to fix here. See `docs/deployment-verification.md` before deploying to prod.

## Key decisions

**Auth cookies:** Adaptive based on `NODE_ENV`, computed in `backend/src/domains/auth/auth.routes.ts`: `sameSite` defaults to `None` in production / `Lax` in development (override via `COOKIE_SAME_SITE` env var), and `secure` is forced `true` whenever `sameSite` is `None`, otherwise it follows `NODE_ENV`. This split lets a same-domain production deployment opt back into `Lax`/non-secure without breaking the `Secure` requirement `SameSite=None` imposes.

**CORS + CSRF:** `FRONTEND_URL` env var accepts comma-separated origins (`backend/src/index.ts` splits on `,`). Both `hono/cors` and `hono/csrf` are scoped to `/api/*` and configured from the same parsed `allowedOrigins` list — CSRF protection matters here specifically because auth uses cookies rather than bearer tokens.

**Shared types:** Zod schemas live in `packages/shared`. Both FE and BE import from `@restack/shared`. Never duplicate types — see the build gotcha above for why edits there need a rebuild to take effect.

**Timing-safe login:** `auth.service.ts` hashes against a precomputed dummy bcrypt hash when the email isn't found, so failed logins cost the same regardless of whether the account exists.

**Dual-cookie refresh tokens:** `access_token` (JWT, 15m) and `refresh_token` (opaque random token, 30d) are both issued on login/register from `authService.issueTokenPair` and both set at `Path=/` — the standard two-cookie shape, deliberately kept simple rather than narrowing `refresh_token`'s `Path` (an earlier draft did that plus a third marker cookie for `proxy.ts` to check; reverted as more complexity than the marginal defense-in-depth was worth for a template). Refresh tokens are never stored raw: only their sha256 hash lives in `authSessionsTable` (`auth.model.ts`), and `authRepo.consumeSessionByHash` rotates them atomically (`DELETE ... WHERE hash AND expires_at > now() RETURNING *` in one statement) — this matters because a naive SELECT-then-DELETE has a TOCTOU race where concurrent refresh calls on the same token could both succeed. `frontend/shared/lib/api-client.ts` calls `/api/auth/refresh` automatically on a 401, coalescing concurrent 401s into one in-flight refresh (the token is single-use, so parallel independent refresh calls would make all but one fail). `/register`, `/login`, `/refresh` are rate-limited via `backend/src/shared/middlewares/rate-limit.ts` (in-memory, per-IP, 10 req/min — single-process only, note the upgrade-path comment in that file if the backend ever scales horizontally).

## Backend env vars

See `backend/.env.example`. Required: `DATABASE_URL`, `JWT_SECRET` (min 32 chars, validated via Zod in `backend/src/config/env.ts`). Optional: `NODE_ENV`, `PORT`, `FRONTEND_URL`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN` (only for same-apex-domain cross-domain deploys — see `docs/deployment-verification.md`).

## Known open items

`docs/concerns.md` is the living list of unresolved decisions. Check it before assuming a described behavior is finished, and update it when resolving or introducing a decision worth tracking. Currently open: no reuse-detection on refresh-token rotation, no TTL cleanup for expired `auth_sessions` rows, and cross-domain cookie behavior is documented but **not verified against a real deployment** (`docs/deployment-verification.md`).

## Roadmap

- **Phase 1** — Master template (current): build auth domain end-to-end, verify cookies work in prod
- **Phase 2** — CLI: wrap template into `npx create-restack-pattern`
- **Phase 3** — Portfolio: use the CLI to build a personal portfolio site
