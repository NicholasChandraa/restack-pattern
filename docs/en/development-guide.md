# Development Guide

A practical guide to working in this repo day to day: what each folder is for, how pnpm workspaces
tie them together, how to run and test things locally, and how to deploy the template / publish the
CLI when you're ready. For architectural rules (Semi-DDD, cross-domain imports, auth design), see
`CLAUDE.md` — this guide is about *workflow*, that one is about *rules*.

## 1. Project structure

```
restack-pattern/
├── frontend/                          Next.js 16 (App Router) — the template's frontend
├── backend/                           Hono + Drizzle ORM — the template's backend
├── packages/
│   ├── shared/                       Zod schemas — imported by both frontend and backend
│   └── create-restack-pattern/       The CLI (npx create-restack-pattern) — see §5
└── docs/                             Planning & architecture docs (this file included)
```

Two things are easy to mix up:

- **`frontend/` and `backend/` are not just examples** — they're a real, working full-stack app
  (auth, sessions, a `user` domain) that doubles as (a) something you can deploy yourself and
  (b) the source the CLI copies from.
- **`packages/create-restack-pattern/template/`** (not shown above — it's gitignored) is a
  *generated copy* of `frontend/`, `backend/`, and `packages/shared/`, produced by a sync script.
  It is not something you hand-edit. See §5.

## 2. pnpm workspace basics

`pnpm-workspace.yaml` at the repo root lists which folders are workspace *members*:
`frontend`, `backend`, `packages/*`. Each member has its own `package.json` with its own `name`
field (e.g. `@restack/shared`, `create-restack-pattern`) — pnpm reads that `name`, not the folder
path, when you target it.

The pattern you'll use constantly:

```bash
pnpm --filter <package-name> <script>
```

`--filter` matches the `name` field in that package's `package.json`, then runs `<script>` (one of
that package's `"scripts"` entries) *as if you'd `cd`ed into it* — without actually leaving the
repo root. A few concrete examples used throughout this repo:

```bash
pnpm --filter backend dev                    # runs backend/package.json's "dev" script
pnpm --filter frontend build                  # runs frontend/package.json's "build" script
pnpm --filter @restack/shared build           # note: package name, not folder name ("shared")
pnpm --filter create-restack-pattern sync-template
```

Why workspaces instead of separate repos: one `pnpm install` at the root resolves and hoists
dependencies for all four packages at once, and workspace packages can depend on each other by
name (`@restack/shared` in `backend/package.json`) and pnpm symlinks them locally instead of
fetching from npm.

Root-level convenience scripts (`pnpm dev`, `pnpm build` — check root `package.json`) typically
run `--parallel` across all members with **no topological ordering**. That matters for the one
real gotcha in this repo:

**`packages/shared` must be built before backend/frontend can resolve it.** Its `package.json`
points `main`/`types` at `dist/`, which is gitignored. On a fresh clone, run
`pnpm --filter @restack/shared build` once before starting `backend`/`frontend`, or keep
`pnpm --filter @restack/shared dev` (which is `tsc --watch`) running in a spare terminal so edits
there take effect immediately. If you skip this, imports of `@restack/shared` either fail to
resolve or use stale types.

## 3. Local development workflow

```bash
pnpm install                                   # once, from repo root
pnpm --filter @restack/shared build            # once, before first run (see gotcha above)
cp backend/.env.example backend/.env           # fill in DATABASE_URL, JWT_SECRET (32+ chars)
pnpm --filter backend db:push                  # creates users / auth_sessions tables
pnpm --filter backend dev                      # http://localhost:3001
pnpm --filter frontend dev                     # http://localhost:3000 (separate terminal)
```

Other useful commands:

```bash
pnpm --filter backend db:generate              # generate a Drizzle migration file
pnpm --filter backend db:studio                # open Drizzle Studio (visual DB browser)
pnpm --filter backend test                     # Vitest: unit + integration tests
pnpm --filter frontend lint                     # ESLint (frontend only — backend/shared have none)
```

`backend test` hits your real local Postgres (via `DATABASE_URL`) for integration tests and
cleans up after itself — point it at a disposable dev database, not one with data you care about.

Cookies and CORS just work locally with zero configuration (`localhost` cookie-matching + dev
defaults) — see `docs/deployment-verification.md`'s "Local development" section if login doesn't
seem to persist; it's almost always a `FRONTEND_URL` mismatch, not a cookie problem.

## 4. Architecture in one paragraph

Code is grouped by **business feature (domain)**, not file type — `backend/src/domains/auth/`,
`backend/src/domains/user/`, `frontend/domains/auth/`, etc. Backend domains split into
`.routes.ts` (HTTP + validation) / `.service.ts` (business logic) / `.repo.ts` (Drizzle queries) /
`.model.ts` (table definitions); frontend domains split into `components/` / `hooks/` /
`services/`. Zod schemas live once in `packages/shared/src/schemas/`, imported by both sides — the
schema is never duplicated. `auth` may import from `user`; never the reverse. Full rules and the
reasoning behind specific decisions (dual-cookie refresh tokens, timing-safe login, no
`middleware.ts`) are in `CLAUDE.md` — read that before touching auth code.

## 5. Working on the CLI package (`packages/create-restack-pattern`)

The CLI doesn't read `frontend/`/`backend/`/`packages/shared` live — it bundles a **static copy**
(`template/`) inside its own package, the same way `create-vite`/`create-next-app` work. This
means there's a sync step between "I edited the master template" and "the CLI will scaffold that
edit". "Build" is overloaded in this repo, so before anything else, know which of these three
situations you're actually in:

| What you changed | What you need to do | Why |
|---|---|---|
| `frontend/` or `backend/` code, for normal local dev | Nothing — `pnpm --filter backend dev` / `pnpm --filter frontend dev` already run in watch mode and hot-reload. If you touched `packages/shared/src/`, also run `pnpm --filter @restack/shared build` (or keep its `dev`/watch mode running) — frontend/backend import the compiled `dist/`, not the source. | This is the common case; it has nothing to do with the CLI. |
| Any of the above, and you want the CLI's **local** `template/` folder to reflect it (e.g. to test scaffolding before publishing) | `pnpm --filter create-restack-pattern sync-template` | This is a **copy**, not a compile — it re-reads `frontend/`/`backend/`/`packages/shared` from disk into `template/`. Skipping it means `node dist/index.js <name>` scaffolds stale code. |
| You want the change to reach people running `npx create-restack-pattern` from npm | Bump `"version"` in `packages/create-restack-pattern/package.json`, then `npm publish` | `prepublishOnly` auto-runs `sync-template && build` for you, but npm refuses to re-publish an unchanged version number — you still have to bump it yourself first. See §7. |

Separately, if you edit the CLI's *own* logic (`packages/create-restack-pattern/src/index.ts` —
the scaffolding script itself, not the template content), that's a real TypeScript compile step:
`pnpm --filter create-restack-pattern build`. Forgetting this is why `dist/index.js` can lag
behind `src/index.ts` — `npm pack --dry-run` won't catch it, since it just packs whatever is
already sitting in `dist/`.

