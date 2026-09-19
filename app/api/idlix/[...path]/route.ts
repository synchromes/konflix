import { NextRequest, NextResponse } from "next/server";
import { signedMediaPath } from "@/lib/mediaProxy";
import { clientKey, rateLimit } from "@/lib/rateLimit";

const BASE =
  process.env.IDLIX_API_URL?.replace(/\/$/, "") || "http://localhost:4000/api";

// Hanya endpoint yang benar-benar dipakai aplikasi. Selain ini ditolak, supaya
// proxy tidak menjadi jendela terbuka ke seluruh permukaan API upstream.
const ALLOWED_ROOTS = new Set([
  "featured",
  "movie",
  "series",
  "cinemaxxi",
  "leaderboard",
  "search",
  "genre",
  "year",
  "country",
  "network",
]);

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Stream CDN tidak mengirim CORS, jadi semua URL media di respons stream dialihkan
// ke /api/media (bertanda tangan) sebelum dikirim ke browser.
function proxyizeStreamPayload(payload: Json): Json {
  const data = isRecord(payload.data) ? payload.data : null;
  if (!data) return payload;

  const rewriteUrl = (value: unknown): unknown =>
    typeof value === "string" && /^https?:\/\//i.test(value) ? signedMediaPath(value) : value;

  const next: Json = { ...data };
  next.streamUrl = rewriteUrl(data.streamUrl);

  if (Array.isArray(data.sources)) {
    next.sources = data.sources.map((s) => {
      if (typeof s === "string") return rewriteUrl(s);
      if (isRecord(s)) {
        return {
          ...s,
          file: rewriteUrl(s.file),
          src: rewriteUrl(s.src),
        };
      }
      return s;
    });
  }

  for (const key of ["subtitles", "tracks"] as const) {
    if (Array.isArray(data[key])) {
      next[key] = (data[key] as unknown[]).map((t) => {
        if (!isRecord(t)) return t;
        return {
          ...t,
          url: rewriteUrl(t.url),
          file: rewriteUrl(t.file),
          src: rewriteUrl(t.src),
          path: rewriteUrl(t.path),
        };
      });
    }
  }

  return { ...payload, data: next };
}

// Proxy /api/idlix/* -> IDLIX-API/* agar frontend bebas CORS.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const limit = await rateLimit(`idlix:${clientKey(req)}`, 300, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        success: false,
        data: [],
        message: `Terlalu banyak permintaan ke API. Coba lagi dalam ${limit.retryAfterSec} detik.`,
      },
      { status: 429, headers: { "cache-control": "no-store" } }
    );
  }

  const { path } = await ctx.params;
  const segments = path ?? [];
  const root = segments[0] ?? "";
  if (!ALLOWED_ROOTS.has(root)) {
    return NextResponse.json(
      { success: false, data: [], message: "Endpoint API tidak dikenal." },
      { status: 404, headers: { "cache-control": "no-store" } }
    );
  }

  const isStream = segments[segments.length - 1] === "stream";
  const target = `${BASE}/${segments.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  try {
    const upstream = await fetch(target, {
      ...(isStream
        ? { cache: "no-store" as const }
        : { next: { revalidate: 1800 } }),
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json";

    if (isStream) {
      if (!upstream.ok) {
        return new NextResponse(await upstream.text(), {
          status: upstream.status,
          headers: { "content-type": contentType, "cache-control": "no-store" },
        });
      }
      const json = (await upstream.json().catch(() => null)) as Json | null;
      const body = json ? proxyizeStreamPayload(json) : { success: false, data: null };
      return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
    }

    const text = await upstream.text();

    // Kegagalan upstream tidak boleh ikut ter-cache, kalau tidak satu error
    // sesaat akan tersaji sebagai "judul tidak ada" selama 30 menit.
    let failed = !upstream.ok;
    if (!failed) {
      try {
        const parsed = JSON.parse(text) as { success?: boolean };
        failed = parsed?.success === false;
      } catch {
        // respons non-JSON: biarkan apa adanya
      }
    }

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": contentType,
        "cache-control": failed
          ? "no-store"
          : "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    // Detail teknis (termasuk base URL internal) hanya dicatat di server.
    console.error("[api/idlix] upstream tidak reachable:", e);
    return NextResponse.json(
      {
        success: false,
        data: [],
        message: "Server tidak merespons. Periksa koneksi lalu coba lagi.",
      },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }
}
