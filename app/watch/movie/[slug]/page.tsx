import { redirect } from "next/navigation";
import WatchMovieClient from "@/components/WatchMovieClient";
import { resolveKindInfo } from "@/lib/idlix";

export default async function WatchMoviePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Self-healing: kalau ternyata series, alihkan sebelum menunggu stream.
  // Sekalian ambil judul & poster asli supaya header dan riwayat tidak menampilkan slug.
  const info = await resolveKindInfo(slug, "movie");
  if (info?.kind === "series") redirect(`/watch/series/${encodeURIComponent(slug)}?season=1&episode=1`);
  return <WatchMovieClient key={slug} slug={slug} title={info?.title} poster={info?.poster || undefined} />;
}
