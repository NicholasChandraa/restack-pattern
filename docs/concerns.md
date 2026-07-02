# Concerns & Open Decisions

## Phase 1 (Master Template) — Done

- [x] Backend logger — `pino`, wired into Hono via `hono/logger` in `backend/src/index.ts`
- [x] Token payload extensibility — `AuthTokenPayload` type + `buildTokenPayload()` in `backend/src/domains/auth/auth.service.ts`, single spot to add roles/permissions later without redesigning
- [x] Security review of auth code
- [x] Implement CSRF Protection middleware in Hono (critical for cookie auth, especially with `SameSite=None` in production)
- [ ] Implement Refresh Token flow end-to-end using the **Dual-Cookie pattern** (POST `/refresh`, DB session tracking `auth.model.ts`, short-lived `access_token` cookie + long-lived `refresh_token` cookie, optimized for Next.js SSR)



## Phase 2 (CLI)

- Support multiple package managers: npm, pnpm, bun, deno
  - Either prompt user to choose or auto-detect from run context (e.g. `bunx` → bun)
- DB choice: sqlite, postgres, or mysql — give user the option at scaffold time
- Optional Drizzle toggle — let user opt out of Drizzle entirely
- Dependency auto-update handling for generated projects (auto vs. manual update)
- OAuth login setup: Google, Telegram Bot, Discord Bot (optional, config-driven)
- AI-context docs for the generated monorepo — so AI assistants understand the structure immediately
- Code documentation

## Monorepo Tool

- pnpm workspaces for now — add Turborepo only if build time becomes a problem

## Code Optimizations & Refactoring

- [x] Refactor `apiClient` in `frontend/shared/lib/api-client.ts` to merge headers correctly and handle non-JSON error responses gracefully (prevents SyntaxError on HTTP 502/504)
- [x] Migrate manual cookie string interpolation to Hono's official helper (`setCookie`/`deleteCookie` from `hono/cookie`) in `backend/src/domains/auth/auth.routes.ts`
- [x] Update `allowedOrigins` in `backend/src/index.ts` to use parsed `env.FRONTEND_URL` instead of raw `process.env.FRONTEND_URL` for full type safety


