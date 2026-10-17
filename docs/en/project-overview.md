# RestackPattern — Project Overview

## What is it?

A CLI scaffolding tool that generates a full-stack monorepo instantly.

```bash
npx create-restack-pattern
```

Generates a production-ready monorepo with Next.js + Hono + Drizzle ORM, structured with Semi-DDD (Feature-Driven) architecture, with bulletproof auth cookies out of the box.

---

## Problem it solves

1. **Boilerplate fatigue** — developers waste hours setting up the same structure every project
2. **CORS/Cookie hell** — auth breaks when deploying frontend and backend to different domains

---

## Tech Stack

| Layer           | Tech                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Frontend        | Next.js 16 (App Router with Turbopack & Typed Routes)                |
| Backend         | Hono                                                                 |
| Database ORM    | Drizzle ORM                                                          |
| Database        | PostgreSQL (`postgres-js`) or SQLite (`better-sqlite3`)              |
| Primary Keys    | RFC 9562 UUIDv7 or Serial Auto-Increment                             |
| Validation      | Zod (shared FE ↔ BE)                                                 |
| Auth            | Hybrid Auth (Bearer header + HttpOnly cookie flow)                   |
| Access Control  | RBAC Middleware Guards (`requireRole`)                               |
| Quality         | Biome v2 (linter & formatter) + Strict TypeScript                    |
| Monorepo        | pnpm workspaces (also supports npm & bun)                            |
| Frontend deploy | Any static host (Vercel, Netlify, Cloudflare Pages)                  |
| Backend deploy  | Any Node.js host (Railway, Render, Fly.io, VPS)                      |

---

## Architecture: Semi-DDD (Feature-Driven)

Code is grouped by **business feature (domain)**, not by technical file type.

### Backend (Hono)

Each domain has exactly 4 files:

```
domains/[feature]/
├── [feature].routes.ts    # HTTP endpoints, input validation
├── [feature].service.ts   # Business logic only
├── [feature].repo.ts      # Database queries only
└── [feature].model.ts     # Drizzle table definitions
```

**Layer rules:**

- `routes` → validates input (using Zod schemas from `@restack/shared`), calls service, returns response
- `service` → business logic, never touches DB directly
- `repo` → Drizzle queries only, no business logic
- `model` → Drizzle table definitions, no logic

### Frontend (Next.js)

```
app/                          # Routing ONLY (render domain components)
components/                   # Global components (e.g. RequireAuth) and UI (Shadcn)
├── ui/                       # Shadcn atoms (Button, Input)
├── require-auth.tsx
lib/
├── api-client.ts             # Hono RPC client (hc<AppType>)
└── utils.ts                  # Tailwind merger helper (cn)
hooks/                        # Global hooks (e.g. useAuthMutation)
domains/[feature]/
├── components/               # UI specific to this feature
├── hooks/                    # State + data fetching logic
├── services/                 # HTTP calls to backend
└── types.ts                  # Local type definitions
```

**Layer rules:**

- `app/page.tsx` → only renders a domain component, nothing else
- `components` → UI only, no data fetching
- `hooks` → logic + state, no direct HTTP calls
- `services` → HTTP calls only, no UI logic

---

## Key Feature: Bulletproof Auth Cookies

Cookie config adapts automatically to environment:

| Environment | SameSite | Secure |
| ----------- | -------- | ------ |
| Development | Lax      | false  |
| Production  | None     | true   |

This eliminates the most common auth bug when deploying FE and BE to different domains.

---

## Key Feature: End-to-End Type Safety

Zod schemas are written once in `packages/shared/src/schemas` and shared with both backend and frontend. If the schema changes, TypeScript errors appear on both sides immediately — no manual sync needed.

```
packages/shared/src/schemas/auth.schema.ts
         ↙                        ↘
backend/src/domains/...     frontend/domains/...
```

---

## Key Feature: Structured & Correlation Logging

This template implements **production-ready structured logging** using **Pino** and Hono middlewares:

- **Correlation ID (Request ID)**: A unique UUID is generated for every incoming HTTP request via Hono's `requestId` middleware.
- **Contextual Request Logger**: A request-specific child logger (`logger.child({ requestId })`) is bound to Hono's context. Any message logged within the request lifecycle automatically carries the `requestId`, making it trivial to trace logs in production without them interleaving.
- **User Context Integration**: The authentication middleware automatically enriches the request's child logger with `userId` context. Every log printed during a request made by an authenticated user will automatically have `userId` attached.
- **Pino + Pino-Pretty**: Standard JSON line formatting in production (ideal for aggregator platforms like BetterStack/Logtail, Axiom, Datadog) and beautiful colored console output in local development.

---

## Folder Structure

```
restack-pattern/
├── frontend/                         # Next.js → any static host
│   ├── app/                          # Routing only
│   ├── components/                   # Global components & UI
│   ├── lib/                          # Global libraries & utils (api-client, cn)
│   ├── hooks/                        # Global hooks
│   └── domains/                      # Semi-DDD features
│       ├── auth/
│       └── user/
│
├── backend/                          # Hono → any Node.js host
│   └── src/
│       ├── config/
│       ├── infra/                    # DB connection & HTTP middlewares
│       │   ├── db/
│       │   └── middlewares/
│       ├── utils/                    # Global utilities (logger)
│       ├── domains/                  # Semi-DDD features
│       │   ├── auth/
│       │   └── user/
│       └── index.ts
│
├── packages/
│   └── shared/                       # Zod schemas (FE ↔ BE)
│
└── package.json                      # pnpm workspaces root
```
