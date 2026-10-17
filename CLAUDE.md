# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Source repository for **`create-restack-pattern`** (`npx create-restack-pattern`), a CLI that scaffolds a Next.js + Hono + Drizzle/PostgreSQL monorepo built with a Semi-DDD (feature-driven) architecture.

Two things are easy to mix up:
- **`frontend/` and `backend/` are not just examples** — they are a real, working full-stack app (auth, sessions, a `user` domain) that both (a) can be deployed itself and (b) is the source the CLI copies from.
- **`packages/create-restack-pattern/template/`** is a *generated, gitignored copy* of `frontend/`, `backend/`, and `packages/shared/`, produced by a sync script. Never hand-edit anything inside it — see "Working on the CLI package" below.

## ⚠️ Next.js version warning

`frontend/` runs **Next.js 16**, which has breaking changes vs. older Next.js your training data may reflect. Before writing frontend code, read the relevant guide in `frontend/node_modules/next/dist/docs/` and heed deprecation notices (see `frontend/AGENTS.md`).

## Commands

All commands run from the repo root using pnpm workspaces (`--filter` matches a package's `name` field in `package.json`, not its folder name — e.g. `packages/shared`'s name is `@restack/shared`).

### First-time setup
```bash
pnpm install
pnpm --filter @restack/shared build     # REQUIRED before first run — dist/ is gitignored (see gotcha below)
cp backend/.env.example backend/.env    # set DATABASE_URL and JWT_SECRET (32+ chars)
pnpm --filter backend db:push           # creates users / auth_sessions tables
```

### Dev
```bash
pnpm --filter backend dev               # http://localhost:3001 (tsx watch)
pnpm --filter frontend dev              # http://localhost:3000
pnpm dev                                # root: runs --parallel across all packages, NO topological order
```

### Build / lint / test
```bash
pnpm lint                               # Biome monorepo check across all packages
pnpm format                             # Biome format & auto-fix across all packages
pnpm --filter backend build             # tsc -> backend/dist
pnpm --filter frontend build            # next build (with typedRoutes: true)
pnpm --filter @restack/shared build     # tsc -> packages/shared/dist — rerun after every schema edit
pnpm --filter backend test              # vitest run — unit + testClient integration tests
pnpm --filter backend test <path>       # single test file, e.g. src/domains/auth/auth.service.test.ts
```
Backend integration tests hit your real local Postgres via `DATABASE_URL` and clean up after themselves — point `backend/.env` at a disposable dev database.

## Zero-Bug AI Agent Guardrails

### 1. Route Chaining & Explicit Status Codes
- Always chain Hono route handlers (`new Hono().get(...).post(...)`) and export `type AppType = typeof routes` to preserve 100% end-to-end type inference for the frontend `hc<AppType>` RPC client.
- Always specify explicit HTTP status codes on responses (e.g. `c.json(data, 200)`, `c.json(data, 201)`, `c.json({ error }, 400)`). This ensures Hono's RPC client can discriminate between success and error shapes at compile time.
- Every route accepting params, query, or body MUST validate inputs using `zValidator` with schemas imported from `@restack/shared`.

### 2. Strict Compiler & Environment Invariants
- `noUncheckedIndexedAccess: true` is active across all workspaces. Array and record indexing `arr[i]` returns `T | undefined`. Never access properties without verifying existence (e.g. `arr[0]?.prop ?? fallback`).
- Frontend environment variables MUST be read from `@/env` (validated by `@t3-oss/env-nextjs`), never raw `process.env`.
- Next.js `typedRoutes: true` is enabled in `frontend/next.config.ts`. Links must point to valid application routes.

### 3. Mandatory Verification Loop (Run Before Finishing Any Task)
Before declaring any task or feature complete, you MUST execute and pass:
1. `pnpm lint` (Zero Biome linter/formatting errors across all workspaces)
2. `pnpm --filter @restack/shared build` (Compile shared Zod schemas)
3. `pnpm --filter backend build` (Zero TypeScript errors in backend)
4. `pnpm --filter backend test` (Pass unit + in-memory `testClient` tests, including `fast-check` fuzzing)
5. `pnpm --filter frontend build` (Zero Next.js Turbopack / TypeScript errors)

### Database
```bash
pnpm --filter backend db:generate       # generate a Drizzle migration file
pnpm --filter backend db:studio         # open Drizzle Studio
```

### Critical gotcha: build `@restack/shared` first
`packages/shared`'s `package.json` resolves `main`/`types` to `dist/`, which is gitignored. On a fresh clone, or after editing anything in `packages/shared/src/schemas/`, run `pnpm --filter @restack/shared build` (or keep `pnpm --filter @restack/shared dev`, which is `tsc --watch`, running in a spare terminal) — otherwise frontend/backend fail to resolve the package or use stale types. Root `pnpm dev`/`pnpm build` run `--parallel` with no ordering, so they don't save you from this.

### Working on the CLI package (`packages/create-restack-pattern`)
The CLI doesn't read `frontend/`/`backend/`/`packages/shared` live — it bundles a static copy (`template/`, gitignored) the same way `create-vite` does.

