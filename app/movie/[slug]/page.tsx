import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Rail from "@/components/Rail";
import WatchButton from "@/components/WatchButton";
import StreamPrewarm from "@/components/StreamPrewarm";
import CastAvatar from "@/components/CastAvatar";
import TrailerButton from "@/components/TrailerButton";
import ApiNotice from "@/components/ApiNotice";
import { filterUsableItems, resolveKind, serverIdlix, youtubeId } from "@/lib/idlix";
import { asContentItemArray } from "@/lib/upstream";

// Caching halaman ini berada di level fetch (lihat `next: { revalidate }` pada
// serverIdlix), bukan di level route, karena semua slug dirender dinamis.

interface Detail {
  title?: string;
  year?: number;
  runtimeMinutes?: number;
  runtime?: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  genres?: string[];
  country?: string;
  language?: string;
  director?: { name?: string };
  cast?: Array<{ name?: string; character?: string; image?: string }>;
  trailer?: string;
  recommendations?: unknown[];
  slug?: string;
}

async function getDetail(slug: string): Promise<Detail | null> {
  const json = await serverIdlix<Detail>(`/movie/${encodeURIComponent(slug)}`, { revalidate: 7200 });
  const data = json?.data as Detail | undefined;
  return data?.title ? data : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDetail(slug);
  if (!d?.title) return { title: "Judul tidak ditemukan" };
  const description = typeof d.overview === "string" && d.overview ? d.overview.slice(0, 200) : undefined;
  return {
    title: `${d.title}${d.year ? ` (${d.year})` : ""}`,
    description,
    openGraph: {
      title: String(d.title),
      description,
      images: d.backdrop ? [String(d.backdrop)] : d.poster ? [String(d.poster)] : undefined,
      type: "video.movie",
    },
  };
}

export default async function MovieDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const json = await serverIdlix<Detail>(`/movie/${encodeURIComponent(slug)}`, { revalidate: 7200 });
  const d = json?.data as Detail | undefined;
  // Self-healing: label upstream sering salah — kalau ternyata series, alihkan.
  if (!d?.title) {
    const kind = await resolveKind(slug, "movie");
    if (kind === "series") redirect(`/series/${encodeURIComponent(slug)}`);
    notFound();
  }

  const title = String(d.title ?? slug);
  const trailer = youtubeId(d.trailer);
  const recs = filterUsableItems(asContentItemArray(d.recommendations));
  const cast = Array.isArray(d.cast) ? d.cast.slice(0, 12) : [];

  return (
    <div className="pb-10">
      <div className="relative -mx-4 -mt-16 overflow-hidden sm:-mx-6">
        <div className="relative h-[52vh] min-h-[380px]">
          {d.backdrop ? (
            <Image src={String(d.backdrop)} alt={title} fill priority className="object-cover" sizes="100vw" />
          ) : (
            <div className="h-full bg-zinc-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/50 to-transparent" />
        </div>
      </div>

      <ApiNotice show={!json?.success} />

      <div className="-mt-32 flex flex-col gap-6 sm:flex-row">
        <div className="relative mx-auto h-[300px] w-[200px] shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15 sm:mx-0">
          {d.poster ? <Image src={String(d.poster)} alt={title} fill className="object-cover" sizes="200px" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
            {d.year ? <span className="rounded bg-white/10 px-2 py-1">{String(d.year)}</span> : null}
            {d.runtimeMinutes ? <span className="rounded bg-white/10 px-2 py-1">{d.runtimeMinutes} mnt</span> : null}
            {d.country ? <span className="rounded bg-white/10 px-2 py-1">{String(d.country)}</span> : null}
            {d.language ? <span className="rounded bg-white/10 px-2 py-1">{String(d.language)}</span> : null}
          </p>
          {Array.isArray(d.genres) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {d.genres.map((g) => (
                <Link
                  key={String(g)}
                  href={`/genre/${encodeURIComponent(String(g).toLowerCase().replace(/\s+/g, "-"))}?type=movie`}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:border-red-600 hover:text-white"
                >
                  {String(g)}
                </Link>
              ))}
            </div>
          ) : null}
          {d.overview ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-300">{String(d.overview)}</p> : null}
          {d.director?.name ? (
            <p className="mt-3 text-sm text-zinc-400">
              Sutradara: <span className="text-white">{d.director.name}</span>
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/watch/movie/${encodeURIComponent(slug)}`}
              className="rounded-md bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              ▶ Nonton Sekarang
            </Link>
            <WatchButton
              item={{
                slug,
                title,
                poster: d.poster ? String(d.poster) : undefined,
                backdrop: d.backdrop ? String(d.backdrop) : undefined,
                year: d.year,
                type: "movie",
                overview: d.overview ? String(d.overview) : undefined,
              }}
            />
            {trailer ? <TrailerButton trailerId={trailer} title={title} /> : null}
          </div>
          {/* Siapkan stream di background selagi membaca sinopsis. */}
          <StreamPrewarm path={`/movie/${encodeURIComponent(slug)}/stream`} />
        </div>
      </div>

      {cast.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-white">Pemeran</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {cast.map((c, i) => (
              <div key={`${c.name ?? "pemain"}-${i}`} className="w-28 shrink-0 text-center">
                <CastAvatar image={typeof c.image === "string" ? c.image : undefined} name={String(c.name ?? "?")} />
                <p className="mt-2 truncate text-xs font-semibold text-white">{c.name}</p>
                {c.character ? <p className="truncate text-[11px] text-zinc-400">{c.character}</p> : null}
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
