import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isPlaylistBody,
  isProxyableMediaUrl,
  rewritePlaylist,
  verifyMediaPath,
} from "@/lib/mediaProxy";
import { clientKey, rateLimit } from "@/lib/rateLimit";

// Proxy media stream (manifest HLS, key, segmen, subtitle).
// Dilewatkan lewat origin aplikasi karena CDN sumber tidak mengirim header CORS,
// sehingga browser menolak memuat manifest secara langsung. URL wajib bertanda
// tangan (lihat lib/mediaProxy.ts) agar route ini tidak menjadi open-proxy.

export const dynamic = "force-dynamic";

const UPSTREAM_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const MAX_TEXT_BYTES = 8 * 1024 * 1024;

function fail(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const limit = await rateLimit(`media:${clientKey(req)}`, 1500, 60_000);
  if (!limit.ok) {
    return fail(429, `Terlalu banyak permintaan media. Coba lagi dalam ${limit.retryAfterSec}s.`);
  }

  const src = req.nextUrl.searchParams.get("src") ?? "";
  const exp = Number(req.nextUrl.searchParams.get("exp") ?? 0);
  const sig = req.nextUrl.searchParams.get("sig") ?? "";

  const verified = verifyMediaPath(src, exp, sig);
  if (!verified.ok) return fail(403, `Permintaan media ditolak: ${verified.reason}.`);
  if (!isProxyableMediaUrl(src)) return fail(403, "Host media tidak diizinkan.");

  const range = req.headers.get("range");
  // Egress server (Node fetch) ke CDN yang diproteksi Cloudflare flaky:
  // jendela throttling membuat fetch langsung ETIMEDOUT/403 intermiten,
  // sementara curl dan Stealth-service (Go) selalu lolos. Strateginya:
  // 1. Coba fetch langsung 2x (jalur cepat bila CDN sedang longgar).
  // 2. Fallback via Stealth untuk konten TEKS (manifest/subtitle/key/JSON).
  //    Stealth mengembalikan body sebagai string JSON — aman untuk teks,
  //    tetapi bisa merusak biner, jadi segmen biner tidak lewat sini.
  // 3. Fallback via curl (subproses) untuk SEMUA konten — fingerprint TLS
  //    curl tidak pernah kena throttling yang menimpa fetch Node.
  // 4. Segmen yang masih gagal mengandalkan retry hls.js di sisi klien.
  const MAX_ATTEMPTS = 2;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetchMedia(src, range, controller.signal);
      clearTimeout(timeout);
      return res;
    } catch (e) {
      clearTimeout(timeout);
      lastError = e;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  if (isStealthTextFallbackable(src) && !range) {
    try {
      const res = await fetchMediaViaStealth(src);
      if (res) return res;
    } catch (e) {
      lastError = e;
    }
  }
  try {
    return await fetchMediaViaCurl(src, range);
  } catch (e) {
    lastError = e;
  }
  console.error("[api/media] gagal mengambil", src, lastError);
  return fail(502, "Tidak bisa menghubungi sumber stream. Coba lagi beberapa saat lagi.");
}

// Konten teks: playlist HLS, manifest JSON, subtitle, key.
// Deteksi dari URL karena fallback dipanggil sebelum content-type diketahui.
function isStealthTextFallbackable(src: string): boolean {
  if (isPlaylistBody("", "", src)) return true;
  return /\.(json|vtt|srt|key)($|\?)/i.test(src);
}

const STEALTH_API_URL =
  process.env.STEALTH_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8191";

function stealthContentType(src: string): string {
  if (/\.vtt($|\?)/i.test(src)) return "text/vtt; charset=utf-8";
  if (/\.srt($|\?)/i.test(src)) return "text/plain; charset=utf-8";
  if (/\.key($|\?)/i.test(src)) return "application/octet-stream";
  return "application/json; charset=utf-8";
}

