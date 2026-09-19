import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Rail from "@/components/Rail";
import WatchButton from "@/components/WatchButton";
import TrailerButton from "@/components/TrailerButton";
import EpisodeSelector from "@/components/EpisodeSelector";
import StreamPrewarm from "@/components/StreamPrewarm";
import CastAvatar from "@/components/CastAvatar";
import ApiNotice from "@/components/ApiNotice";
import { filterUsableItems, resolveKind, serverIdlix, youtubeId } from "@/lib/idlix";
import { parseSeasons } from "@/lib/seasons";
import { asContentItemArray, asString, asStringArray, readDetail } from "@/lib/upstream";

async function getDetail(slug: string): Promise<Record<string, unknown> | null> {
  const json = await serverIdlix<unknown>(`/series/${encodeURIComponent(slug)}`, { revalidate: 7200 });
  const data = readDetail(json?.data);
  return data && typeof data.title === "string" && data.title ? data : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDetail(slug);
  if (!d) return { title: "Series tidak ditemukan" };
  const overview = typeof d.overview === "string" ? d.overview : "";
  const poster = typeof d.poster === "string" ? d.poster : typeof d.backdrop === "string" ? d.backdrop : "";
  return {
    title: `${String(d.title)}${d.year ? ` (${String(d.year)})` : ""}`,
    description: overview ? overview.slice(0, 200) : undefined,
    openGraph: {
      title: String(d.title),
      description: overview ? overview.slice(0, 200) : undefined,
      images: poster ? [poster] : undefined,
      type: "video.tv_show",
    },
  };
}

export default async function SeriesDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const json = await serverIdlix<unknown>(`/series/${encodeURIComponent(slug)}`, { revalidate: 7200 });
  const d = readDetail(json?.data);
  // Self-healing: kalau ternyata movie, alihkan.
  if (!d || typeof d.title !== "string" || !d.title) {
    const kind = await resolveKind(slug, "series");
    if (kind === "movie") redirect(`/movie/${encodeURIComponent(slug)}`);
    notFound();
  }

  const title = asString(d.title) || asString(d.name) || slug;
  const poster = asString(d.poster) || asString(d.image);
  const backdrop = asString(d.backdrop) || poster;
  const overview = asString(d.overview);
  const genres = asStringArray(d.genres) ?? [];
  const trailer = youtubeId(d.trailer);
  const recs = filterUsableItems(asContentItemArray(d.recommendations));
  const cast = Array.isArray(d.cast)
    ? (d.cast as Array<{ name?: unknown; character?: unknown; image?: unknown }>).slice(0, 12)
    : [];

  // Season & episode pertama yang benar-benar tersedia, bukan asumsi "S1 E1".
  const seasons = parseSeasons(d);
  const firstSeason = seasons[0];
  const firstEpisode = firstSeason?.episodes[0] ?? 1;
  const watchHref = `/watch/series/${encodeURIComponent(slug)}?season=${firstSeason?.num ?? 1}&episode=${firstEpisode}`;

  return (
    <div className="pb-10">
      <div className="relative -mx-4 -mt-16 overflow-hidden sm:-mx-6">
        <div className="relative h-[52vh] min-h-[380px]">
          {backdrop ? (
            <Image src={backdrop} alt={title} fill priority className="object-cover" sizes="100vw" />
          ) : (
            <div className="h-full bg-zinc-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/50 to-transparent" />
        </div>
      </div>

      <ApiNotice show={!json?.success} />

      <div className="-mt-32 flex flex-col gap-6 sm:flex-row">
        <div className="relative mx-auto h-[300px] w-[200px] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15 sm:mx-0">
          {poster ? <Image src={poster} alt={title} fill className="object-cover" sizes="200px" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
            {d.year ? <span className="rounded bg-white/10 px-2 py-1">{String(d.year)}</span> : null}
            <span className="rounded bg-white/10 px-2 py-1">Series</span>
            {typeof d.country === "string" ? <span className="rounded bg-white/10 px-2 py-1">{d.country}</span> : null}
          </p>
          {genres.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {genres.map((g) => (
                <Link
                  key={String(g)}
                  href={`/genre/${encodeURIComponent(String(g).toLowerCase().replace(/\s+/g, "-"))}?type=series`}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:border-red-600 hover:text-white"
                >
                  {String(g)}
                </Link>
              ))}
            </div>
          ) : null}
          {overview ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-300">{overview}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={watchHref}
              className="rounded-md bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              ▶ Nonton S{firstSeason?.num ?? 1} E{firstEpisode}
            </Link>
            <WatchButton item={{ slug, title, poster, backdrop, type: "series", overview }} />
            {trailer ? <TrailerButton trailerId={trailer} title={title} /> : null}
          </div>
          {/* Siapkan episode pertama di background selagi membaca sinopsis. */}
          <StreamPrewarm
            path={`/series/${encodeURIComponent(slug)}/season/${firstSeason?.num ?? 1}/episode/${firstEpisode}/stream`}
          />
        </div>
      </div>

      <EpisodeSelector key={slug} slug={slug} detail={d} initialSeason={firstSeason?.num} />

      {cast.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-white">Pemeran</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {cast.map((c, i) => (
              <div key={`${String(c.name ?? "pemain")}-${i}`} className="w-28 shrink-0 text-center">
                <CastAvatar image={typeof c.image === "string" ? c.image : undefined} name={String(c.name ?? "?")} />
                <p className="mt-2 truncate text-xs font-semibold text-white">{String(c.name ?? "?")}</p>
                {typeof c.character === "string" && c.character ? (
                  <p className="truncate text-[11px] text-zinc-400">{c.character}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {recs.length > 0 ? (
        <div className="mt-10">
          <Rail title="Rekomendasi" items={recs} />
        </div>
      ) : null}
    </div>
  );
}
