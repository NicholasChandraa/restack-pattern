# PRD — Mobile Scaffolding CLI (Restack Pattern for Mobile)

> Planning document only. The actual project will be built in a separate root
> folder/repo — this file captures the decisions made during discussion so
> they can be carried over when that project starts.

## 1. Background & Problem

Same motivation as the existing `create-restack-pattern` (web) CLI — eliminate
boilerplate fatigue for a new project — applied to mobile. The specific pain
points this tool solves:

1. Developers starting a React Native app have to decide up front whether the
   app is a server-backed (online) product or a fully local (offline) one,
   and that decision changes far more than "which database" — it changes
   whether a backend exists at all.
2. Auth patterns that work on web (httpOnly cookies) do not transfer to React
   Native as-is, and naively copying the web template's auth would silently
   break (no browser cookie jar on mobile).

## 2. Goals

- CLI scaffolds a React Native (Expo) mobile app.
- At scaffold time, the user picks **exactly one** of two architectures —
  this is a **mandatory interactive prompt**, not a runtime toggle (see §5.1).
- Preserve the Semi-DDD (feature-driven) architecture ethos from the web
  template, adapted for React Native.
- Each mode ships with an auth strategy appropriate to that mode — not a
  blind copy of the web backend's cookie-based auth.

## 3. Non-Goals (this version)

- **No offline-first-with-sync hybrid** (on-device SQLite as source of truth
  + Postgres server + a sync/conflict-resolution engine). Considered and
  explicitly deferred — a real scope multiplier (PowerSync/WatermelonDB/
  ElectricSQL territory), not a v1 concern.
- **No server-side SQLite backend option** (Hono + SQLite as the server's own
  DB, e.g. via Turso/libSQL). Confirmed normal/valid technically, but dropped
  to keep the tool to two clear modes instead of three.
- No push notifications / background sync in MVP.
- No OAuth / RBAC in MVP (mirrors the existing web CLI's deferred backlog).

## 4. The Two Modes

| | **Online** | **Offline** |
|---|---|---|
| Network required | Yes, always | Never |
| Backend | Hono | None |
| Database | PostgreSQL (Drizzle ORM) | SQLite on-device (Drizzle ORM + `expo-sqlite` driver) |
| Data fetching | TanStack Query + Hono RPC client | Drizzle `useLiveQuery` (reactive local queries) |
| Auth | JWT access + refresh tokens | None by default (see §6) |
| Data survives reinstall / syncs across devices | Yes (server is source of truth) | No (device-local only) |

Shared across both modes:

| Layer | Choice |
|---|---|
| App framework | Expo (React Native) |
| Navigation | Expo Router (file-based — mirrors Next.js App Router's "routing only" philosophy already used on web) |
| Styling / UI | NativeWind (Tailwind for RN) + `react-native-reusables` (shadcn-style components ported to RN) |
| Validation | Zod (shared schemas) |
| Testing | Jest + `@testing-library/react-native` (note: **not** Vitest — RN's Metro bundler isn't a good fit for Vitest, unlike the web backend which uses Vitest) |
| Package manager | pnpm workspaces |

## 5. Architecture

### 5.1 Mode selection is a mandatory interactive CLI prompt

Unlike the current web CLI — where DB choice is still hardcoded to Postgres
and an interactive prompt for it is an open backlog item — mode selection
here **must** be a real prompt (or CLI flag) at generation time. Online vs.
offline produces structurally different output (backend present or absent,
`auth` domain present or absent), so there is no way to generate "both and
let the user pick later."

### 5.2 Online mode — folder structure

```
mobile/
├── app/                       Expo Router — routing only, no logic
├── components/                Global UI (NativeWind + react-native-reusables)
├── domains/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/          Calls the Hono RPC client
│   └── user/
├── lib/
│   └── api-client.ts          Hono RPC client (hc<AppType>), attaches Bearer token
backend/                       Same Hono + Drizzle + Postgres shape as the web template
packages/shared/                Zod schemas (single source of truth, FE + BE)
```

### 5.3 Offline mode — folder structure

```
mobile/
├── app/                       Expo Router — routing only
├── components/
├── domains/
│   └── user/                  No `auth` domain — there is no server to authenticate against
│       ├── components/
│       ├── hooks/              useLiveQuery-based reactive hooks
│       └── services/           Direct Drizzle queries against on-device SQLite
├── db/
│   ├── schema.ts               Drizzle table definitions (SQLite dialect)
│   └── client.ts                expo-sqlite + Drizzle client init
packages/shared/                 Zod schemas (validation shapes only — no server involved)
```

No `backend/` folder is generated in this mode.

## 6. Auth Strategy

**Online mode** — dual-token pattern, same security properties as the
existing web backend, different transport:

- Access token (JWT, ~15m) + refresh token (opaque, ~30d), both returned in
  the **response body** (not `Set-Cookie` — React Native has no browser
  cookie jar to manage them automatically).
- Stored in `expo-secure-store` (iOS Keychain / Android Keystore — encrypted
  at rest), never `AsyncStorage`.
- Sent manually as `Authorization: Bearer <access_token>` on every request.
- On a 401: refresh-and-retry, coalescing concurrent 401s into a single
  in-flight refresh call (same pattern as `frontend/lib/api-client.ts` today).
- Server-side refresh token handling unchanged from the web backend: stored
  hashed (sha256), rotated atomically (single-use, `DELETE ... RETURNING`) to
  avoid TOCTOU races.

**Offline mode** — no identity authentication by default (there is no server
to authenticate against). Optional **local app-lock** (PIN or biometric via
`expo-local-authentication`) can gate access to the app itself — this is a
device-level privacy feature, not identity verification, and is opt-in.

## 7. Repo / Packaging Strategy

This is a **standalone project** — a new repo, built in a separate root
folder from this `restack-pattern` repo, not a `--platform mobile` flag
bolted onto the existing `create-restack-pattern` CLI. It will conceptually
mirror this repo's monorepo shape (a mobile app folder, an optional
`backend/`, `packages/shared/`, and its own `packages/create-restack-pattern-mobile`
CLI package) but will be independently versioned and published.

## 8. Open Questions / Deferred

- Interactive prompt scope beyond mode selection (package manager choice,
  EAS project setup, app icon/splash config) — not yet decided.
- Offline mode data export/import (manual backup/restore) — deferred.
- Push notifications — deferred.
- True offline-first-with-sync (SQLite + Postgres + sync engine) — deferred,
  possible future major-version direction, not v1.
- OAuth / RBAC — deferred, matches the existing web CLI's backlog philosophy.
- Exact CLI package name (`create-restack-pattern-mobile` used as a working
  name in this doc, not finalized).
