# Panduan Pengembangan

Panduan praktis untuk bekerja di repositori ini sehari-hari: fungsi dari setiap folder, bagaimana pnpm workspaces menghubungkannya, cara menjalankan dan menguji proyek secara lokal, cara men-deploy templat, dan cara mempublikasikan CLI saat Anda siap. Untuk aturan arsitektur (Semi-DDD, aturan impor lintas domain, desain autentikasi), silakan lihat `CLAUDE.md` — panduan ini berfokus pada *alur kerja (workflow)*, sedangkan dokumen tersebut berfokus pada *aturan arsitektur*.

## 1. Struktur Proyek

```
restack-pattern/
├── frontend/                          Next.js 16 (App Router) — frontend dari templat
├── backend/                           Hono + Drizzle ORM — backend dari templat
├── packages/
│   ├── shared/                       Zod schemas — diimpor oleh frontend dan backend
│   └── create-restack-pattern/       CLI (npx create-restack-pattern) — lihat Bagian 5
└── docs/                             Dokumentasi perencanaan & arsitektur (termasuk file ini)
```

Ada dua hal yang mudah tertukar:

- **`frontend/` dan `backend/` bukan sekadar contoh** — keduanya adalah aplikasi full-stack nyata yang berfungsi (autentikasi, manajemen session, dan domain `user`) yang dapat Anda deploy sendiri, sekaligus menjadi sumber data yang disalin oleh CLI.
- **`packages/create-restack-pattern/template/`** (tidak ditampilkan di atas karena di-gitignore) adalah *salinan hasil generate* dari `frontend/`, `backend/`, dan `packages/shared/` yang dihasilkan oleh skrip sinkronisasi. Anda tidak boleh mengedit folder ini secara langsung. Lihat Bagian 5.

## 2. Dasar-dasar pnpm Workspace

File `pnpm-workspace.yaml` di root repositori mencantumkan folder mana saja yang menjadi anggota workspace:
`frontend`, `backend`, `packages/*`. Setiap anggota memiliki `package.json` sendiri dengan nama paketnya masing-masing (misal: `@restack/shared`, `create-restack-pattern`) — pnpm membaca properti `name` tersebut, bukan nama foldernya, saat Anda menjalankan perintah target.

Pola perintah yang akan sering Anda gunakan:

```bash
pnpm --filter <package-name> <script>
```

Bendera `--filter` mencocokkan field `name` di `package.json` paket tersebut, lalu menjalankan `<script>` (salah satu entri di `"scripts"`) *seolah-olah Anda telah masuk (`cd`) ke dalam folder terkait* — tanpa perlu meninggalkan root repositori. Contoh nyata:

```bash
pnpm --filter backend dev                    # Menjalankan script "dev" milik backend/package.json
pnpm --filter frontend build                  # Menjalankan script "build" milik frontend/package.json
pnpm --filter @restack/shared build           # Catatan: menggunakan nama paket, bukan nama folder ("shared")
pnpm --filter create-restack-pattern sync-template
```

Mengapa menggunakan workspace alih-alih repositori terpisah? Satu perintah `pnpm install` di root akan mengunduh dan mengaitkan dependensi untuk semua paket sekaligus. Selain itu, paket di dalam workspace dapat saling bergantung dengan nama paketnya (`@restack/shared` di dalam `backend/package.json`) dan pnpm akan membuat symlink lokal secara otomatis alih-alih mengambil paket dari registri npm.

Script kemudahan di level root (`pnpm dev`, `pnpm build` — lihat root `package.json`) biasanya menjalankan perintah secara `--parallel` di seluruh paket tanpa urutan topologis. Hal ini memengaruhi satu hal penting berikut:

**`packages/shared` harus di-build terlebih dahulu sebelum backend/frontend dapat menggunakannya.**
File `package.json` di `packages/shared` mengarahkan `main` dan `types` ke folder `dist/` yang masuk dalam daftar gitignore. Pada clone baru, jalankan:
`pnpm --filter @restack/shared build` sekali sebelum menjalankan `backend` / `frontend`, atau biarkan `pnpm --filter @restack/shared dev` (yaitu `tsc --watch`) berjalan di terminal terpisah agar perubahan langsung dikompilasi secara real-time. Jika langkah ini dilewati, impor terhadap `@restack/shared` akan gagal atau menggunakan tipe data yang usang.

## 3. Alur Kerja Pengembangan Lokal (Local Development)

```bash
pnpm install                                   # Jalankan sekali dari root repositori
pnpm --filter @restack/shared build            # Jalankan sekali sebelum start (lihat catatan di atas)
cp backend/.env.example backend/.env           # Salin & isi DATABASE_URL dan JWT_SECRET (min 32 karakter)
pnpm --filter backend db:push                  # Membuat tabel users / auth_sessions di database
pnpm --filter backend dev                      # Menjalankan backend di http://localhost:3001
pnpm --filter frontend dev                     # Menjalankan frontend di http://localhost:3000 (terminal terpisah)
```

Perintah berguna lainnya:

```bash
pnpm --filter backend db:generate              # Menghasilkan file migrasi Drizzle
pnpm --filter backend db:studio                # Membuka Drizzle Studio (visual database GUI)
pnpm --filter backend test                     # Menjalankan pengujian (Vitest): unit + integration
pnpm --filter frontend lint                     # Menjalankan ESLint (hanya di frontend)
```

Pengujian `backend test` akan mengakses database PostgreSQL asli Anda secara lokal (melalui `DATABASE_URL`) untuk integrasi pengujian dan membersihkannya kembali setelah selesai — pastikan untuk mengarahkannya ke database pengembangan yang sekali pakai (disposable), bukan database produksi.

Konfigurasi Cookie dan CORS akan langsung berfungsi di lingkungan lokal secara otomatis (`localhost` cookie-matching + default dev). Jika proses login tidak bertahan, penyebab utamanya hampir selalu karena ketidaksesuaian `FRONTEND_URL` di `backend/.env` dengan URL frontend Anda — bukan masalah atribut cookie. Biarkan `COOKIE_SAME_SITE` dan `COOKIE_DOMAIN` dikomentari di dev; keduanya adalah konfigurasi khusus produksi.

### 3.1. Penulisan Log di Route Handlers (Correlation Logging)

Backend monorepo ini mengimplementasikan pencatatan log terstruktur dengan **Pino** yang menghubungkan log secara langsung ke request HTTP terkait:
- Setiap request ditandai dengan `requestId` unik via middleware `requestId` Hono.
- Child logger spesifik request disimpan di variabel context Hono (`logger`).
- Jika pengguna terautentikasi, middleware `requireAuth` secara otomatis memperkaya child logger tersebut dengan context `userId`.

**Praktik Terbaik (Best Practice)**: Di dalam route handler baru, selalu ambil child logger spesifik request dari context Hono (`c`) dengan fallback ke logger global. Hal ini menjamin bahwa seluruh log yang tercetak di sepanjang request tersebut akan otomatis membawa `requestId` dan `userId` yang sama (sangat mempermudah debugging log di produksi).

```typescript
import { logger } from "../../shared/logger/logger.js"

authRoutes.post("/login", async (c) => {
  const reqLogger = c.get("logger") || logger
  try {
    reqLogger.info("Attempting user login") // Otomatis dilabeli requestId!
    // ...
  } catch (e: any) {
    reqLogger.error({ err: e.message }, "Login failed") // Otomatis dilabeli requestId + userId (jika terautentikasi)!
    return c.json({ error: e.message }, 401)
  }
})
```


## 4. Penjelasan Singkat Arsitektur

