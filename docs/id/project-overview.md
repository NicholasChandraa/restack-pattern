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

| Lapisan (Layer) | Teknologi                                                            |
| --------------- | -------------------------------------------------------------------- |
| Frontend        | Next.js (App Router)                                                 |
| Backend         | Hono                                                                 |
| Database ORM    | Drizzle ORM                                                          |
| Database        | PostgreSQL (Neon)                                                    |
| Validasi        | Zod (dibagi bersama antara FE ↔ BE)                                  |
| Autentikasi     | JWT di dalam cookie httpOnly                                         |
| Monorepo        | pnpm workspaces (dapat ditambahkan Turborepo jika diperlukan)        |
| Deploy Frontend | Penyedia hosting statis mana pun (Vercel, Netlify, Cloudflare Pages) |
| Deploy Backend  | Penyedia hosting Node.js mana pun (Railway, Render, Fly.io, VPS)     |

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
components/                   # Komponen global (e.g. RequireAuth) dan UI (Shadcn)
├── ui/                       # Komponen atomik Shadcn (Button, Input, dll.)
├── require-auth.tsx
lib/
├── api-client.ts             # Client RPC Hono (hc<AppType>)
└── utils.ts                  # Integrasi tailwind-merge (fungsi cn)
hooks/                        # Hook global (e.g. useAuthMutation)
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
| ------------------------ | -------- | ------ |
| Development              | Lax      | false  |
| Production               | None     | true   |

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

## Fitur Utama: Structured & Correlation Logging

Monorepo ini mengimplementasikan **logging terstruktur siap produksi (production-ready structured logging)** menggunakan **Pino** dan middleware Hono:

- **Correlation ID (Request ID)**: UUID acak unik dihasilkan secara otomatis untuk setiap request HTTP yang masuk via middleware bawaan Hono `requestId`.
- **Contextual Request Logger**: Logger turunan spesifik request (`logger.child({ requestId })`) diikat ke context Hono. Semua log di sepanjang alur request tersebut akan otomatis membawa `requestId` yang sama, mempermudah pelacakan (tracing) log di produksi tanpa tercampur aduk.
- **Integrasi Konteks User**: Middleware autentikasi secara otomatis menyisipkan context `userId` ke dalam child logger setelah login terverifikasi. Setiap log yang dicetak di dalam rute terproteksi akan otomatis membawa label user yang melakukan request.
- **Pino + Pino-Pretty**: Output berformat JSON satu baris yang terstruktur di lingkungan produksi (sangat ideal untuk aggregator log seperti BetterStack/Logtail, Axiom, Datadog) dan format visual berwarna yang mudah dibaca di lingkungan lokal (development).

---

## Struktur Folder

```
restack-pattern/
├── frontend/                         # Next.js → deploy ke hosting statis mana pun
│   ├── app/                          # Hanya untuk routing
│   ├── components/                   # Komponen global & UI
│   ├── lib/                          # Pustaka & utilitas global (api-client, cn)
│   ├── hooks/                        # Hook global
│   └── domains/                      # Fitur-fitur Semi-DDD
│       ├── auth/
│       └── user/
│
├── backend/                          # Hono → deploy ke hosting Node.js mana pun
│   └── src/
│       ├── config/
│       ├── infra/                    # Koneksi database & middleware HTTP
│       │   ├── db/
│       │   └── middlewares/
│       ├── utils/                    # Utilitas global (logger)
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
