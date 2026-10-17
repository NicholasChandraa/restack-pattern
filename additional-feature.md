# Additional Features Roadmap: Restack Pattern Extensibility

This document defines the architectural specification, design decisions, and phased implementation checklist to transition `create-restack-pattern` from a single-configuration template into an interactive, flexible ecosystem starter.

---

## 1. Vision & Core Philosophy

The goal is to give developers maximum flexibility during initial setup without sacrificing the core architectural discipline of **Semi-DDD (Feature-Driven)**:
- **Same Mental Model**: Every generated project continues to use the 4-file domain pattern (`routes`, `service`, `repo`, `model`).
- **Flexible by Default**: No code duplication or divergent forks—features like Hybrid Auth work out-of-the-box, while database and ID strategies are selected at scaffold time.
- **Zero-Friction DX**: Interactive terminal prompts powered by `@clack/prompts` guide the developer through setup in seconds.

---

## 2. The Four Architectural Pillars

### Pillar 1: Hybrid Authentication (Cookies + Bearer Token)
*Current State*: Tightly coupled to browser `httpOnly` cookies, making it difficult for mobile apps (React Native/Flutter) or external API clients to interact with the backend.

*Proposed Solution*:
1. **Dual Ingestion in `requireAuth`**:
   - First checks `Authorization: Bearer <token>` in incoming headers.
   - If header is absent, falls back to `getCookie(c, "access_token")`.
2. **Dual Issuance in Auth Endpoints**:
   - `POST /api/auth/login`, `POST /api/auth/register`, and `POST /api/auth/refresh` will both set `Set-Cookie` (for web browsers) AND return `{ accessToken, refreshToken, user }` in the response JSON body (for mobile/API clients).
3. **Dual Revocation**:
   - `POST /api/auth/logout` revokes session by checking refresh token from cookie or body payload.

### Pillar 2: Pluggable Token Metadata & RBAC-Ready Auth
*Current State*: `AuthTokenPayload` is basic (`sub`, `email`). Adding authorization requires manually extending database columns, JWT signers, and route guards.

*Proposed Solution*:
1. **Database Schema**: Add `role` column to `usersTable` (default: `"user"`).
2. **JWT Payload**: Include `role: string` inside `buildTokenPayload()`.
3. **Shared Schemas**: Update `AuthUser` in `@restack/shared` to include `role`.
4. **Middleware Guard**: Add lightweight `requireRole(...roles: string[])` middleware:
   ```typescript
   export const requireRole = (...allowedRoles: string[]) => {
     return async (c: Context, next: Next) => {
       const user = c.get("user")
       if (!user || !allowedRoles.includes(user.role)) {
         return c.json({ error: "Forbidden: insufficient permissions" }, 403)
       }
       await next()
     }
   }
   ```

### Pillar 3: Primary Key Strategy (UUIDv7 vs. Serial IDs)
*Current State*: Hardcoded `serial("id")` (auto-incrementing integers `1, 2, 3...`). While compact, it is vulnerable to URL enumeration and inconvenient in distributed environments.

*Proposed Solution (Scaffold Option)*:
- **UUIDv7 (Recommended for SaaS/APIs)**:
  - 128-bit time-ordered UUID (`uuid("id")` in Postgres, `text("id")` in SQLite).
  - Unguessable and secure against enumeration, but **chronologically sortable** so B-tree database indexing remains fast.
  - Changes TypeScript types from `number` to `string` in `@restack/shared` (`AuthUser.id: string`).
- **Serial IDs (Legacy/Internal Tools)**:
  - Auto-incrementing integers (`1, 2, 3...`) for simple relational lookups.

### Pillar 4: Multi-Database Support (PostgreSQL vs. SQLite)
*Current State*: Hardcoded to PostgreSQL (`postgres-js` + `drizzle-orm/pg-core`). Developers wanting local SQLite or edge deployments must rewrite all schemas.

*Proposed Solution (Scaffold Option)*:
- **PostgreSQL**:
  - Driver: `postgres-js`
  - Models: `drizzle-orm/pg-core` (`pgTable`)
  - Target: Production SaaS, Neon, Supabase, Docker, AWS RDS.
- **SQLite**:
  - Driver: `better-sqlite3` (local/Node) or `@libsql/client` (Turso/Cloudflare D1).
  - Models: `drizzle-orm/sqlite-core` (`sqliteTable`)
  - Target: Zero-setup onboarding (no local Postgres needed), embedded apps, edge workers.

### Pillar 5: Zero-Bug AI-Proof Robustness & Guardrails
*Current State*: Standard `strict: true` still permits dangerous array/object indexing bugs at runtime, frontend env vars are untyped, routes are tested via raw string requests, and `<Link>` paths are not verified by TypeScript.

