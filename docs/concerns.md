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
- [ ] Cross-domain prod verification — added `COOKIE_DOMAIN` support (`backend/src/config/env.ts`, used in `auth.routes.ts`) so cookies can be scoped to a shared apex domain, and wrote `docs/deployment-verification.md` covering both the same-apex-domain and fully-separate-domain topologies. **Not yet verified against a real deployment** — see that doc for the exact checklist and the hard platform constraint on why fully separate domains (e.g. default `*.vercel.app` + `*.up.railway.app`) can never let `frontend/proxy.ts` see the session cookies.

## Phase 2 (CLI)

- Support multiple package managers: npm, pnpm, bun, deno
  - Either prompt user to choose or auto-detect from run context (e.g. `bunx` → bun)
- DB choice: sqlite, postgres, or mysql — give user the option at scaffold time
- Optional Drizzle toggle — let user opt out of Drizzle entirely
- Dependency auto-update handling for generated projects (auto vs. manual update)
- OAuth login setup: Google, Telegram Bot, Discord Bot (optional, config-driven)
- AI-context docs for the generated monorepo — so AI assistants understand the structure immediately
- Code documentation
- Tambahan pilihan untuk user bisa pilih sistem biasa atau sudah include RBAC

## Monorepo Tool

- pnpm workspaces for now — add Turborepo only if build time becomes a problem

## Code Optimizations & Refactoring

- [x] Refactor `apiClient` in `frontend/shared/lib/api-client.ts` to merge headers correctly and handle non-JSON error responses gracefully (prevents SyntaxError on HTTP 502/504)
- [x] Migrate manual cookie string interpolation to Hono's official helper (`setCookie`/`deleteCookie` from `hono/cookie`) in `backend/src/domains/auth/auth.routes.ts`
- [x] Update `allowedOrigins` in `backend/src/index.ts` to use parsed `env.FRONTEND_URL` instead of raw `process.env.FRONTEND_URL` for full type safety