Kode dikelompokkan berdasarkan **fitur bisnis (domain)**, bukan tipe file — `backend/src/domains/auth/`, `backend/src/domains/user/`, `frontend/domains/auth/`, dll. Domain backend dibagi menjadi `.routes.ts` (HTTP + validasi), `.service.ts` (logika bisnis), `.repo.ts` (query Drizzle), dan `.model.ts` (definisi tabel). Domain frontend dibagi menjadi `components/`, `hooks/`, dan `services/`. Zod schemas didefinisikan sekali di `packages/shared/src/schemas/` dan diimpor oleh kedua belah pihak. Domain `auth` boleh mengimpor dari `user`, tetapi arah sebaliknya dilarang. Aturan lengkap serta alasan di balik keputusan arsitektur (dual-cookie refresh token, timing-safe login, tanpa `middleware.ts`) dapat dibaca di `CLAUDE.md`.

## 5. Bekerja pada CLI Package (`packages/create-restack-pattern`)

CLI tidak membaca folder `frontend/`, `backend/`, dan `packages/shared` secara langsung saat runtime — CLI membungkus **salinan statis** (`template/`) di dalam paketnya sendiri, mirip dengan cara kerja `create-vite` atau `create-next-app`. Ini berarti ada langkah sinkronisasi setelah Anda mengubah templat master agar perubahan tersebut masuk ke dalam CLI.

Berikut adalah tiga situasi pengembangan CLI:

| Apa yang Anda Ubah | Langkah yang Harus Dilakukan | Mengapa |
|---|---|---|
| Kode `frontend/` atau `backend/` untuk pengembangan lokal biasa | Tidak ada — `pnpm --filter backend dev` / `pnpm --filter frontend dev` sudah berjalan dalam watch mode dan auto-reload. Jika mengubah `packages/shared`, jalankan `pnpm --filter @restack/shared build` (atau jalankan dev/watch mode). | Ini adalah alur kerja pengembangan biasa dan tidak ada hubungannya dengan CLI. |
| Kode di atas, dan Anda ingin folder `template/` lokal milik CLI mencerminkannya (misal untuk menguji hasil scaffolding) | `pnpm --filter create-restack-pattern sync-template` | Ini adalah proses penyalinan (*copy*), bukan kompilasi. Proses ini menyalin ulang isi kode asli ke dalam folder `template/` milik CLI. Jika dilewati, `node dist/index.js <name>` akan menghasilkan templat lama. |
| Anda ingin perubahan tersebut dirilis ke pengguna npm melalui `npx create-restack-pattern` | Naikkan versi (`"version"`) di `packages/create-restack-pattern/package.json`, lalu jalankan `npm publish` | Perintah `prepublishOnly` akan otomatis menjalankan `sync-template` dan `build`, namun npm menolak rilis jika nomor versi tidak dinaikkan terlebih dahulu. Lihat Bagian 7. |

Secara terpisah, jika Anda mengubah logika CLI itu sendiri (`packages/create-restack-pattern/src/index.ts` — skrip scaffolding-nya, bukan isi templatnya), Anda harus melakukan kompilasi TypeScript:
`pnpm --filter create-restack-pattern build` agar isi `dist/index.js` tidak tertinggal dari `src/index.ts`.

Alur kompilasi & pengujian lokal:

```bash
pnpm --filter create-restack-pattern sync-template   # Sinkronisasi folder template/ dari kode sumber utama
pnpm --filter create-restack-pattern build            # Kompilasi src/index.ts -> dist/index.js
node packages/create-restack-pattern/dist/index.js my-test-app   # Uji scaffolding lokal
```

Proses `sync-template` menyalin `frontend/`, `backend/`, `packages/shared/`, root `package.json`, `pnpm-workspace.yaml`, dan `.gitignore` ke dalam folder `template/` — dengan mengabaikan `node_modules`, output build (`dist`, `.next`, `.turbo`, `*.tsbuildinfo`, `next-env.d.ts`), `.vercel`, `.git`, dan file `.env*` kecuali `.env.example`.