```bash
pnpm --filter create-restack-pattern sync-template   # regenerates template/ from the live source
pnpm --filter create-restack-pattern build            # compiles src/index.ts -> dist/index.js
node packages/create-restack-pattern/dist/index.js my-test-app   # scaffold locally, no npm involved
```

`sync-template` copies `frontend/`, `backend/`, `packages/shared/`, plus root `package.json`,
`pnpm-workspace.yaml`, and `.gitignore`, into `template/` — excluding `node_modules`, build
output (`dist`, `.next`, `.turbo`, `*.tsbuildinfo`, `next-env.d.ts`), `.vercel`, `.git`, and every
`.env*` file except `.env.example`.

**The non-obvious part: `.gitignore` files get renamed to `gitignore` (no dot) during sync.**
npm hard-codes certain filenames (`.git`, `.gitignore`, `.npmignore`, `.DS_Store`, …) to always be
stripped from a published tarball — but it still *reads* a `.gitignore` it finds for exclusion
rules before stripping it, which silently drops unrelated files (this cost real debugging time —
see `docs/concerns.md` if curious). The fix: `sync-template.mjs` renames every `.gitignore` it
copies to `gitignore`, and the CLI's `src/index.ts` renames them back to `.gitignore` the moment
it scaffolds a real project. If you ever add another dotfile-with-publish-significance to the
copied set, check whether it's on npm's always-strip list before assuming it'll survive `npm pack`.

`template/` is gitignored and rebuilt from scratch on every `sync-template` run (and automatically
before every `npm publish` — see §7) — never hand-edit anything inside it.

## 6. Deploying the template app

This is about running the `frontend`/`backend` apps themselves in production (e.g. for the Phase 3
portfolio site, or if you scaffolded a project with the CLI and want to ship it). Full step-by-step
— including the exact `vercel.json` gotchas (`framework: null`, the `public/.gitkeep` requirement,
why `@restack/shared` must build in `installCommand` not `buildCommand`) and the cookie-domain
decision tree (same apex domain vs. unrelated `*.vercel.app` domains) — lives in
`docs/deployment-verification.md`. Short version:

