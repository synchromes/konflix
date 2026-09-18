import { NextRequest, NextResponse } from "next/server";
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
  try {
    const upstream = await fetch(src, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "user-agent": UPSTREAM_UA,
        accept: "*/*",
        ...(process.env.STREAM_REFERER ? { referer: process.env.STREAM_REFERER } : {}),
        ...(range ? { range } : {}),
      },
    });

    const contentType = upstream.headers.get("content-type") ?? "";

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      // Teruskan status asli supaya pemain bisa membedakan 403 / 404 / 504.
      return new NextResponse(body.slice(0, 500) || `Sumber stream menolak permintaan (HTTP ${upstream.status}).`, {
        status: upstream.status,
        headers: {
          "content-type": contentType || "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-media-status": String(upstream.status),
        },
      });
    }

    const looksPlaylist = isPlaylistBody("", contentType, src);
    if (looksPlaylist || contentType.includes("json")) {
      const text = await upstream.text();
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

    const bytes = await upstream.arrayBuffer();
    const headers = new Headers({
      "content-type": contentType || "application/octet-stream",
      "cache-control": "no-store",
    });
    for (const key of ["content-range", "accept-ranges", "content-length"]) {
      const v = upstream.headers.get(key);
      if (v) headers.set(key, v);
    }
    return new NextResponse(bytes, { status: 200, headers });
  } catch (e) {
    console.error("[api/media] gagal mengambil", src, e);
    return fail(502, "Tidak bisa menghubungi sumber stream. Coba lagi beberapa saat lagi.");
  }
}