*Proposed Solution*:
1. **Next.js Typed Routes**:
   - Enable `typedRoutes: true` in `frontend/next.config.ts`. Misspelled internal links (e.g. `<Link href="/profle">`) will fail compilation immediately.
2. **Strict Compiler Guardrails (`tsconfig.json`)**:
   - Add `noUncheckedIndexedAccess: true` across all packages so array/record indexing returns `T | undefined` instead of masking `undefined` crashes.
   - Add `exactOptionalPropertyTypes: true`, `noImplicitReturns: true`, and `noFallthroughCasesInSwitch: true`.
3. **Typed Environment Validation (`@t3-oss/env-nextjs`)**:
   - Enforce schema validation for frontend env variables (`NEXT_PUBLIC_API_URL`), halting builds if required variables are missing.
4. **Type-Safe In-Memory API Tests (`hono/testing` + `fast-check`)**:
   - Migrate route integration tests to Hono's `testClient` for autocomplete on endpoint calls.
   - Use `fast-check` property-based testing to verify that bad/fuzzed payloads never cause unhandled 500 crashes.
5. **Universal Monorepo Linter & Formatter (Biome v2)**:
   - Configure `@biomejs/biome` at the repository root to lint and format TS, JSX, and JSON across all workspaces in milliseconds.
6. **Agent Guardrails in `CLAUDE.md` / `AGENTS.md`**:
   - Codify rules enforcing Hono route chaining, explicit status codes (`c.json(data, 200)`), and mandatory verification checks before concluding tasks.

---

## 3. Interactive CLI Wizard (`create-restack-pattern`)

Instead of an immediate copy, running `npx create-restack-pattern` will trigger a clean interactive prompt flow:

```
┌  create-restack-pattern
│
◇  Project name:
│  my-saas-app
│
◇  Select database:
│  ● PostgreSQL (Neon, Supabase, Docker)
│  ○ SQLite (Zero-config local file, Turso, Edge)
│
◇  Primary key strategy:
│  ● UUIDv7 (Time-sortable, unguessable - Recommended)
│  ○ Serial Integer (Simple auto-increment 1, 2, 3...)
│
◇  Select package manager:
│  ● pnpm (Recommended)
│  ○ npm
│  ○ bun
│
└  Scaffolding my-saas-app ...
```

---

## 4. Phased Implementation Roadmap & Checklist

### Phase 1: Zero-Bug AI-Proof Guardrails (Type & Compiler Safety)
*Goal: Turn on compiler strictness, route typing, and agent verification rules to eliminate bugs before runtime.*

- [x] **1.1 Next.js Typed Routes**
  - Enable `typedRoutes: true` in `frontend/next.config.ts` so route links are checked at compile time.
- [x] **1.2 Strict Compiler Flags**
  - Add `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitReturns: true`, and `noFallthroughCasesInSwitch: true` across `backend/tsconfig.json`, `frontend/tsconfig.json`, and `packages/shared/tsconfig.json`.
- [x] **1.3 Typed Frontend Environment (`@t3-oss/env-nextjs`)**
  - Install and configure `@t3-oss/env-nextjs` in `frontend` to enforce compile-time validation of `NEXT_PUBLIC_API_URL`.
- [x] **1.4 In-Memory Route Tests with `testClient`**
  - Upgrade `backend/src/domains/user/user.routes.test.ts` from raw `request()` to `testClient(userRoutes)` from `hono/testing`.
- [x] **1.5 Property-Based Fuzz Testing (`fast-check`)**
  - Add `fast-check` to backend devDependencies to fuzz Zod schemas and verify routes never crash with 500 on arbitrary payloads.
- [x] **1.6 Monorepo Linter & Formatter (Biome v2)**
  - Configure `@biomejs/biome` at the repository root to lint and format `frontend`, `backend`, and `shared` simultaneously in sub-second speed.
- [x] **1.7 AI Agent Guardrails in Documentation**
  - Update `CLAUDE.md` and `frontend/AGENTS.md` with explicit route chaining rules and the mandatory verification loop.

---

### Phase 2: Core Template Enhancements (Hybrid Auth & RBAC)
*Goal: Upgrade the live master template to support Hybrid Auth and RBAC out-of-the-box.*

- [x] **2.1 Hybrid Auth Ingestion**
  - Update `backend/src/infra/middlewares/require-auth.ts` to inspect `Authorization: Bearer <token>` before checking cookies.
  - Enrich logger with `authMethod: "bearer" | "cookie"`.
- [x] **2.2 Dual Token Issuance**
  - Update `backend/src/domains/auth/auth.routes.ts`:
    - Return `{ accessToken, refreshToken, user }` in response JSON for `/login`, `/register`, and `/refresh`.
    - Still issue `Set-Cookie` headers for web clients.
  - Allow `/logout` to accept optional `refreshToken` in request body if cookie is not present.
