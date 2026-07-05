# RestackPattern — Rencana Struktur Folder

## Strategi Monorepo
- **1 repositori**, deploy terpisah (Vercel + Railway)
- **pnpm workspaces** (tidak menggunakan Turborepo terlebih dahulu, tambahkan hanya jika waktu build menjadi masalah)
- `packages/shared` = *single source of truth* untuk Zod schemas (menjamin type safety dari ujung-ke-ujung)

---

## Struktur Akhir (Final Structure)

```
restack-pattern/
├── frontend/                         # Next.js (deploy → penyedia hosting statis mana pun)
│   ├── app/                          # HANYA untuk Routing & Layout
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx        # Hanya merender <LoginForm />
│   │   │   └── register/page.tsx
│   │   └── dashboard/page.tsx
│   │
│   ├── components/                   # Komponen global (e.g. RequireAuth) dan UI (Shadcn)
│   │   ├── ui/                       # Komponen atomik Shadcn (Button, Input, dll.)
│   │   └── require-auth.tsx
│   ├── lib/                          # Pustaka & utilitas global (api-client, cn)
│   │   ├── api-client.ts             # Client RPC Hono (hc<AppType>) + konfigurasi kredensial cookie
│   │   └── utils.ts                  # Integrasi tailwind-merge (fungsi cn)
│   ├── hooks/                        # Hook global (useAuthMutation, useDebounce)
│   │
│   └── domains/                      # Inti arsitektur Semi-DDD
│       ├── auth/
│       │   ├── components/           # UI khusus domain auth
│       │   │   ├── login-form.tsx
│       │   │   └── register-form.tsx
│       │   ├── hooks/                # Manajemen state & data fetching
│       │   │   └── use-login.ts
│       │   ├── services/             # Jembatan penghubung ke API backend
│       │   │   └── auth.api.ts
│       │   └── types.ts              # Tipe lokal jika diperlukan
│       │
│       └── user/
│           ├── components/
│           │   └── profile-card.tsx
│           ├── hooks/
│           └── services/
│
├── backend/                          # Hono (deploy → Railway)
│   └── src/
│       ├── config/                   # Konfigurasi env, cors, dan server
│       │
│       ├── infra/                    # Infrastruktur teknis global
│       │   ├── db/                   # Inisialisasi client Drizzle
│       │   └── middlewares/          # Guard autentikasi
│       ├── utils/                    # Utilitas pembantu global (logger)
│       │
│       ├── domains/                  # Inti arsitektur Semi-DDD
│       │   ├── auth/
│       │   │   ├── auth.routes.ts    # POST /login, /register, /logout, /refresh
│       │   │   ├── auth.service.ts   # Logika: verifikasi password, set/clear cookie
│       │   │   ├── auth.repo.ts      # Query: mencari user berdasarkan email (mengimpor dari user.model)
│       │   │   └── auth.model.ts     # Drizzle: tabel sessions / refresh_tokens
│       │   │
│       │   └── user/
│       │       ├── user.routes.ts    # GET /me, PUT /profile
│       │       ├── user.service.ts
│       │       ├── user.repo.ts
│       │       └── user.model.ts     # Drizzle: tabel users
│       │
│       └── index.ts                  # Entry point utama: memuat semua *.routes.ts
│
├── packages/
│   └── shared/                       # Single source of truth (Zod schemas)
│       ├── package.json
│       └── src/
│           ├── index.ts              # Mengekspor semua schema dari subfolder
│           └── schemas/
│               ├── auth.schema.ts    # Didefinisikan langsung di sini
│               └── user.schema.ts
│
└── package.json                      # Workspace root pnpm
```

---

## Aturan Lapisan (wajib dipatuhi per domain)

### Backend
| File | Boleh mengakses/tahu apa saja | TIDAK boleh |
|---|---|---|
| `.routes.ts` | HTTP req/res, validasi input (mengimpor schema dari `@restack/shared`) | Logika bisnis (business logic) |
| `.service.ts` | Logika bisnis | Melakukan query ke database secara langsung |
| `.repo.ts` | Query Drizzle | Logika bisnis |
| `.model.ts` | Definisi tabel Drizzle | - |

Catatan: File Zod schema (`.schema.ts`) tidak dibuat di dalam backend domain, melainkan langsung ditempatkan di `packages/shared/src/schemas/` sebagai *single source of truth* untuk frontend dan backend.

### Frontend
| Folder | Isi | TIDAK boleh |
|---|---|---|
| `app/` | Konfigurasi route + layout | Komponen UI kompleks, logika state |
| `domains/*/components/` | Render UI | Melakukan fetching data secara langsung |
| `domains/*/hooks/` | Logika state + fetching data | Melakukan pemanggilan HTTP secara langsung |
| `domains/*/services/` | Pemanggilan HTTP | Logika UI |

---

## Aturan Dependensi Antar Domain (Cross-Domain Dependency Rule)
- `auth.repo.ts` diperbolehkan mengimpor `usersTable` dari `user/user.model.ts`
- Arah dependensi: auth → user (satu arah, tidak boleh sebaliknya)

---

## Strategi Cookie Autentikasi
- Lingkungan Pengembangan (Dev): `SameSite=Lax`, `Secure=false`
- Lingkungan Produksi (Prod): `SameSite=None`, `Secure=true`
- Cookie diset di `auth.service.ts` dan dikonfigurasikan di folder `config/`