**Bagian Penting: File `.gitignore` diganti namanya menjadi `gitignore` (tanpa titik) saat sinkronisasi.**
npm secara default akan mengabaikan dan menghapus file seperti `.git`, `.gitignore`, `.npmignore` dari arsip tarball yang dipublikasikan. Selain itu, npm tetap menggunakan aturan pengecualian dari `.gitignore` sebelum menghapusnya, yang bisa menyebabkan file penting lainnya terlewat. Solusinya: `sync-template.mjs` mengganti nama semua `.gitignore` menjadi `gitignore`, dan CLI `src/index.ts` akan mengembalikannya kembali menjadi `.gitignore` saat melakukan proses scaffolding.

Folder `template/` di-gitignore dan dibuat ulang dari awal setiap kali perintah `sync-template` dijalankan (serta secara otomatis dijalankan sebelum `npm publish` — lihat Bagian 7) — Anda tidak boleh mengedit file di dalam `template/` secara manual.

## 6. Mendeploy Aplikasi Templat

Langkah ini untuk menjalankan aplikasi `frontend` dan `backend` Anda di lingkungan produksi (misal untuk portofolio Fase 3, atau aplikasi hasil scaffold CLI Anda):

1. **Jalankan push schema database** — arahkan `DATABASE_URL` di `backend/.env` ke PostgreSQL produksi Anda, lalu jalankan `pnpm --filter backend db:push` (membuat tabel `users` dan `auth_sessions`). Lakukan ini sebelum deploy pertama karena backend memvalidasi koneksi DB saat cold start.
2. **Buat dua proyek di Vercel**, masing-masing mengarah ke repositori ini dengan `rootDirectory` diset ke `backend` atau `frontend`. Ini memungkinkan proses build melihat seluruh workspace monorepo (diperlukan untuk `packages/shared`) sementara tetap menganggap folder terkait sebagai root aplikasi.

```bash
vercel project add restack-pattern-backend
vercel project add restack-pattern-frontend
```

3. **Backend** — File `backend/vercel.json` sudah terkonfigurasi dengan benar:

```json
{
  "framework": null,
  "installCommand": "pnpm install && pnpm --filter @restack/shared build",
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

Tiga aturan penting pada konfigurasi ini:
- **`framework: null` wajib digunakan.** Vercel akan otomatis mendeteksi Hono dengan mencari berkas `app`/`index`/`server` di root proyek — itulah mengapa entrypoint-nya adalah `backend/src/hono-app.ts`, bukan `app.ts`. Tanpa `framework: null`, Vercel dapat mengabaikan `backend/api/index.ts` dan menyebabkan error 500.
- **File `backend/public/.gitkeep` harus ada.** Vercel tetap membutuhkan direktori output (default `public`) meskipun proyek ini hanya berupa API tanpa aset statik.
- **Build `@restack/shared` di `installCommand`, bukan `buildCommand`.** Perintah build di top-level memberitahu Vercel bahwa proyek ini menghasilkan output statik, yang akan memicu persyaratan direktori output di atas. `installCommand` tidak memicu efek samping ini.

Environment Variables Backend (Produksi): `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL` (URL proyek frontend Anda), serta `LOG_FILE_PATH` (opsional untuk menyimpan log ke berkas). Deploy dari **root repositori**, bukan di dalam folder backend agar workspace pnpm ikut terbawa:

```bash
vercel deploy --cwd . --project restack-pattern-backend --yes --prod
```

4. **Frontend** — Atur environment variable `NEXT_PUBLIC_API_URL` dengan URL backend Anda *sebelum* build (`NEXT_PUBLIC_*` akan ditanam saat kompilasi). Jalankan perintah deploy yang sama:

```bash
vercel deploy --cwd . --project restack-pattern-frontend --yes --prod
```

5. **Smoke Test** — Jalankan `curl https://<backend>.vercel.app/` yang harus mengembalikan `{"status":"ok"}`. Pada browser: daftar akun baru, pastikan Anda masuk ke `/dashboard`, dan klik ke halaman `/profile`. Untuk menguji refresh flow secara spesifik: buka DevTools → Application → Cookies → hapus cookie `access_token` saja (biarkan `refresh_token`) → segarkan (reload) halaman. Halaman harus tetap dapat diakses (kegagalan 401 saat memanggil `/api/user/me` pertama kali akan memicu endpoint `/api/auth/refresh` secara otomatis, lalu mengulangi request asli dengan token baru).

