# create-restack-pattern

[![npm version](https://img.shields.io/npm/v/create-restack-pattern.svg)](https://www.npmjs.com/package/create-restack-pattern)
[![npm license](https://img.shields.io/npm/l/create-restack-pattern.svg)](https://www.npmjs.com/package/create-restack-pattern)
[![node version](https://img.shields.io/node/v/create-restack-pattern.svg)](https://nodejs.org)

Skip the boilerplate — scaffold a full-stack Next.js + Hono + PostgreSQL monorepo with secure auth cookies, structured logging, and a type-safe Hono RPC client end-to-end, all wired up and ready to deploy.

This is the official initializer for the [Restack Pattern](https://github.com/NicholasChandraa/restack-pattern).

## Usage

```bash
npx create-restack-pattern my-app
```

Or run it without arguments to be prompted for a project name:

```bash
npx create-restack-pattern
```

### Prerequisites

- **Node.js**: version 20 or higher
- **pnpm**: package manager installed (run `npm install -g pnpm` if needed)
- **PostgreSQL**: a running database (either a local instance or a free hosted instance on [Neon](https://neon.tech))

---

## Quick Start (Next Steps)

Once the CLI finishes scaffolding your project, follow these three simple steps to get started:

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

## What You Get

- **`frontend/`** — Next.js 16 (App Router)
- **`backend/`** — Hono + Drizzle ORM, with a working JWT + refresh-token auth flow, production-ready structured correlation logging (Pino + Hono request tracing), and an example `user` domain already wired up.
- **`packages/shared/`** — Zod schemas shared between frontend and backend.

For a full breakdown of the folder structure, architecture rules (Semi-DDD), dual-cookie auth implementation, and deployment verification checklists, please visit the [GitHub repository](https://github.com/NicholasChandraa/restack-pattern).

---

## For Maintainers (Local Dev & Publishing)

The `template/` directory in this package is a **copy** of `frontend/`, `backend/`, and `packages/shared/` from the repo root, not a live reference — and it's gitignored.

Before testing your CLI changes locally or publishing, follow the standard workflow:

1. **Sync template**:
   ```bash
   pnpm --filter create-restack-pattern sync-template
   ```
2. **Compile the CLI script**:
   ```bash
   pnpm --filter create-restack-pattern build
   ```
3. **Verify the published files**:
   ```bash
   npm pack --dry-run
   ```
4. **Scaffold locally to test**:
   ```bash
   node dist/index.js test-app
   ```
5. **Publish to npm**:
   Bump the `"version"` in `package.json`, then:
   ```bash
   npm publish
   ```

For detailed guides, workflow explanations, and lessons learned:

- Check out the [Development Guide](../../docs/en/development-guide.md) (Indonesian: [Panduan Kontribusi](../../docs/id/development-guide.md))
