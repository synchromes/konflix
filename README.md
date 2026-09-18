# Baleflix

Antarmuka streaming film & series ala Netflix yang mengambil katalog dan stream dari
[IDLIX-API](https://github.com/idlix-api) (repo terpisah, dijalankan via Docker).

> **Peringatan.** Sumber kontennya adalah hasil scraping situs tanpa lisensi distribusi.
> Proyek ini untuk pembelajaran/pribadi — jangan dipublikasikan atau dipakai komersial.

## Prasyarat

- Node.js >= 22.6 (script `test` memakai test runner bawaan Node dengan type-stripping)
- IDLIX-API berjalan lokal, biasanya di `http://localhost:4000/api`

## Menjalankan

```bash
npm install
cp .env.example .env.local   # sesuaikan bila port API berbeda
npm run dev                  # http://localhost:4001
```

Tanpa IDLIX-API, aplikasi tetap bisa dibuka: halaman listing menampilkan **data contoh**
(`lib/mock.ts`) disertai peringatan. Kalau API hidup tetapi hasilnya memang kosong, aplikasi
menampilkan *empty state* jujur — bukan data contoh.

## Environment

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `IDLIX_API_URL` | `http://localhost:4000/api` | Base URL IDLIX-API (server-side saja). |
| `SITE_URL` | `http://localhost:4001` | URL publik aplikasi, untuk metadata absolut. |
| `STREAM_PROXY_SECRET` | acak per-proses | Secret HMAC untuk URL media di `/api/media`. Isi agar stabil lintas restart/instance. |
| `STREAM_REFERER` | (kosong) | Referer yang dikirim saat mengambil manifest/segmen stream. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | (kosong) | Opsional: rate limit dibagi lintas instance. Kalau kosong, limiter in-memory per instance dipakai. |

Catatan: port aplikasi (4001) dan port API (4000) berbeda; `npm run dev` sudah di-set ke 4001.

## Script

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Dev server di port 4001 |
| `npm run build` / `npm start` | Build & jalankan versi produksi |
| `npm run lint` | ESLint (harus hijau) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit test parser (`node --test`) |

## Arsitektur

```
app/
  page.tsx                 beranda (hero + rail)
  film, series             listing berhalaman
  genre, year, country,
  network                  listing per filter
  movie|series/[slug]      halaman detail (self-healing movie <-> series)
  watch/movie|series/...   pemutar
  api/idlix/[...path]      proxy JSON ke IDLIX-API (allowlist + rate limit)
  api/media                proxy manifest/segmen/subtitle (URL bertanda tangan)
  api/kind                 verifikasi batch movie-vs-series
  error, not-found, loading, global-error   boundary UI
components/                UI (VideoPlayer, Hero, Rail, BrowseResults, PagedListing, ...)
lib/                       idlix (fetch & parser), store (localStorage), seasons, mediaProxy, rateLimit
```

### Mengapa ada dua proxy?

1. **`/api/idlix/*`** — agar browser tidak kena CORS saat memanggil API, path dibatasi
   allowlist, ada rate limit, dan respons gagal tidak pernah di-cache.
2. **`/api/media`** — CDN stream (mis. `e2e.majorplay.net`) **tidak mengirim header CORS**,
   jadi manifest/segmen/subtitle tidak bisa dimuat langsung dari browser. Route ini mengambil
   kontennya di sisi server, menulis ulang URI di dalam playlist HLS agar semuanya tetap
   lewat origin aplikasi, dan hanya menerima URL yang ditandatangani HMAC (`lib/mediaProxy.ts`)
   supaya tidak menjadi open-proxy.

### Kuirk sumber data yang sudah ditangani

- `/featured` mengembalikan entri tanpa judul (`endpoint: movie/undefined`) → difilter `pickList`,
  hero memakai rantai fallback.
- `/series/trending` (tanpa nomor halaman) kosong; yang berfungsi `/series/trending/:page`.
- `/cinemaxxi` identik dengan `/movie/trending` → tidak dipakai lagi agar tidak ada rail kembar.
- Label `type` di endpoint list sering salah (series dilabeli movie) → `resolveKind`/`/api/kind`
  memverifikasi ke detail, dan halaman detail/watch otomatis mengalihkan ke jenis yang benar.
- URL stream adalah `config-*.json` milik CDN, bukan `*.m3u8`, dan tokennya kedaluwarsa → proxy
  memaksa `Content-Type: application/vnd.apple.mpegurl` saat isinya benar-benar playlist.
- Jeda ±15–20 detik sebelum URL stream keluar dari API — pemutar menampilkan progres tunggu.

## Keamanan

- Respons diberi header `Content-Security-Policy` (lihat `next.config.ts`), `nosniff`,
  `Referrer-Policy`, `X-Frame-Options`, dan `Permissions-Policy`; header `x-powered-by` dimatikan.
- CSP masih memakai `'unsafe-inline'` untuk script karena Next menyisipkan payload RSC inline.
  Nonce lewat middleware bisa membuatnya lebih ketat, tetapi belum diterapkan.
- `/api/idlix` dibatasi allowlist endpoint; `/api/media` hanya menerima URL bertanda tangan HMAC
  dan menolak host internal/loopback.

## Batasan yang diketahui

- Rate limit in-memory per instance secara default; isi env Upstash untuk membaginya lintas instance.
- Tidak ada autentikasi/akun; daftar saya, riwayat, dan progres disimpan di `localStorage`
  perangkat (tersinkron antar-tab, bukan antar-perangkat).
- CI ada di `.github/workflows/ci.yml` (lint + typecheck + test + build), tetapi direktori ini
  belum menjadi repo git sehingga workflow belum aktif. Tanpa CI, jalankan
  `npm run lint && npm run typecheck && npm test` secara manual sebelum merge.
