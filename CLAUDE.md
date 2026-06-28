# RestackPattern

CLI scaffolding tool: `npx create-restack-pattern` — generates a full-stack monorepo with Next.js + Hono + Drizzle ORM using Semi-DDD (Feature-Driven) architecture.

## Monorepo Structure

```
restack-pattern/
├── frontend/          # Next.js (App Router) — deploy to any static host
├── backend/           # Hono + Drizzle ORM — deploy to any Node.js host
├── packages/shared/   # Zod schemas shared between FE and BE
└── docs/              # Planning & architecture docs
```

**Package manager:** pnpm workspaces (root). Run all `pnpm --filter` commands from root.

## Running the project

```bash
pnpm --filter backend dev      # Backend on http://localhost:3001
pnpm --filter frontend dev     # Frontend on http://localhost:3000
```

## Architecture: Semi-DDD

Code is grouped by **business feature (domain)**, not file type.

### Backend (`backend/src/domains/[feature]/`)
| File | Responsibility |
|------|----------------|
| `.routes.ts` | HTTP endpoints + input validation (Zod) |
| `.service.ts` | Business logic only — never touches DB directly |
| `.repo.ts` | Drizzle queries only — no business logic |
| `.schema.ts` | Zod validation shapes |
| `.model.ts` | Drizzle table definitions |

### Frontend (`frontend/domains/[feature]/`)
| Folder | Responsibility |
|--------|----------------|
| `components/` | UI only — no data fetching |
| `hooks/` | State + data fetching logic |
| `services/` | HTTP calls to backend only |
| `types.ts` | Local type definitions |

`frontend/app/` is **routing only** — pages just render domain components, nothing else.

## Key decisions

**Auth cookies:** Adaptive based on `NODE_ENV` — `SameSite=Lax` dev, `SameSite=None; Secure` prod. Override via `COOKIE_SAME_SITE` env var for same-domain production setups.

**CORS:** `FRONTEND_URL` env var accepts comma-separated origins: `http://localhost:3000,https://myapp.vercel.app`

**Shared types:** Zod schemas live in `packages/shared`. Both FE and BE import from `@restack/shared`. Never duplicate types.

**Cross-domain rule:** `auth` domain may import from `user` domain (e.g. `usersTable`). Reverse is not allowed.

## Backend env vars

See `backend/.env.example`. Required: `DATABASE_URL`, `JWT_SECRET`.

## Database

```bash
pnpm --filter backend db:push      # Push schema to DB (dev)
pnpm --filter backend db:generate  # Generate migration files
pnpm --filter backend db:studio    # Open Drizzle Studio
```

## Roadmap

- **Phase 1** — Master template (current): build auth domain end-to-end, verify cookies work in prod
- **Phase 2** — CLI: wrap template into `npx create-restack-pattern`
- **Phase 3** — Portfolio: use CLI to build personal portfolio site
