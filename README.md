# RestackPattern

[![npm version](https://img.shields.io/npm/v/create-restack-pattern.svg)](https://www.npmjs.com/package/create-restack-pattern)
[![npm license](https://img.shields.io/npm/l/create-restack-pattern.svg)](https://www.npmjs.com/package/create-restack-pattern)
[![node version](https://img.shields.io/node/v/create-restack-pattern.svg)](https://nodejs.org)

Skip the boilerplate — scaffold a full-stack Next.js + Hono monorepo with your choice of PostgreSQL or SQLite, UUIDv7 or Serial IDs, Hybrid Auth (Bearer + HttpOnly Cookies), RBAC guards, and end-to-end type safety.

This is the source repository. The CLI itself is published on npm as [`create-restack-pattern`](https://www.npmjs.com/package/create-restack-pattern).

## Prerequisites

Before running the scaffolding command, ensure you have:
- **Node.js**: version 20 or higher
- **Package Manager**: `pnpm` (recommended), `npm`, or `bun`
- **Database**: PostgreSQL (Neon, Supabase, Docker) or SQLite (zero-config local file)

## Quick Start (Interactive Scaffolder)

To scaffold a new project with the interactive wizard:

```bash
# Using pnpm (Recommended)
pnpm create restack-pattern my-app

# Or using npx
npx create-restack-pattern my-app

# Or using bun
bun create restack-pattern my-app
```

The interactive wizard lets you customize your stack:
```
┌  create-restack-pattern
│
◇  What is your project named?
│  my-app
│
◇  Select your database:
│  ● PostgreSQL (Neon, Supabase, Docker, AWS RDS)
│  ○ SQLite (Zero-config local file, Turso, Edge)
│
◇  Select primary key strategy:
│  ● UUIDv7 (Time-sortable, unguessable, secure against enumeration)
│  ○ Serial Integer (Auto-incrementing 1, 2, 3...)
│
◇  Select package manager:
│  ● pnpm (Recommended)
│  ○ npm
│  ○ bun
│
└  Scaffolding my-app ...
```

Once the CLI finishes scaffolding:

### 1. Configure Environment Variables

```bash
cd my-app
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

- For **PostgreSQL**: Set `DATABASE_URL` (e.g. `postgresql://user:password@localhost:5432/dbname`) and a 32-character `JWT_SECRET`.
- For **SQLite**: `DATABASE_URL` defaults to `sqlite.db` (created automatically).

### 2. Push Database Tables

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

| Layer          | Tech                                                                 |
| -------------- | -------------------------------------------------------------------- |
| Frontend       | Next.js 16 (App Router with Turbopack & Typed Routes)                |
| Backend        | Hono                                                                 |
| Database ORM   | Drizzle ORM                                                          |
| Database       | PostgreSQL (`postgres-js`) or SQLite (`better-sqlite3`)              |
| Primary Keys   | RFC 9562 UUIDv7 (time-ordered, unguessable) or Serial Auto-Increment |
| Validation     | Zod v4 (shared between frontend and backend via `@restack/shared`)   |
| Auth           | Hybrid Auth: `Authorization: Bearer <token>` + HttpOnly Cookie flow  |
| Access Control | Role-Based Access Control (RBAC) middleware guards                   |
| Monorepo       | pnpm workspaces (also supports npm and bun)                          |
| Quality        | Biome v2 (sub-50ms linter & formatter) + Strict TypeScript           |

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

### 2. Hybrid Auth & Dual Token Issuance

Supports both web browsers and external/mobile API clients out-of-the-box:
- **Authorization Header (Bearer)**: Inspected first (`Authorization: Bearer <token>`). Enables external clients, native mobile apps, and scripts to authenticate seamlessly.
- **HttpOnly Cookies**: Fallback for web browser clients, protecting against XSS attacks.
- **Dual Token Issuance**: Endpoints `/register`, `/login`, and `/refresh` return `{ user, accessToken, refreshToken }` in JSON body while simultaneously setting secure `Set-Cookie` headers.
- **Logger Enrichment**: Pino request logger is automatically enriched with `authMethod: "bearer" | "cookie"` and `userId`.
- **Atomic Token Rotation**: Single-use opaque refresh tokens are hashed (SHA-256) and rotated atomically using `DELETE ... RETURNING` to eliminate TOCTOU race conditions.

### 3. Role-Based Access Control (RBAC)

- User schema includes `role: text("role").default("user").notNull()`.
- Middleware guard `requireRole(...allowedRoles)` in `backend/src/infra/middlewares/require-role.ts`.
- Easily protect endpoints with declarative role checks:
  ```ts
  userRoutes.get("/admin", requireAuth, requireRole("admin"), (c) => {
    return c.json({ message: "Admin area" }, 200)
  })
  ```

### 4. Structured & Correlation Logging

This template implements **production-ready structured logging** using **Pino** and **Hono**:

- **Request ID (Correlation ID)**: A unique UUID is generated for every incoming HTTP request via Hono's `requestId` middleware.
- **Contextual Request Logger**: A request-specific child logger (`logger.child({ requestId })`) is bound to Hono's context. Any message logged within the request lifecycle automatically carries the `requestId`.
- **User Context Integration**: The authentication middleware automatically enriches the request's child logger with `userId` and `authMethod`.
- **Pino + Pino-Pretty**: Standard JSON line formatting in production and colored console output in local development.

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