| Changed | Do this | Why |
|---|---|---|
| `frontend/`/`backend/` code, normal dev | Nothing (watch mode already reloads) | Unrelated to the CLI |
| Same, and you want the CLI's local `template/` to reflect it | `pnpm --filter create-restack-pattern sync-template` | Copies disk state into `template/`; skipping means scaffolds are stale |
| You want it live on npm | Bump `version` in `packages/create-restack-pattern/package.json`, then `npm publish` | `prepublishOnly` runs `sync-template && build` automatically, but npm refuses to re-publish an unchanged version |
| The CLI's own logic (`src/index.ts`) | `pnpm --filter create-restack-pattern build` | Real TS compile step, separate from `sync-template` |

```bash
pnpm --filter create-restack-pattern sync-template
pnpm --filter create-restack-pattern build
node packages/create-restack-pattern/dist/index.js my-test-app   # scaffold locally, no npm involved
```

Non-obvious detail: `sync-template` renames every `.gitignore` it copies to `gitignore` (no dot), because npm always strips `.gitignore` from a published tarball but still *reads* it for exclusion rules first, silently dropping unrelated files. The CLI's `src/index.ts` renames them back to `.gitignore` when scaffolding a real project. If you add another dotfile to the copied set, check npm's always-strip list first.

## Architecture

### Monorepo layout
`pnpm-workspace.yaml` members: `frontend`, `backend`, `packages/*`.
```
frontend/    Next.js 16 (App Router)
backend/     Hono + Drizzle ORM
packages/shared/                  Zod schemas — single source of truth for FE + BE
packages/create-restack-pattern/  The CLI; template/ is a generated copy, not hand-edited
docs/                             Architecture notes, deploy checklists (en/ and id/ versions)
```

### Semi-DDD (feature-driven), the core pattern of this repo
Code is grouped by **business domain**, not by file type.

**Backend** (`backend/src/domains/[feature]/`), exactly 4 files per domain:
- `[feature].routes.ts` — HTTP endpoints + input validation (Zod schema imported from `@restack/shared`)
- `[feature].service.ts` — business logic only, never touches the DB directly
- `[feature].repo.ts` — Drizzle queries only, no business logic
- `[feature].model.ts` — Drizzle table definitions

**Cross-domain rule**: `auth` may import from `user` (e.g. `usersTable`, `userRepo.findById`). The reverse is forbidden — this is enforced by convention, not tooling, so check both directions when adding a domain.

**Frontend** (`frontend/domains/[feature]/`):
- `components/` — UI, no direct data fetching
- `hooks/` — reactive state + data fetching
- `services/` — thin HTTP wrappers around `lib/api-client.ts`
- `types.ts` — local type declarations
- `frontend/app/` is routing/layout/metadata ONLY — no custom JSX, forms, or state; always delegate rendering to a domain component.

### Auth: dual-cookie refresh tokens
`access_token` (JWT, 15m) and `refresh_token` (opaque, 30d), both `httpOnly`, `Path=/`. Refresh tokens are stored hashed (sha256, never raw) and rotated atomically via a single `DELETE ... WHERE hash AND expires_at > now() RETURNING *` in `authRepo.consumeSessionByHash` (closes a TOCTOU race an earlier select-then-delete draft had). `frontend/lib/api-client.ts` auto-refreshes on the first 401, coalescing concurrent 401s into one in-flight refresh call. Cookie flags: `SameSite=None; Secure=true` in production, `SameSite=Lax; Secure=false` in development. There is no `middleware.ts`/`proxy.ts` — cookies aren't readable server-side when frontend/backend deploy to unrelated domains, so auth is enforced via the backend's `requireAuth` middleware plus `<RequireAuth>`/client-side hook checks on the frontend.

### Structured & correlation logging
Pino, wired through Hono. Every request under `/api/*` gets a `requestId` (Hono's `requestId` middleware) and a request-scoped child logger (`logger.child({ requestId, ... })`) stored in Hono's context as `logger`. `requireAuth` further enriches it with `userId` once authenticated. In route handlers, always read the request-scoped logger via `c.get("logger") || logger` rather than the global `logger` import, so `requestId`/`userId` show up automatically.

### Deployment topology
Frontend and backend deploy as **two separate Vercel projects** from this one repo (`rootDirectory` set per project) — backend ships as serverless functions (`backend/api/index.ts` wraps the same `app` exported from `backend/src/hono-app.ts`; `backend/src/index.ts` is only the local/persistent-server entry point). `backend/vercel.json` sets `framework: null` and builds `@restack/shared` in `installCommand` (not `buildCommand`). DB schema must be pushed (`db:push`) before the first deploy — the backend validates `DATABASE_URL` eagerly at cold start.

## Where to look next

- **`DEVELOPMENT.md`** — the architecture contract (Semi-DDD rules, cross-domain imports, auth/cookie/logging design). Read before touching auth code.
- **`docs/en/development-guide.md`** — day-to-day workflow, pnpm workspace mechanics, and the full CLI publishing playbook (§5–7).
- **`docs/concerns.md`** — living backlog of open/deferred decisions (e.g. no refresh-token reuse detection, no session TTL cleanup). Check before assuming something is finished.
- **`docs/en/deployment-verification.md`** — deploy specifics with real verification notes, including the cookie-domain decision tree (same apex vs. unrelated `*.vercel.app` domains).
