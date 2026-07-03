# Concerns & Open Decisions

## Phase 1 (Master Template) — Done

- [x] Backend logger — `pino`, wired into Hono via `hono/logger` in `backend/src/index.ts`
- [x] Token payload extensibility — `AuthTokenPayload` type + `buildTokenPayload()` in `backend/src/domains/auth/auth.service.ts`, single spot to add roles/permissions later without redesigning
- [x] Security review of auth code
- [x] Implement CSRF Protection middleware in Hono (critical for cookie auth, especially with `SameSite=None` in production)
- [x] Implement Refresh Token flow end-to-end using the **Dual-Cookie pattern** — `POST /api/auth/refresh` in `backend/src/domains/auth/auth.routes.ts`, session tracking via `authSessionsTable` in `backend/src/domains/auth/auth.model.ts` (stores only a sha256 hash of the refresh token). Rotation is atomic (`authRepo.consumeSessionByHash` is a single `DELETE ... WHERE hash AND expires_at > now() RETURNING *`, closing a TOCTOU race a security review caught in an earlier draft that used a separate SELECT-then-DELETE). Short-lived `access_token` cookie (15m, JWT) and `refresh_token` cookie (30d, opaque token) are both `Path=/` — the standard shape. An earlier draft scoped `refresh_token` to `Path=/api/auth` for defense-in-depth plus a third non-secret `has_session` marker cookie so `frontend/proxy.ts` could still detect a refreshable session; reverted back to the plain two-cookie pattern as more complexity than the marginal security gain was worth for a template meant to be read and copied. `frontend/shared/lib/api-client.ts` auto-refreshes once on a 401 (coalescing concurrent 401s into a single in-flight refresh call, since the token is single-use) and retries the original request. `/register`, `/login`, `/refresh` are rate-limited (`backend/src/shared/middlewares/rate-limit.ts`, 10 req/min per IP per route, in-memory).
  - Known follow-up: expired `auth_sessions` rows are never purged (no TTL job) — fine at current scale, revisit if the table grows unbounded.
  - Known follow-up: no reuse-detection on rotation — a replayed *already-consumed* refresh token fails the same generic way as an expired/garbage one, and detected reuse doesn't revoke the session family. Would need a `familyId`/`replacedBy` lineage column; skipped for now as it's meaningfully more schema/logic than a template's baseline auth needs.
  - Known follow-up: the in-memory rate limiter is single-process only (a `Map`, not shared state) — fine for one backend instance, needs a shared store (e.g. Redis) if the backend ever scales horizontally.
- [x] Add `requireAuth` middleware (`backend/src/shared/middlewares/require-auth.ts`) enforcing `access_token` on protected routes, and build out the `user` domain (`user.repo.ts`/`user.service.ts`/`user.routes.ts`) as the first real protected feature — `GET /api/user/me`, `PUT /api/user/profile`. `authRepo.findById` was consolidated into `userRepo.findById` (auth now imports from user, matching the documented cross-domain rule, instead of duplicating the query).
- [x] Set up Vitest for the backend (`pnpm --filter backend test`) — unit tests for `auth.service.ts` (mocked repos) plus integration tests for `requireAuth` and the user routes (real local Postgres). Writing these caught a real pre-existing bug: `authRepo`/`userRepo` functions doing `const [row] = await db.select(...); return row ?? null` were inferring a non-nullable return type (no `noUncheckedIndexedAccess`), silently making every `if (!user)` caller check type-check as unreachable. Fixed with explicit `Promise<Row | null>` return annotations.
- [x] Verify cookies work in prod — deployed backend + frontend as separate Vercel projects (default `*.vercel.app` domains, Topology B) with Postgres via Vercel's Neon integration; confirmed via curl (Origin header set to the frontend's domain) that register → cookie set (`SameSite=None; Secure; HttpOnly`, host-only) → `/api/user/me` 200 → without access_token 401 → `/api/auth/refresh` 200 with rotated token → retry 200. Since Topology B means `proxy.ts` can never see the backend's cookies, it was removed entirely rather than kept as a topology-conditional special case — `frontend/domains/user/hooks/use-profile.ts` now redirects to `/login` client-side on a failed `/api/user/me` call instead. Full writeup + gotchas (Vercel's Hono framework auto-detection, `outputDirectory` requirement) in `docs/deployment-verification.md`. Not yet verified: the actual browser UI redirect (only checked at the HTTP/cookie level, no browser automation tool was available), and Topology A (same apex domain) is still untested.


## Phase 2 (CLI)

- Support multiple package managers (npm, pnpm, bun, deno) — **ask user as an interactive prompt during scaffolding (or auto-detect)**
- DB choice (PostgreSQL, SQLite, MySQL) — **ask user as an interactive prompt during scaffolding**
- Drizzle ORM toggle — **ask user as an interactive prompt during scaffolding (allowing to opt out entirely)**
- Dependency auto-update handling for generated projects (auto vs. manual update)
- OAuth login setup (Google, Telegram Bot, Discord Bot) — **ask user as an interactive prompt during scaffolding**
- AI-context docs for the generated monorepo — so AI assistants understand the structure immediately
- [x] Code documentation (added boundary rules, routing rules, repo structures, and helper explanations)
- RBAC (Role-Based Access Control) setup — **ask user as an interactive prompt during scaffolding (allowing choice between regular system or RBAC-included system)**

## Monorepo Tool

- pnpm workspaces for now — add Turborepo only if build time becomes a problem

## Code Optimizations & Refactoring

- [x] Refactor `apiClient` in `frontend/shared/lib/api-client.ts` to merge headers correctly and handle non-JSON error responses gracefully (prevents SyntaxError on HTTP 502/504)
- [x] Migrate manual cookie string interpolation to Hono's official helper (`setCookie`/`deleteCookie` from `hono/cookie`) in `backend/src/domains/auth/auth.routes.ts`
- [x] Update `allowedOrigins` in `backend/src/index.ts` to use parsed `env.FRONTEND_URL` instead of raw `process.env.FRONTEND_URL` for full type safety
- [x] Migrate primary keys and foreign key references from UUID strings to autoincrementing integers (serial) across the database schemas, entity types, services, and test suites to meet user requirements

