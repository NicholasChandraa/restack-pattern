# create-restack-pattern

Scaffold a new Next.js + Hono + Drizzle ORM monorepo using the Restack Pattern
(Semi-DDD / Feature-Driven) architecture — the same template built out in
[the main repo](https://github.com/NicholasChandraa/restack-pattern), bundled as a copy-and-go generator.

## Usage

```bash
npx create-restack-pattern my-app
```

Or without an argument, it'll prompt for a project name:

```bash
npx create-restack-pattern
```

This will:

1. Copy the template into `./my-app`
2. Set `my-app` as the generated project's root `package.json` name
3. Run `pnpm install`
4. Build `@restack/shared` (required once before `pnpm dev` works — see the
   generated project's gotcha notes)
5. Run `git init`

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) — the generated project is a pnpm workspace monorepo

## After scaffolding

```bash
cd my-app
cp backend/.env.example backend/.env   # fill in DATABASE_URL and JWT_SECRET
pnpm --filter backend dev              # http://localhost:3001
pnpm --filter frontend dev             # http://localhost:3000
```

## What you get

- `frontend/` — Next.js 16 (App Router)
- `backend/` — Hono + Drizzle ORM, with a working JWT + refresh-token auth flow, production-ready structured correlation logging (Pino + Hono request tracing), and an example `user` domain already wired up
- `packages/shared/` — Zod schemas shared between frontend and backend

## Current scope (MVP)

This is the first, deliberately minimal version of the CLI. It does not yet
ask about package manager, database, or auth-provider choices — it always
scaffolds the exact pnpm + Postgres + Drizzle stack from the template as-is.
Those choices are tracked as follow-up work in the main repository's roadmap.

## For maintainers: keeping the template in sync

The `template/` directory in this package is a **copy** of `frontend/`,
`backend/`, and `packages/shared/` from the repo root, not a live reference —
and it's gitignored, same as `dist/`. It's regenerated automatically before
publish (`prepublishOnly` runs `sync-template` then `build`), so it never
needs to be committed. For local testing, run it manually first:

```bash
pnpm --filter create-restack-pattern sync-template
```

This overwrites `template/` from the current state of the root template
(excluding `node_modules`, build output, `.env*` except `.env.example`, and
this repo's own internal planning docs like `docs/` and root `CLAUDE.md`,
which aren't relevant to a generated project).
