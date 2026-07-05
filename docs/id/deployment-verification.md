# Cookie & Deployment

Panduan tentang bagaimana cookie autentikasi dikonfigurasikan di seluruh pengembangan lokal dan produksi, serta langkah-langkah untuk melakukan deploy ke Vercel. Telah diverifikasi pada 2026-07-04 (`restack-pattern-backend.vercel.app` + `restack-pattern-frontend.vercel.app`, database PostgreSQL melalui integrasi Neon Vercel).

## Tanpa Server-side Auth Gate — Cek di Sisi Client (Client-side Check)

Berbeda dengan templat Next.js pada umumnya, proyek ini **tidak menggunakan berkas `middleware.ts` atau `proxy.ts`**. Halaman yang dilindungi akan memeriksa status autentikasi di sisi client — `frontend/domains/user/hooks/use-profile.ts` dan `frontend/components/require-auth.tsx` memanggil `GET /api/user/me` saat komponen dimuat (on mount) dan mengarahkan pengguna ke `/login` jika gagal.

Langkah ini sengaja diambil (lihat peringatan Next.js 16 di `CLAUDE.md`): pemeriksaan keberadaan cookie di server tidak dapat berfungsi saat frontend dan backend berada di domain yang berbeda (kondisi normal pada produksi). Oleh karena itu, daripada mengelola dua perilaku berbeda untuk pengembangan dan produksi, pemeriksaan di sisi client digunakan untuk kedua kondisi. Konsekuensinya: halaman akan dirender terlebih dahulu sebelum dialihkan jika sesi tidak valid, bukan pengalihan SSR instan.

## Pengembangan Lokal (Local Development) — Cookie Langsung Berfungsi

Saat menjalankan `pnpm --filter backend dev` (port 3001) dan `pnpm --filter frontend dev` (port 3000), Anda tidak perlu menyentuh `COOKIE_SAME_SITE` atau `COOKIE_DOMAIN` sama sekali. Hal ini berfungsi tanpa konfigurasi karena:

1. **`localhost` mengabaikan port saat mencocokkan cookie.** Cookie yang disetel oleh backend untuk `localhost` (host-only, tanpa `Domain` eksplisit) akan terlihat oleh frontend yang berjalan di `localhost:3000`, karena browser menyaring cookie berdasarkan nama host (*hostname*), bukan port. Kondisi ini berbeda dengan subdomain seperti `api.example.com` dan `app.example.com` di produksi.
2. **`NODE_ENV=development` memilih default yang aman.** Di `backend/src/domains/auth/auth.routes.ts`: `sameSite` secara default diset ke `Lax` dan `secure` diset ke `false` saat `NODE_ENV` bukan `production`. Atribut `Lax` dikirim pada navigasi tingkat atas dan pada panggilan API antara `localhost:3000` dan `localhost:3001`. Atribut `secure: false` penting karena pengembangan lokal menggunakan HTTP biasa, dan browser akan langsung menolak cookie berlabel `Secure` jika dikirim melalui HTTP tanpa enkripsi.

Jika proses login tidak bertahan di lingkungan lokal, penyebab utamanya adalah `FRONTEND_URL` di `backend/.env` tidak sesuai dengan URL yang Anda buka di browser (pemeriksaan CORS/CSRF membandingkan header `Origin` dengan nilai tersebut) — bukan karena masalah atribut cookie. Biarkan variabel `COOKIE_SAME_SITE` dan `COOKIE_DOMAIN` dikomentari di dev; keduanya adalah opsi khusus produksi.

## Lingkungan Produksi — Dua Skenario

### Skenario A: Frontend dan Backend Berbagi Apex Domain yang Sama (Direkomendasikan)

Contoh: `app.example.com` (frontend) + `api.example.com` (backend), keduanya di bawah domain `example.com` yang Anda miliki.

1. Setel variabel `COOKIE_DOMAIN=.example.com` pada backend.
2. Setel variabel `FRONTEND_URL=https://app.example.com` pada backend.
3. Setel variabel `NEXT_PUBLIC_API_URL=https://api.example.com` pada frontend.
4. Biarkan `COOKIE_SAME_SITE` kosong — secara default bernilai `None` di produksi, dan browser mewajibkan atribut `Secure` saat `SameSite=None` (tidak masalah karena kedua subdomain menggunakan HTTPS).

**Verifikasi**: Masuk ke aplikasi, periksa header `Set-Cookie` dari response login di tab Network DevTools — baik `access_token` maupun `refresh_token` harus menampilkan atribut `Domain=.example.com`.

### Skenario B: Frontend dan Backend di Domain yang Berbeda (Default, Tanpa Setup Tambahan)

Contoh: Menggunakan URL default dari proyek Vercel (`*.vercel.app`) — karena `vercel.app` merupakan *public suffix*, dua proyek berbeda di bawahnya dianggap sebagai domain terdaftar yang berbeda secara hukum keamanan. Kondisi ini sama dengan frontend di Vercel dan backend di Railway (`*.up.railway.app`).

