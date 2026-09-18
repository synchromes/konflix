import { redirect } from "next/navigation";
import WatchSeriesClient from "@/components/WatchSeriesClient";
import { resolveKindInfo } from "@/lib/idlix";

export default async function WatchSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string; episode?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const season = clampPositive(Number(sp.season ?? 1), 1);
  const episode = clampPositive(Number(sp.episode ?? 1), 1);
  // Self-healing: kalau ternyata movie, alihkan sebelum menunggu stream.
  const info = await resolveKindInfo(slug, "series");
  if (info?.kind === "movie") redirect(`/watch/movie/${encodeURIComponent(slug)}`);
  return (
    <WatchSeriesClient
      key={`${slug}-${season}-${episode}`}
      slug={slug}
      season={season}
      episode={episode}
      title={info?.title}
      poster={info?.poster || undefined}
    />
  );
}

// Nilai season/episode dari query string dipakai untuk menyusun URL upstream,
// jadi harus dibatasi ke bilangan bulat positif yang wajar.
function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const int = Math.floor(value);
  return int >= 1 && int <= 100 ? int : fallback;
}