1. Push the DB schema to production Postgres *before* the first deploy (`db:push` — the backend
   validates `DATABASE_URL` eagerly at cold start).
2. Backend and frontend deploy as **two separate Vercel projects** from this one repo, each with
   `rootDirectory` set to `backend`/`frontend` respectively.
3. Set env vars per project (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` on the backend;
   `NEXT_PUBLIC_API_URL` on the frontend, baked in at build time).
4. Smoke test: `curl` the backend's `/` route, then register/login/dashboard in a browser, then
   verify the refresh flow (delete just `access_token`, reload, confirm it still works).

Verified end-to-end against a real Vercel + Vercel + Neon deployment (unrelated domains). Same-apex
deployments are documented but not yet verified against a real deploy.

## 7. Publishing the CLI to npm

Publishing is npm-registry-only — there's no web UI for it, just `npm publish` from your terminal.
From `packages/create-restack-pattern`:

```bash
npm login                              # once per machine; opens a browser to authenticate
npm publish                            # unscoped package name -> public by default, no flag needed
```

`prepublishOnly` (in `package.json`) automatically runs `sync-template && build` first, so you
never publish a stale `template/`/`dist/`. If your npm account has 2FA enabled for publishing,
`npm publish` will either prompt for `--otp=<code>` or open a browser approval link — either way,
it's a one-time interactive step per publish.

**Version bumps**: npm refuses to let you re-publish the same version number. Bump
`"version"` in `package.json` (semver: patch for fixes, minor for new non-breaking scaffolding
options, major for changes that would break existing generated projects) before publishing again.

**Always verify a real publish**, not just `npm pack --dry-run` — dry-run doesn't run the same
manifest validation as an actual publish (this repo hit a `bin` field warning during publish that
never showed up in dry-run). After publishing:

```bash
npx create-restack-pattern@latest some-throwaway-name
```

This installs from the real registry, exactly as an end user would, and is the only way to confirm
the `bin` entry actually resolves and the scaffolded project has real `.gitignore` files (not the
renamed `gitignore` placeholder — see §5).

## 8. Maintenance

- **Keeping the template in sync**: any edit to `frontend/`, `backend/`, or `packages/shared/`
  only reaches the CLI after a `sync-template` run. It happens automatically before publish
  (`prepublishOnly`), but *not* automatically for local testing or `npm pack --dry-run` — run it
  manually first, or your dry-run/local-scaffold results will reflect stale code.
- **Dependency updates**: `pnpm outdated` (repo root) lists what's behind; `pnpm update` inside a
  specific package via `--filter`, or repo-wide with `-r`. Bump `packages/shared` deps carefully —
  changes there ripple into both `frontend` and `backend`.
- **Open decisions and known follow-ups** (reuse-detection on refresh tokens, no session-row TTL
  cleanup, deferred CLI prompts for package manager/DB/OAuth choice, etc.) are tracked in
  `docs/concerns.md`, not duplicated here — check it before assuming something is finished, and
  add to it when you knowingly defer something.
- **This file vs. others**: `CLAUDE.md` is the architectural contract (rules an AI assistant or a
  new contributor must follow); `docs/concerns.md` is the living backlog of open/deferred
  decisions; `docs/deployment-verification.md` is deploy specifics with real verification
  timestamps. Update whichever one actually changed — don't let this file drift into duplicating
  them.

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `@restack/shared` import fails to resolve, or uses stale types | `dist/` not built yet, or edited without rebuilding | `pnpm --filter @restack/shared build`, or run its `dev` (watch mode) while editing |
| `pnpm --filter create-restack-pattern build` → `'tsc' is not recognized` | Fresh clone / new package, `node_modules` not installed yet | `pnpm install` from repo root first |
| Login doesn't persist in local dev | `backend/.env`'s `FRONTEND_URL` doesn't match the URL you're loading the frontend from | Fix `FRONTEND_URL` — this is a CORS/CSRF origin check, not a cookie attribute issue |
| `npm pack`/`publish` missing an expected file, or a "gitignore-fallback" warning | A `.gitignore`-named file got read for exclusion rules — see §5 | Re-run `sync-template`; if you added a new copied dotfile, rename it away from npm's always-strip list |
| CLI scaffolds a project with no `.gitignore` files | `dist/index.js` is stale relative to `src/index.ts`'s rename-back logic | `pnpm --filter create-restack-pattern build`, then re-test |
