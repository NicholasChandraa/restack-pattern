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

| Layer | Tech |
|-------|------|
| Frontend | Next.js (App Router) |
| Backend | Hono |
| Database ORM | Drizzle ORM |
| Database | PostgreSQL (Neon) |
| Validation | Zod (shared FE ↔ BE) |
| Auth | JWT in httpOnly cookie |
| Monorepo | pnpm workspaces (+ Turborepo when build time matters) |
| Frontend deploy | Any static host (Vercel, Netlify, Cloudflare Pages) |
| Backend deploy | Any Node.js host (Railway, Render, Fly.io, VPS) |

---

## Architecture: Semi-DDD (Feature-Driven)

Code is grouped by **business feature (domain)**, not by technical file type.

### Backend (Hono)

Each domain has exactly 5 files:

```
domains/[feature]/
├── [feature].routes.ts    # HTTP endpoints, input validation
├── [feature].service.ts   # Business logic only
├── [feature].repo.ts      # Database queries only
├── [feature].schema.ts    # Zod schemas (exported to shared)
└── [feature].model.ts     # Drizzle table definitions
```

**Layer rules:**
- `routes` → validates input, calls service, returns response
- `service` → business logic, never touches DB directly
- `repo` → Drizzle queries only, no business logic
- `schema` → Zod shapes, no logic
- `model` → Drizzle table definitions, no logic

### Frontend (Next.js)

```
app/                          # Routing ONLY (render domain components)
shared/
├── components/ui/            # Shadcn atoms (Button, Input)
├── lib/api-client.ts         # Hono RPC client
└── hooks/                    # Global hooks
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
|-------------|----------|--------|
| Development | Lax | false |
| Production | None | true |

This eliminates the most common auth bug when deploying FE and BE to different domains.

---

## Key Feature: End-to-End Type Safety

Zod schemas are written once in the backend and shared to the frontend via `packages/shared`. If the backend schema changes, TypeScript errors appear on the frontend immediately — no manual sync needed.

```
backend/domains/auth/auth.schema.ts
        ↓ re-exported via
packages/shared/src/schemas/auth.schema.ts
        ↓ imported by
frontend/domains/auth/hooks/use-login.ts
```

---

## Folder Structure

```
restack-pattern/
├── frontend/                         # Next.js → any static host
│   └── src/
│       ├── app/                      # Routing only
│       ├── shared/                   # Global reusables
│       └── domains/                  # Semi-DDD features
│           ├── auth/
│           └── user/
│
├── backend/                          # Hono → any Node.js host
│   └── src/
│       ├── config/
│       ├── shared/
│       │   ├── db/
│       │   └── middlewares/
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

---

## Roadmap

### Phase 1 — Master Template
Build the monorepo manually. Implement Auth domain end-to-end (register, login, logout). Deploy to Vercel + Railway. Verify cookies work in production.

### Phase 2 — CLI
Convert the master template into a CLI script callable via `npx create-restack-pattern`.

### Phase 3 — Portfolio & Premium Services
Use the CLI to build a personal portfolio. The CLI itself becomes the strongest portfolio piece — proof of Software Architect-level skills.
