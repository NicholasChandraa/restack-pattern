# RestackPattern

A full-stack monorepo template — **Next.js + Hono + Drizzle ORM**, built with a
Semi-DDD (feature-driven) architecture, with a production-ready dual-cookie
refresh-token auth flow already wired end to end.

Eventually this becomes a CLI (`npx create-restack-pattern`). Right now this
repo _is_ the master template, hand-built and verified against a real
deployment (see [Roadmap](#roadmap)).

## Tech stack

| Layer      | Tech                                                              |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router)                                           |
| Backend    | Hono                                                              |
| Database   | PostgreSQL, via Drizzle ORM                                       |
| Validation | Zod (shared between frontend and backend)                         |
| Auth       | JWT access token + opaque refresh token, both in httpOnly cookies |
| Monorepo   | pnpm workspaces                                                   |

## Getting started

Requires [pnpm](https://pnpm.io) and a Postgres database (local or hosted —
[Neon](https://neon.tech) works well).

```bash
pnpm install

# packages/shared compiles to dist/, which backend and frontend both import —
# build it once before starting the other two, and rebuild after editing its
# schemas (dist/ is gitignored, so a fresh clone has nothing until this runs)
pnpm --filter @restack/shared build

cp backend/.env.example backend/.env
# edit backend/.env: set DATABASE_URL and JWT_SECRET (min 32 chars)

pnpm --filter backend db:push    # creates the users / auth_sessions tables

pnpm --filter backend dev        # http://localhost:3001
pnpm --filter frontend dev       # http://localhost:3000
```

## Commands

```bash
pnpm --filter backend dev              # Backend, tsx watch
pnpm --filter frontend dev             # Frontend
pnpm --filter frontend lint            # ESLint (frontend only)
pnpm --filter backend build            # tsc → backend/dist
pnpm --filter frontend build           # next build
pnpm --filter @restack/shared build    # tsc → packages/shared/dist

pnpm --filter backend test             # Vitest — unit + integration tests

pnpm --filter backend db:push          # Push schema to DB (dev)
pnpm --filter backend db:generate      # Generate Drizzle migration files
pnpm --filter backend db:studio        # Open Drizzle Studio
```

## Architecture

Code is grouped by **business feature (domain)**, not by file type.

```
restack-pattern/
├── frontend/                 # Next.js — routing only in app/, logic in domains/
│   ├── app/                  # Pages (render domain components, nothing else)
│   ├── domains/               # auth/, user/ — components, hooks, services per feature
│   └── shared/                # Cross-domain reusables (api-client, hooks)
├── backend/                  # Hono — one folder per domain
│   └── src/domains/
│       ├── auth/              # .routes.ts, .service.ts, .repo.ts
│       └── user/
├── packages/shared/          # Zod schemas — single source of truth for FE + BE
└── docs/                     # Architecture notes, open decisions, deploy checklist
```

See [`CLAUDE.md`](./CLAUDE.md) for the full layer-by-layer breakdown, cross-domain
import rules, and the reasoning behind specific decisions (cookie config, CSRF,
token rotation, etc).

## Auth flow

Dual-cookie refresh tokens: a short-lived JWT `access_token` (15m) and an
opaque, single-use `refresh_token` (30d). The frontend's `api-client.ts`
transparently exchanges an expired access token for a new pair on the first
401 it sees — no manual re-login until the refresh token itself expires.
Refresh tokens are hashed (never stored raw) and rotated atomically on every

## Deploying

Frontend and backend deploy as two separate Vercel projects (the backend
ships as serverless functions — see `backend/vercel.json`). Full step-by-step
instructions, including the gotchas hit while getting it working the first
time: [`docs/en/deployment-verification.md`](./docs/en/deployment-verification.md) (or the Indonesian version [`docs/id/deployment-verification.md`](./docs/id/deployment-verification.md)).

## Roadmap

- **Phase 1** — Master template (done): auth domain built end-to-end, cookies
  verified in a real production deployment
- **Phase 2** — CLI: wrap the template into `npx create-restack-pattern`
- **Phase 3** — Portfolio: use the CLI to build a personal portfolio site
