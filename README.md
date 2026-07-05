# RestackPattern

[![npm version](https://img.shields.io/npm/v/create-restack-pattern.svg)](https://www.npmjs.com/package/create-restack-pattern)
[![npm license](https://img.shields.io/npm/l/create-restack-pattern.svg)](https://www.npmjs.com/package/create-restack-pattern)
[![node version](https://img.shields.io/node/v/create-restack-pattern.svg)](https://nodejs.org)

Skip the boilerplate — scaffold a full-stack Next.js + Hono + PostgreSQL monorepo with secure auth cookies, structured logging, and a type-safe Hono RPC client end-to-end, all wired up and ready to deploy.

This is the source repository. The CLI itself is published on npm as [`create-restack-pattern`](https://www.npmjs.com/package/create-restack-pattern).

## Prerequisites

Before running the scaffolding command, ensure you have:
- **Node.js**: version 20 or higher
- **pnpm**: package manager installed (run `npm install -g pnpm` if needed)
- **PostgreSQL**: a running database (either a local instance or a free hosted instance on [Neon](https://neon.tech))

## Quick Start (For Users)

To scaffold a new project instantly:

```bash
npx create-restack-pattern my-app
```

Once the CLI finishes scaffolding, follow these three simple steps to get started:

### 1. Configure Environment Variables

```bash
cd my-app
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

- Open `backend/.env` and set:
  - `DATABASE_URL` (format: `postgresql://user:password@localhost:5432/dbname`; you can use a local Postgres database or a free hosted instance on [Neon](https://neon.tech))
  - `JWT_SECRET` (generate a secure 32-character key by running: `openssl rand -base64 32`)
- _(Optional)_ Open `frontend/.env` to override `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001` for local Hono API).

### 2. Push Database Tables

This creates the required `users` and `auth_sessions` tables in your database:

```bash
pnpm --filter backend db:push
```

### 3. Start Development Servers

```bash
pnpm dev
```

- **Backend API**: runs at [http://localhost:3001](http://localhost:3001)
- **Frontend App**: runs at [http://localhost:3000](http://localhost:3000)

---

## Tech Stack

| Layer      | Tech                                                              |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router)                                           |
| Backend    | Hono                                                              |
| Database   | PostgreSQL, via Drizzle ORM                                       |
| Validation | Zod (shared between frontend and backend)                         |
| Auth       | JWT access token + opaque refresh token, both in httpOnly cookies |
| Monorepo   | pnpm workspaces                                                   |

---

## Key Features

### 1. Architecture: Semi-DDD (Feature-Driven)

Code is grouped by **business feature (domain)**, not by file type:

```
my-app/
├── frontend/                 # Next.js — routing only in app/, logic in domains/
│   ├── app/                  # Pages (render domain components, nothing else)
│   ├── domains/              # auth/, user/ — components, hooks, services per feature
│   └── shared/               # Cross-domain reusables (api-client, hooks)
├── backend/                  # Hono — one folder per domain
│   └── src/domains/
│       ├── auth/             # .routes.ts, .service.ts, .repo.ts
│       └── user/
├── packages/shared/          # Zod schemas — single source of truth for FE + BE
└── docs/                     # Architecture notes, deploy checklists
```

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for the full layer-by-layer breakdown, cross-domain import rules, and design details.

### 2. Auth Flow (Dual-Cookie Refresh Tokens)

Dual-cookie refresh tokens: a short-lived JWT `access_token` (15m) and an opaque, single-use `refresh_token` (30d). The frontend's `api-client.ts` transparently exchanges an expired access token for a new pair on the first 401 it sees — no manual re-login until the refresh token itself expires. Refresh tokens are hashed (never stored raw) and rotated atomically on every exchange (using a single DB DELETE ... RETURNING operation to prevent TOCTOU race conditions).

### 3. Structured & Correlation Logging

This template implements **production-ready structured logging** using **Pino** and **Hono**:

- **Request ID (Correlation ID)**: A unique UUID is generated for every incoming HTTP request via Hono's `requestId` middleware.
- **Contextual Request Logger**: A request-specific child logger (`logger.child({ requestId })`) is bound to Hono's context. Any message logged within the request lifecycle automatically carries the `requestId`, making it trivial to trace logs in production without them interleaving.
- **User Context Integration**: The authentication middleware automatically enriches the request's child logger with `userId` context. Every log printed during a request made by an authenticated user will automatically have `userId` attached.
- **Pino + Pino-Pretty**: Standard JSON line formatting in production (ideal for aggregator platforms like BetterStack/Logtail, Axiom, Datadog) and beautiful colored console output in local development.

---

## Deploying

Frontend and backend deploy as two separate Vercel projects (the backend ships as serverless functions — see `backend/vercel.json`). Full step-by-step instructions, including the gotchas hit while getting it working the first time: [`docs/en/deployment-verification.md`](./docs/en/deployment-verification.md) (or the Indonesian version [`docs/id/deployment-verification.md`](./docs/id/deployment-verification.md)).

---

## Local Development & Contribution (For Maintainers)

If you want to clone **this** repository to contribute to the template, test changes locally, or debug the CLI script, follow these steps.

Requires [pnpm](https://pnpm.io) and a Postgres database (local or hosted — [Neon](https://neon.tech) works well).

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

### Maintainer Commands

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

### Developer Playbooks

For more detailed workflows, please check the local documentation:

- [Development Workflow Guide](./docs/en/development-guide.md) (Indonesian version: [Panduan Kontribusi](./docs/id/development-guide.md))
