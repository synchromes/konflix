import { NextRequest, NextResponse } from "next/server";
import { resolveKinds, type Kind } from "@/lib/idlix";
import { clientKey, rateLimit } from "@/lib/rateLimit";

// Label `type` di endpoint list upstream tidak bisa dipercaya (series sering
// dilabeli movie). Endpoint ini memverifikasi jenis sebenarnya lewat detail
// movie/series — dipakai halaman pencarian supaya label & tautan kartu benar.
export const dynamic = "force-dynamic";

const MAX_SLUGS = 24;

export async function GET(req: NextRequest) {
  const limit = await rateLimit(`kind:${clientKey(req)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { kinds: {}, message: `Terlalu banyak permintaan verifikasi. Coba lagi dalam ${limit.retryAfterSec} detik.` },
      { status: 429, headers: { "cache-control": "no-store" } }
    );
  }

  const raw = req.nextUrl.searchParams.get("slugs") ?? "";
  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 200)
    .slice(0, MAX_SLUGS);

  if (slugs.length === 0) {
    return NextResponse.json({ kinds: {} }, { headers: { "cache-control": "no-store" } });
  }

  const preferred: Kind = req.nextUrl.searchParams.get("prefer") === "series" ? "series" : "movie";
  const kinds = await resolveKinds(slugs, preferred);

  return NextResponse.json(
    { kinds },
    { headers: { "cache-control": "private, max-age=300" } }
  );
}
