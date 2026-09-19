"use client";

import Link from "next/link";
import { useState } from "react";
import Player from "@/components/player/Player";
import UpNext from "@/components/UpNext";
import { useStream } from "@/lib/useStream";

export default function WatchSeriesClient({
  slug,
  season,
  episode,
  title,
  poster,
}: {
  slug: string;
  season: number;
  episode: number;
  title?: string;
  poster?: string;
}) {
  const { loading, url, subs, meta, error, elapsed, retry } = useStream({
    path: `/series/${encodeURIComponent(slug)}/season/${season}/episode/${episode}/stream`,
    slug,
    title,
    poster,
    kind: "series",
    href: `/series/${slug}`,
    season,
    episode,
  });
  const [finished, setFinished] = useState(false);
  const nextHref = `/watch/series/${encodeURIComponent(slug)}?season=${season}&episode=${episode + 1}`;

  return (
    <div className="relative -mx-4 -mt-16 px-4 pb-10 pt-20 sm:-mx-6 sm:px-6">
      {/* cahaya ambient dari poster agar halaman terasa sinematik */}
      {poster ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="h-full w-full scale-125 object-cover opacity-20 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-[#0a0a0a]/85 to-[#0a0a0a]" />
        </div>
      ) : null}
      <div className="relative mx-auto max-w-5xl">
      <Link href={`/series/${encodeURIComponent(slug)}`} className="text-sm text-zinc-400 hover:text-white">
        ← Kembali ke detail
      </Link>
      <h1 className="mt-2 text-xl font-bold text-white">
        {title ?? slug.replace(/-/g, " ")} — S{season} E{episode}
      </h1>
      {meta ? <p className="mt-1 text-xs text-zinc-400">{meta}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {episode > 1 ? (
          <Link
            href={`/watch/series/${encodeURIComponent(slug)}?season=${season}&episode=${episode - 1}`}
            className="rounded-md border border-white/15 px-3 py-1.5 hover:bg-white/10"
          >
            ← E{episode - 1}
          </Link>
        ) : null}
        <Link
          href={nextHref}
          className="rounded-md bg-red-600 px-3 py-1.5 font-semibold hover:bg-red-700"
        >
          E{episode + 1} →
        </Link>
        <Link
          href={`/series/${encodeURIComponent(slug)}#episode`}
          className="rounded-md border border-white/15 px-3 py-1.5 text-zinc-300 hover:bg-white/10"
        >
          Semua episode
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
          <p className="text-lg font-bold text-white">
            Menyiapkan stream S{season} E{episode}… ({elapsed}s)
          </p>
          <p className="mt-2 text-sm text-zinc-400">Jeda keamanan ±15–20 detik. Jangan tutup halaman.</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/50 p-4 text-sm text-red-200">
          <p>{error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={retry}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              Coba lagi
            </button>
            <Link
              href={`/watch/movie/${encodeURIComponent(slug)}`}
              className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Buka sebagai Film →
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && url ? (
        <div className="mt-4">
          <Player
            key={`${slug}-${season}-${episode}`}
            src={url}
            subtitles={subs}
            slug={slug}
            season={season}
            episode={episode}
            poster={poster}
            onStreamExhausted={retry}
            onEnded={() => setFinished(true)}
          />
          {finished ? (
            <UpNext
              key={nextHref}
              href={nextHref}
              label={`${title ?? slug.replace(/-/g, " ")} — S${season} E${episode + 1}`}
            />
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  );
}