## 7. Mempublikasikan CLI ke npm

Publikasi dilakukan langsung dari terminal Anda menggunakan perintah `npm publish` di dalam folder `packages/create-restack-pattern`:

```bash
npm login                              # Jalankan sekali per mesin; buka browser untuk autentikasi
npm publish                            # Mempublikasikan paket secara publik ke npm
```

Script `prepublishOnly` di `package.json` akan otomatis menjalankan `sync-template` dan `build` terlebih dahulu agar folder `template/` dan `dist/` tidak tertinggal.

**Kenaikan Versi**: npm menolak publikasi dengan nomor versi yang sama. Naikkan properti `"version"` di `package.json` sebelum melakukan rilis baru (ikuti aturan semver: patch untuk perbaikan bug, minor untuk opsi scaffolding baru yang tidak merusak, major untuk perubahan besar yang dapat merusak proyek scaffold sebelumnya).

Setelah mempublikasikan, uji paket rilis asli tersebut:

```bash
npx create-restack-pattern@latest beberapa-nama-uji-coba
```

Ini akan mengunduh dari registri npm asli untuk memastikan entri `bin` berjalan dengan baik dan file `.gitignore` terbentuk dengan benar (bukan sebagai placeholder file `gitignore`).

## 8. Pemeliharaan (Maintenance)

- **Menjaga Sinkronisasi Templat**: Perubahan pada `frontend/`, `backend/`, atau `packages/shared/` hanya akan masuk ke CLI setelah perintah `sync-template` dijalankan. Ini berjalan otomatis sebelum publish, namun harus dijalankan manual saat melakukan pengujian lokal.
- **Pembaruan Dependensi**: Jalankan `pnpm outdated` di root untuk melihat dependensi yang tertinggal; jalankan `pnpm update` untuk memperbaruinya. Lakukan pembaruan dependensi di `packages/shared` secara hati-hati karena perubahannya akan berdampak langsung pada frontend dan backend.
- **Daftar Keputusan Terbuka**: Masalah dan langkah pengembangan tertunda lainnya (seperti penanganan reuse-detection pada refresh token, pembersihan otomatis session yang kedaluwarsa, pemilihan package manager lewat prompt CLI, dll.) dicatat di `docs/concerns.md`.

## 9. Pemecahan Masalah (Troubleshooting)

| Gejala Masalah | Kemungkinan Penyebab | Solusi Perbaikan |
|---|---|---|
| Impor `@restack/shared` gagal atau menggunakan tipe data yang usang | Folder `dist/` milik `shared` belum di-build | Jalankan `pnpm --filter @restack/shared build`, atau jalankan dev/watch mode saat melakukan pengeditan. |
| Error `'tsc' is not recognized` saat menjalankan kompilasi CLI | Dependensi `node_modules` belum diinstal | Jalankan `pnpm install` dari root repositori terlebih dahulu. |
| Sesi Login tidak bertahan di pengembangan lokal | Nilai `FRONTEND_URL` di `.env` backend tidak cocok dengan URL frontend yang Anda buka | Sesuaikan nilai `FRONTEND_URL`. Ini adalah masalah pemeriksaan asal (Origin check) CORS/CSRF, bukan masalah atribut cookie. |
| Hasil `npm pack` / `npm publish` melewatkan file tertentu | File bernama `.gitignore` dibaca oleh npm sebagai aturan pengecualian publikasi | Jalankan kembali `sync-template`. Pastikan file dotfile disalin dengan nama alternatif sebelum dikemas oleh npm. |
| CLI menghasilkan proyek tanpa file `.gitignore` | File kompilasi `dist/index.js` tertinggal dari logika penggantian nama di `src/index.ts` | Jalankan `pnpm --filter create-restack-pattern build`, lalu coba kembali proses scaffolding. |
