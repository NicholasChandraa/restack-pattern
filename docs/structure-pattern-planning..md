# RestackPattern — Folder Structure Plan

## Monorepo Strategy
- **1 repo**, deploy terpisah (Vercel + Railway)
- **pnpm workspaces** (no Turborepo dulu, tambah kalau build time jadi masalah)
- `packages/shared` = single source of truth untuk Zod schemas (end-to-end type safety)

---

## Final Structure

```
restack-pattern/
├── frontend/                         # Next.js (deploy → any static host)
│   ├── app/                          # Routing & Layout ONLY
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx        # Cuma render <LoginForm />
│   │   │   └── register/page.tsx
│   │   └── dashboard/page.tsx
│   │
│   ├── shared/                       # Global reusables
│   │   ├── components/ui/            # Shadcn atoms (Button, Input, etc.)
│   │   ├── lib/api-client.ts         # Hono RPC client + credentials config
│   │   └── hooks/                   # Global hooks (useTheme, useDebounce)
│   │
│   └── domains/                      # Semi-DDD core
│       ├── auth/
│       │   ├── components/           # UI khusus auth
│       │   │   ├── login-form.tsx
│       │   │   └── register-form.tsx
│       │   ├── hooks/                # State & data fetching
│       │   │   └── use-login.ts
│       │   ├── services/             # Jembatan ke backend API
│       │   │   └── auth.api.ts
│       │   └── types.ts              # Local types jika perlu
│       │
│       └── user/
│           ├── components/
│           │   └── profile-card.tsx
│           ├── hooks/
│           └── services/
│
├── backend/                          # Hono (deploy → Railway)
│   └── src/
│       ├── config/                   # env, cors, server config
│       │
│       ├── shared/                   # Kode shared antar domain
│       │   ├── db/                   # Drizzle client init
│       │   └── middlewares/          # Auth guard, logger
│       │
│       ├── domains/                  # Semi-DDD core
│       │   ├── auth/
│       │   │   ├── auth.routes.ts    # POST /login, /register, /logout, /refresh
│       │   │   ├── auth.service.ts   # Logic: verify password, set/clear cookie
│       │   │   ├── auth.repo.ts      # Query: find user by email (import dari user.model)
│       │   │   ├── auth.schema.ts    # Zod: LoginInput, RegisterInput → export ke shared
│       │   │   └── auth.model.ts     # Drizzle: tabel sessions / refresh_tokens
│       │   │
│       │   └── user/
│       │       ├── user.routes.ts    # GET /me, PUT /profile
│       │       ├── user.service.ts
│       │       ├── user.repo.ts
│       │       ├── user.schema.ts    # Zod: UpdateProfileInput
│       │       └── user.model.ts     # Drizzle: tabel users
│       │
│       └── index.ts                  # Entry point: load semua *.routes.ts
│
├── packages/
│   └── shared/                       # Single source of truth
│       ├── package.json
│       └── src/
│           └── schemas/
│               ├── auth.schema.ts    # Re-export dari backend auth.schema
│               └── user.schema.ts
│
└── package.json                      # pnpm workspaces root
```

---

## Layer Rules (wajib dipatuhi per domain)

### Backend
| File | Boleh tahu apa | TIDAK boleh |
|------|----------------|-------------|
| `.routes.ts` | HTTP req/res, Zod validation | Business logic |
| `.service.ts` | Business logic | Query DB langsung |
| `.repo.ts` | Drizzle queries | Business logic |
| `.schema.ts` | Zod shapes | - |
| `.model.ts` | Drizzle table def | - |

### Frontend
| Folder | Isi | TIDAK boleh |
|--------|-----|-------------|
| `app/` | Route + layout | Komponen, logic |
| `domains/*/components/` | UI render | Data fetching langsung |
| `domains/*/hooks/` | State + fetching | HTTP calls langsung |
| `domains/*/services/` | HTTP calls | UI logic |

---

## Cross-Domain Dependency Rule
- `auth.repo.ts` boleh import `usersTable` dari `user/user.model.ts`
- Arah dependency: auth → user (satu arah, tidak boleh balik)

---

## Auth Cookie Strategy
- Dev: `SameSite=Lax`, `Secure=false`
- Production: `SameSite=None`, `Secure=true`
- Diset di `auth.service.ts`, dikonfig di `config/`
