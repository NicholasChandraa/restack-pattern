# RestackPattern — Ringkasan Proyek

## Apa itu RestackPattern?

Sebuah CLI scaffolding tool yang dapat men-generate monorepo full-stack secara instan.

```bash
npx create-restack-pattern
```

Perintah ini akan men-generate monorepo yang siap digunakan untuk produksi (production-ready) menggunakan teknologi Next.js + Hono + Drizzle ORM, terstruktur dengan arsitektur Semi-DDD (Feature-Driven), serta konfigurasi cookie autentikasi yang andal langsung dari awal.

---

## Masalah yang Dipecahkan

1. **Kejenuhan menulis boilerplate** — developer sering membuang waktu berjam-jam untuk menata struktur dasar yang sama di setiap proyek baru.
2. **Kendala CORS & Cookie** — autentikasi sering kali rusak ketika frontend dan backend di-deploy di domain yang berbeda di lingkungan produksi.

---

## Tech Stack

| Lapisan (Layer) | Teknologi |
|---|---|
| Frontend | Next.js (App Router) |
| Backend | Hono |
| Database ORM | Drizzle ORM |
| Database | PostgreSQL (Neon) |
| Validasi | Zod (dibagi bersama antara FE ↔ BE) |
| Autentikasi | JWT di dalam cookie httpOnly |
| Monorepo | pnpm workspaces (dapat ditambahkan Turborepo jika diperlukan) |
| Deploy Frontend | Penyedia hosting statis mana pun (Vercel, Netlify, Cloudflare Pages) |
| Deploy Backend | Penyedia hosting Node.js mana pun (Railway, Render, Fly.io, VPS) |

---

## Arsitektur: Semi-DDD (Feature-Driven)

Kode dikelompokkan berdasarkan **fitur bisnis (domain)**, bukan berdasarkan tipe file teknis.

### Backend (Hono)

Setiap domain memiliki tepat 4 file utama:

```
domains/[feature]/
├── [feature].routes.ts    # Endpoint HTTP, validasi input
├── [feature].service.ts   # Hanya logika bisnis (business logic)
├── [feature].repo.ts      # Hanya query database (Drizzle)
└── [feature].model.ts     # Definisi tabel database (Drizzle)
```

**Aturan Lapisan (Layer Rules):**
- `routes` → Memvalidasi input (menggunakan Zod schema dari `@restack/shared`), memanggil service, mengembalikan response HTTP.
- `service` → Menangani logika bisnis saja, tidak pernah menyentuh DB secara langsung.
- `repo` → Menangani query Drizzle saja, tidak mengandung logika bisnis.
- `model` → Hanya mendefinisikan struktur tabel Drizzle.

### Frontend (Next.js)

```
app/                          # HANYA untuk routing (merender komponen domain)
shared/
├── components/ui/            # Komponen atomik Shadcn (Button, Input, dll.)
├── lib/api-client.ts         # Client RPC Hono
└── hooks/                    # Hook global
domains/[feature]/
├── components/               # UI khusus untuk fitur terkait
├── hooks/                    # Logika state + fetching data
├── services/                 # Panggilan HTTP ke backend
└── types.ts                  # Definisi tipe lokal
```

**Aturan Lapisan (Layer Rules):**
- `app/page.tsx` → Hanya merender komponen domain utama, tidak mengandung logika UI lainnya.
- `components` → Hanya merender UI saja, tidak melakukan fetching data secara langsung.
- `hooks` → Menangani logika + state, tidak melakukan panggilan HTTP secara langsung.
- `services` → Hanya melakukan panggilan HTTP, tidak menangani logika UI.

---

## Fitur Utama: Cookie Autentikasi yang Andal (Bulletproof Auth Cookies)

Konfigurasi cookie beradaptasi secara otomatis dengan lingkungan:

| Lingkungan (Environment) | SameSite | Secure |
|---|---|---|
| Development | Lax | false |
| Production | None | true |

Hal ini mengeliminasi masalah autentikasi yang paling umum terjadi ketika frontend dan backend di-deploy ke domain yang berbeda.

---

## Fitur Utama: Type Safety Ujung-ke-Ujung (End-to-End Type Safety)

Zod schemas didefinisikan satu kali di dalam `packages/shared/src/schemas` dan dibagikan ke backend maupun frontend. Jika schema berubah, error TypeScript akan langsung muncul pada kedua sisi secara instan — tidak perlu sinkronisasi manual.

```
packages/shared/src/schemas/auth.schema.ts
         ↙                        ↘
backend/src/domains/...     frontend/domains/...
```

---

## Struktur Folder

```
restack-pattern/
├── frontend/                         # Next.js → deploy ke hosting statis mana pun
│   ├── app/                          # Hanya untuk routing
│   ├── shared/                       # Kode global yang dapat digunakan kembali
│   └── domains/                      # Fitur-fitur Semi-DDD
│       ├── auth/
│       └── user/
│
├── backend/                          # Hono → deploy ke hosting Node.js mana pun
│   └── src/
│       ├── config/
│       ├── shared/
│       │   ├── db/
│       │   └── middlewares/
│       ├── domains/                  # Fitur-fitur Semi-DDD
│       │   ├── auth/
│       │   └── user/
│       └── index.ts
│
├── packages/
│   └── shared/                       # Zod schemas (FE ↔ BE)
│
└── package.json                      # Workspace root pnpm
```

---

## Rencana Perjalanan (Roadmap)

### Fase 1 — Master Template
Membangun monorepo secara manual. Mengimplementasikan domain Auth dari ujung-ke-ujung (register, login, logout). Deploy ke Vercel + Railway. Memverifikasi bahwa cookie berfungsi di produksi.

### Fase 2 — CLI
Mengubah master template menjadi script CLI yang dapat dijalankan melalui `npx create-restack-pattern`.

### Fase 3 — Portofolio & Layanan Premium
Menggunakan CLI ini untuk membuat portofolio pribadi. CLI itu sendiri akan menjadi karya portofolio terkuat — bukti keterampilan setingkat Software Architect.