- [x] **2.3 RBAC in User Domain & Schema**
  - Add `role: text("role").default("user").notNull()` in `backend/src/domains/user/user.model.ts`.
  - Update `AuthUser` in `packages/shared/src/schemas/user.schema.ts` to include `role: string`.
  - Update `buildTokenPayload` in `backend/src/domains/auth/auth.service.ts` to include `role`.
- [x] **2.4 RBAC Middleware Guard**
  - Create `backend/src/infra/middlewares/require-role.ts` implementing `requireRole(...roles: string[])`.
  - Add an example protected route in `user.routes.ts` (e.g. `GET /api/user/admin-only`).
- [x] **2.5 Frontend Client Adaptability**
  - Update `frontend/lib/api-client.ts` to optionally support setting a manual Bearer token or maintaining the current cookie workflow.
- [x] **2.6 Testing & Validation**
  - Add test cases in `backend/src/infra/middlewares/require-auth.test.ts` for Bearer token extraction.
  - Add test cases for `requireRole` (200 for matching role, 403 for mismatch, 401 for unauthenticated).


---

### Phase 3: Database & ID Abstraction (SQLite & UUIDv7)
*Goal: Provide template variants for SQLite and UUIDv7 primary keys.*

- [x] **3.1 UUIDv7 Generator Utility**
  - Implement or bundle zero-dependency UUIDv7 generator for entity creation in Drizzle.
- [x] **3.2 SQLite Domain Schemas**
  - Create SQLite Drizzle equivalents for:
    - `usersTable` (using `sqliteTable`, `text("id")` for UUID or `integer("id")`).
    - `authSessionsTable` (using `sqliteTable`, `integer("expires_at", { mode: "timestamp" })`).
- [x] **3.3 Database Driver & Client Config**
  - Implement dynamic or switchable db client:
    - Postgres: `postgres` + `drizzle-orm/postgres-js`
    - SQLite: `better-sqlite3` + `drizzle-orm/better-sqlite3`
  - Create corresponding `drizzle.config.ts` variants (`dialect: "postgresql"` vs `dialect: "sqlite"`).
- [x] **3.4 Repository Cross-Dialect Compatibility**
  - Verify all queries in `user.repo.ts` and `auth.repo.ts` run identically on both Drizzle PostgreSQL and SQLite adapters.

---

### Phase 4: CLI Modernization (`packages/create-restack-pattern`)
*Goal: Transform the CLI into an interactive scaffolder.*

- [x] **4.1 Interactive Prompts Integration**
  - Add `@clack/prompts` and `picocolors` to `packages/create-restack-pattern/package.json`.
  - Build CLI prompt questionnaire (Project Name, Database, Primary Key, Package Manager).
- [x] **4.2 Template Architecture (Base + Overlays)**
  - Restructure `packages/create-restack-pattern/template/`:
    - `base/` (shared frontend, routing, services, config)
    - `overlays/db-postgres/` (Postgres client, models, drizzle config)
    - `overlays/db-sqlite/` (SQLite client, models, drizzle config)
    - `overlays/id-uuid/` vs `overlays/id-serial/`
- [x] **4.3 Scaffolding Engine Assembly**
  - Update `packages/create-restack-pattern/src/index.ts`:
    - Merge base template with selected database and ID overlays.
    - Dynamically patch `package.json` dependencies (swap `postgres` for `better-sqlite3` if SQLite selected).
    - Run appropriate install command based on chosen package manager (`pnpm`, `npm`, `bun`).
- [x] **4.4 Template Sync Script Update**
  - Update `packages/create-restack-pattern/scripts/sync-template.mjs` to automatically extract and populate the template overlays from the monorepo.

---

### Phase 5: Documentation, Verification & Release
*Goal: Polish developer experience, update manuals, and release new npm version.*

- [x] **5.1 Scaffolding Matrix Verification**
  - Test matrix locally:
    - Postgres + UUIDv7 + pnpm
    - Postgres + Serial + pnpm
    - SQLite + UUIDv7 + pnpm
    - SQLite + Serial + npm/bun
- [x] **5.2 Documentation Updates**
  - Update `README.md` and `DEVELOPMENT.md` with explanations of Hybrid Auth, RBAC, and SQLite setup.
  - Update English and Indonesian docs in `docs/en/` and `docs/id/`.
- [x] **5.3 Version Bump & Publish Verification**
  - Bump version in `packages/create-restack-pattern/package.json` to `0.2.0`.
  - Run `pnpm --filter create-restack-pattern prepublishOnly` to verify build and sync.
  - Ready for user publish to npm via `npm publish` in `packages/create-restack-pattern`.