1. **Jangan** setel variabel `COOKIE_DOMAIN` — atribut `Domain` lintas domain akan langsung ditolak oleh browser.
2. Setel variabel `FRONTEND_URL` dan `NEXT_PUBLIC_API_URL` ke domain masing-masing aplikasi seperti biasa.
3. Selesai — tidak ada perbedaan konfigurasi lain dari Skenario A. Pemeriksaan autentikasi sisi client (`fetch(..., {credentials: "include"})`) tetap berfungsi karena browser mengirimkan cookie lintas domain jika atribut `SameSite=None; Secure` aktif (yang sudah terkonfigurasi secara otomatis di produksi). Alasan menggunakan Skenario A hanya untuk faktor estetika nama domain.

Skenario B ini adalah skenario yang diuji dan diverifikasi secara lengkap pada tanggal 2026-07-04.

## Mendeploy ke Vercel, Langkah demi Langkah

Backend dan frontend di-deploy sebagai **dua proyek Vercel yang terpisah** dari satu repositori ini.

**1. Dorong Schema Database (Push DB Schema)** — Arahkan `DATABASE_URL` di `backend/.env` ke PostgreSQL produksi Anda dan jalankan `pnpm --filter backend db:push`. Lakukan ini sebelum deploy pertama karena backend memvalidasi variabel environment secara ketat saat dijalankan.

**2. Buat Dua Proyek Vercel**, masing-masing mengarah ke repositori ini dengan `rootDirectory` disetel ke `backend` atau `frontend`. Ini memungkinkan build melihat seluruh monorepo sementara tetap menganggap folder terkait sebagai root aplikasi.

```bash
vercel project add restack-pattern-backend
vercel project add restack-pattern-frontend
```

**3. Backend** — File `backend/vercel.json` sudah terkonfigurasi dengan benar:

```json
{
  "framework": null,
  "installCommand": "pnpm install && pnpm --filter @restack/shared build",
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

Tiga poin penting konfigurasi ini:
- **`framework: null` wajib.** Vercel mendeteksi Hono dengan mencari berkas `app`/`index`/`server` di root proyek — itulah mengapa entrypoint-nya adalah `backend/src/hono-app.ts`, bukan `app.ts`. Tanpa `framework: null`, Vercel dapat memproses berkas tersebut sebagai fungsi secara langsung dan mengabaikan `backend/api/index.ts`, menghasilkan error 500.
- **File `backend/public/.gitkeep` harus ada.** Direktori output (default `public`) harus ada meskipun proyek ini hanya berupa API tanpa aset statik.
- **Build `@restack/shared` di `installCommand`, bukan `buildCommand`.** Perintah build di top-level memberitahu Vercel bahwa proyek ini menghasilkan output statik, yang akan memicu persyaratan direktori output di atas. `installCommand` menghindari efek samping ini.

Environment Variables Backend (Produksi): `DATABASE_URL`, `JWT_SECRET` (min 32 karakter), `NODE_ENV=production`, `FRONTEND_URL` (URL proyek frontend). Deploy dari **root repositori**, bukan di dalam folder backend agar workspace pnpm ikut terbawa:

```bash
vercel deploy --cwd . --project restack-pattern-backend --yes --prod
```

**4. Frontend** — Atur env var `NEXT_PUBLIC_API_URL` dengan URL backend Anda *sebelum* build dijalankan. Deploy dengan cara yang sama:

```bash
vercel deploy --cwd . --project restack-pattern-frontend --yes --prod
```

**5. Uji Coba (Smoke Test)** — Panggilan `curl https://<backend>.vercel.app/` harus mengembalikan status OK. Di browser: daftar akun baru, pastikan Anda masuk ke `/dashboard`, dan klik ke halaman `/profile`. Untuk menguji refresh flow secara spesifik: hapus cookie `access_token` saja di tab Application DevTools → segarkan halaman — sesi harus tetap aktif tanpa perlu login ulang (401 memicu refresh token otomatis).

## Verifikasi Sukses: Skenario B, Vercel + Vercel + Neon (2026-07-04)

Telah diuji menggunakan curl (dengan header `Origin` disetel ke domain frontend) dan dicoba langsung pada browser:
- Pendaftaran akun menyetel cookie `access_token`/`refresh_token` dengan `SameSite=None; Secure; HttpOnly` tanpa atribut `Domain` (host-only) — sesuai dengan skenario tanpa `COOKIE_DOMAIN`.
- Request `GET /api/user/me` dengan cookie access_token mengembalikan status `200`. Tanpa cookie mengembalikan status `401`.
- Request `POST /api/auth/refresh` menggunakan cookie refresh_token mengembalikan status `200`, menghasilkan refresh_token yang baru (memverifikasi mekanisme rotasi satu kali pakai) dan access_token baru.
- Request ulang ke `/api/user/me` menggunakan access_token baru berhasil mengembalikan data user (status `200`).
- Pada browser: menghapus cookie `access_token` secara manual di halaman `/profile` lalu me-reload halaman berhasil memicu proses refresh token di latar belakang secara transparan dan halaman tetap menampilkan profil user.

*Skenario A (subdomain dengan apex domain yang sama) secara teoretis berfungsi namun belum diverifikasi secara langsung di lingkungan produksi.*
