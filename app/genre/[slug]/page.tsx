import { Suspense } from "react";
import Link from "next/link";
import FilterableListing from "@/components/FilterableListing";
import GenreCombined from "@/components/GenreCombined";
import type { Kind } from "@/lib/idlix";

function parseKind(value?: string): Kind | undefined {
  return value === "movie" || value === "series" ? value : undefined;
}

function pretty(slug: string): string {
  return slug.replace(/-/g, " ");
}

// Tanpa ?type=: gabungan film + series. Dengan ?type=: tampilan penuh per tipe.
export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const kind = parseKind(sp.type);

  return (
    <Suspense fallback={<div className="py-8 text-sm text-zinc-400">Memuat…</div>}>
      {kind ? (
        <>
          <FilterableListing
            title={`Genre: ${pretty(slug)}`}
            kind={kind}
            hrefBase={`/genre/${encodeURIComponent(slug)}`}
            lockedGenre={slug}
          />
          <div className="mt-2 flex gap-2 pb-8 text-xs">
            <span className="self-center text-zinc-400">Lihat sebagai:</span>
            <Link
              href={`/genre/${encodeURIComponent(slug)}`}
              className="rounded-full border border-white/15 px-3 py-1 text-zinc-300 hover:border-red-600 hover:text-white"
            >
              Film & Series
            </Link>
          </div>
        </>
      ) : (
        <GenreCombined slug={slug} title={`Genre: ${pretty(slug)}`} />
      )}
    </Suspense>
  );
}