// Ambil body TEKS via Stealth-service (egress Go, kebal throttling yang
// menimpa fetch Node). Mengembalikan null bila Stealth juga gagal — pemanggil
// lalu merespons 502 seperti biasa.
async function fetchMediaViaStealth(src: string): Promise<NextResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${STEALTH_API_URL}/v1/request`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: src,
        method: "GET",
        headers: { accept: "*/*", "user-agent": UPSTREAM_UA },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      status?: string;
      solution?: { status?: number; response?: string };
    } | null;
    const status = json?.solution?.status ?? 0;
    const text = json?.solution?.response ?? "";
    if (json?.status !== "ok" || status < 200 || status >= 300 || !text) return null;
    if (text.length > MAX_TEXT_BYTES) return fail(502, "Manifest stream terlalu besar.");
    // Manifest HLS ditulis ulang (segmen -> /api/media bertanda tangan),
    // sisanya (JSON/vtt/key) diteruskan apa adanya.
    if (isPlaylistBody(text, "", src)) {
      return new NextResponse(rewritePlaylist(text, src), {
        status: 200,
        headers: {
          "content-type": "application/vnd.apple.mpegurl",
          "cache-control": "no-store",
        },
      });
    }
    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": stealthContentType(src), "cache-control": "no-store" },
    });
  } catch (e) {
    console.error("[api/media] fallback stealth gagal untuk", src, e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMedia(src: string, range: string | null, signal: AbortSignal) {
  try {
    const upstream = await fetch(src, {
      cache: "no-store",
      redirect: "follow",
      signal,
      headers: {
        "user-agent": UPSTREAM_UA,
        accept: "*/*",
        ...(process.env.STREAM_REFERER ? { referer: process.env.STREAM_REFERER } : {}),
        ...(range ? { range } : {}),
      },
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    const bytes = await upstream.arrayBuffer();
    return respondUpstream(
      src,
      upstream.status,
      contentType,
      (name) => upstream.headers.get(name),
      Buffer.from(bytes)
    );
  } catch (e) {
    // Gagal di tengah membaca body (bukan saat connect) — lempar ke retry loop.
    throw e;
  }
}

// Bentuk generik respons upstream agar jalur fetch langsung dan curl
// memakai logika respons yang sama (teruskan status asli, tulis ulang
// playlist, teruskan header range).
function respondUpstream(
  src: string,
  status: number,
  contentType: string,
  getHeader: (name: string) => string | null,
  body: Buffer
): NextResponse {
  if (status < 200 || status >= 300) {
    const text = body.length < 2048 ? body.toString("utf-8") : "";
    // Teruskan status asli supaya pemain bisa membedakan 403 / 404 / 504.
    return new NextResponse(text.slice(0, 500) || `Sumber stream menolak permintaan (HTTP ${status}).`, {
      status,
      headers: {
        "content-type": contentType || "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-media-status": String(status),
      },
    });
  }

  const looksPlaylist = isPlaylistBody("", contentType, src);
  if (looksPlaylist || contentType.includes("json")) {
    const text = body.toString("utf-8");
    if (text.length > MAX_TEXT_BYTES) return fail(502, "Manifest stream terlalu besar.");
    if (isPlaylistBody(text, contentType, src)) {
      return new NextResponse(rewritePlaylist(text, src), {
        status: 200,
        headers: {
          "content-type": "application/vnd.apple.mpegurl",
          "cache-control": "no-store",
        },
      });
    }
    // Bukan playlist: teruskan apa adanya (mis. manifest JSON milik sumber).
    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": contentType || "application/json", "cache-control": "no-store" },
    });
  }

  const headers = new Headers({
    "content-type": contentType || "application/octet-stream",
    "cache-control": "no-store",
  });
  for (const key of ["content-range", "accept-ranges", "content-length"]) {
    const v = getHeader(key);
    if (v) headers.set(key, v);
  }
  // Salin ke ArrayBuffer murni agar cocok dengan tipe BodyInit.
  const ab = new ArrayBuffer(body.byteLength);
  new Uint8Array(ab).set(body);
  return new NextResponse(ab, { status: 200, headers });
}

// Fallback terakhir via curl (subproses): fingerprint TLS curl tidak kena
// throttling Cloudflare yang menimpa fetch Node — terbukti stabil di semua
// pengujian. Header Range divalidasi ketat agar tidak bisa disalahgunakan.
//
// Catatan: header respons ditulis ke file sementara, BUKAN `-D /dev/stderr` —
// kombinasi `-D <pipe>` + `-o <pipe>` deterministik gagal (curl exit 23) saat
// stdout+stderr keduanya pipe (kasus execFile). Body tetap lewat stdout.
function fetchMediaViaCurl(src: string, range: string | null): Promise<NextResponse> {
  const args = [
    "-sS",
    "-L",
    "--max-time",
    "40",
    "--noproxy",
    "*",
    "-A",
    UPSTREAM_UA,
    "-H",
    "accept: */*",
  ];
  if (range && /^bytes=\d*-\d*$/.test(range)) args.push("-H", `Range: ${range}`);
  if (process.env.STREAM_REFERER) args.push("--referer", process.env.STREAM_REFERER);

  const dir = mkdtempSync(join(tmpdir(), "kmedia-"));
  const headerFile = join(dir, "headers.txt");
  args.push("-D", headerFile, "-o", "-", "--", src);

  return new Promise((resolve, reject) => {
    execFile("/usr/bin/curl", args, { encoding: "buffer", maxBuffer: 128 * 1024 * 1024 }, (err, stdout, stderr) => {
      try {
        if (err) {
          reject(err);
          return;
        }
        // File berisi blok header (satu per redirect); pakai yang terakhir.
        const blocks = readFileSync(headerFile, "latin1")
          .split("\r\n\r\n")
          .filter((b) => /^HTTP\//i.test(b.trim()));
        const last = blocks[blocks.length - 1] ?? "";
        const lines = last.split("\r\n").map((l) => l.trim()).filter(Boolean);
        const status = Number((lines[0] ?? "").split(" ")[1] ?? 0);
        if (!Number.isFinite(status) || status <= 0) {
          reject(new Error(`curl: tidak ada status HTTP (stderr: ${String(stderr).slice(0, 200)})`));
          return;
        }
        const headers = new Map<string, string>();
        for (const line of lines.slice(1)) {
          const idx = line.indexOf(":");
          if (idx > 0) headers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
        }
        const body = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? "");
        resolve(
          respondUpstream(src, status, headers.get("content-type") ?? "", (name) => headers.get(name) ?? null, body)
        );
      } catch (e) {
        reject(e);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
}
