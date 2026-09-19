# HANDOFF — Baleflix (konflix.my.id)

Dokumen serah-terima sesi. Baca file ini dulu sebelum mengubah apa pun.

## 1. Arsitektur

```
Browser → Next.js baleflix (:4001, pm2 "baleflix", nginx 443 konflix.my.id)
  ├─ SSR/list          → http://localhost:4000/api (docker idlix-api)
  ├─ /api/idlix/*      → proxy ke idlix-api (bebas CORS)
  ├─ /api/media?src=.. → proxy stream CDN, HMAC-signed (STREAM_PROXY_SECRET)
  └─ /_next/image      → DINONAKTIFKAN (unoptimized:true), gambar direct TMDB

idlix-api (:4000, docker, hanya 127.0.0.1) → stealth (:8191, Go, hanya 127.0.0.1)
  → upstream https://z2.idlixku.com → CDN (majorplay.net, g*.website, dsb.)
```

- Repo frontend: `github.com/synchromes/konflix` (backup; repo `baleflix` tidak dipakai).
- Backend: `/var/www/idlix-api` (source) + `stealth-source/` (Go, jarang disentuh).

## 2. Environment

| Var | VPS | Lokal |
|---|---|---|
| `IDLIX_API_URL` | `http://localhost:4000/api` | `http://localhost:4000/api` via `ssh -N -L 4000:localhost:4000 user@IP-VPS` |
| `SITE_URL` | `https://www.konflix.my.id` | `http://localhost:4001` |
| `STREAM_PROXY_SECRET` | random, tetap (jangan share) | generate sendiri (`openssl rand -hex 32`) |
| `STEALTH_API_URL` | default `127.0.0.1:8191` | tidak wajib |

`.env.local` tidak pernah di-commit. Lihat `.env.example`.

## 3. Yang sudah diperbaiki (sesi Sep 2026)

**Backend** (`/var/www/idlix-api/source` → rebuild `idlix-api:local` → `docker compose up -d api`):
- `scraper.js mapApiItem()`: unwrap `{contentType, content:{...}}` milik `/api/homepage`; kenal `tv_series`; deteksi series tanpa contentType via `firstAirDate/numberOfSeasons`; tolak item tanpa slug (dulu `movie/undefined`); tahun fallback `firstAirDate`.
- `GET /series/trending/:page` (service+controller+route) — sebelumnya 404, halaman /series jatuh ke mode contoh.
- `catalog.service browseAdvanced()` + `GET /movie|/series/browse` (filter kombinasi genre+country+year+network, sort allowlist, pagination asli upstream).
- Stream langkah 6 (redeem majorplay) via Stealth, bukan Node fetch langsung.
- `NODE_OPTIONS=--dns-result-order=ipv4first` di `docker-compose.yml` (host tanpa rute IPv6).

**Frontend** (`/var/www/baleflix`, `npm run build` + `pm2 restart baleflix --update-env`):
- Player baru `components/player/` (config resilien, `usePlayerEngine` + rebuild penuh, muted autoplay, error jujur, `onStreamExhausted`, `onEnded`); hls-first (native hanya bila tanpa MSE); `Watch*Client` + `UpNext` (autoplay episode +8 detik).
- `/api/media`: undici 2x → Stealth (teks) → **curl subprocess (semua konten)** → 502; logika respons disatukan (`respondUpstream`); Range divalidasi ketat; header curl via file sementara (BUKAN `-D /dev/stderr`, deterministik exit 23 bila dua pipe!).
- Gambar: `images.unoptimized:true` (optimizer 500 massal karena egress flaky).
- Hero: backdrop w1280 asli (fetch detail, cache 2 jam) + portrait di HP + auto-slide 8 dtk + usap + fallback upscale w780.
- Beranda: rail 12 item, `grid-cols-[minmax(0,1fr)]` (grid blowout!), `ScrollRow` bersama (usap + panah), `ContinueWatching` (riwayat + posisi), tanpa snap (gulir bebas) + `overscroll-x-contain`.
- Filter advanced (`FilterBar` dropdown kustom + `FilterableListing` + `GenreCombined` mpage/spage + halaman `/genre` indeks); genre & negara dari API live (drama-korea/anime = 0 hasil di upstream, JANGAN di-hardcode); pagination pakai `hasNext` backend.
- Search Netflix-like (kolom besar, debounce URL, jelajah trending, hitungan = kartu via `filterUsableItems`, grid vertikal).
- Mobile: BottomNav ikon outline SVG, search navbar expandable.
- Halaman watch sinematik (ambient glow, max-w-5xl); `StreamPrewarm` di detail (rantai 18 dtk → 0,09 dtk via cache 15 mnt).
- `CastAvatar` (siluet bila foto kosong/gagal) + seksi Pemeran di series.
- Footer/teks gaya streaming (tanpa kata IDLIX/docker/pembelajaran di UI).
- Scrollbar global gelap ramping; `NODE_OPTIONS=--dns-result-order=ipv4first` tersimpan di pm2 (`pm2 save` sudah).
- `.env.example` (template aman push).

## 4. Jebakan yang sudah dipetakan (baca sebelum debug)

1. **Cloudflare throttling fingerprint Node** (penyebab 502 intermiten): edge kadang SYN-drop / 403 ke fetch Node, curl & Go lolos. Bukti: tcpdump. Solusi: jalur berlapis di `/api/media` + retry hls.js. Kalau kambuh massal, cek `tcpdump port 443` dan `pm2 logs`.
2. **Host tanpa rute IPv6** (`ping6` unreachable) padahal DNS kasih AAAA → Happy Eyeballs stall. Jangan hapus `NODE_OPTIONS`/`ipv4first`.
3. **curl `-D /dev/stderr` + `-o -` di bawah execFile = exit 23 deterministik.** Selalu pakai file header sementara.
4. **Grid blowout**: rail di dalam `display:grid` butuh `minmax(0,1fr)` / `min-w-0`, kalau tidak halaman yang melebar.
5. **`group` Tailwind bertingkat** (rail + kartu) memicu zoom sebaris → kartu pakai `group/card`.
6. **Restart pm2 HANYA setelah build hijau** (pernah 502 gara-gara restart saat build merah).
7. **Token GitHub sekali pakai**: hapus dari PAT list + `~/.bash_history` setelah dipakai.
8. Commit sebagai `synchromes <36370160+synchromes@users.noreply.github.com>` agar contributor tercatat benar. Push backup via token HTTPS (`konflix` remote SSH milik ilham, tanpa akses).

## 5. Perintah operasional

```bash
# Frontend (di /var/www/baleflix)
npm run typecheck && npm run lint && npm run build
export NODE_OPTIONS=--dns-result-order=ipv4first
pm2 restart baleflix --update-env   # JANGAN bila build merah
pm2 logs baleflix --lines 50        # ekor error

# Backend (di /var/www/idlix-api)
node --check source/src/lib/scraper.js   # ganti path sesuai file
docker build -t idlix-api:local ./source
docker compose up -d api
curl -s localhost:4000/api/featured | head -c 300

# Git backup
git add -A && git commit -m "..."   # pastikan .env.local tak ikut
# push via token HTTPS sekali pakai, lalu bersihkan
```

## 6. Diketahui / belum dikerjakan

- Series horor/thriller = 0 di upstream (data, bukan bug).
- `network` filter upstream kadang longgar (mis. `scifi` salah slug → 0; slug benar `science-fiction`).
- Segmen biner hanya lewat undici/curl (Stealth merusak biner via JSON string).
- Signed media URL kedaluwarsa ±6 jam (normal; buka ulang halaman watch).
- Warning console `Permissions-Policy: attribution-reporting…` = noise Chrome, abaikan.
