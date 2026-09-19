"use client";

import Link from "next/link";
import Player from "@/components/player/Player";
import { useStream } from "@/lib/useStream";

export default function WatchMovieClient({
  slug,
  title,
  poster,
}: {
  slug: string;
  title?: string;
  poster?: string;
}) {
  const { loading, url, subs, meta, error, elapsed, retry } = useStream({
    path: `/movie/${encodeURIComponent(slug)}/stream`,
    slug,
    title,
    poster,
    kind: "movie",
    href: `/movie/${slug}`,
  });

  return (
    <div className="relative -mx-4 -mt-16 px-4 pb-10 pt-20 sm:-mx-6 sm:px-6">
      {poster ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="h-full w-full scale-125 object-cover opacity-20 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-[#0a0a0a]/85 to-[#0a0a0a]" />
        </div>
      ) : null}
      <div className="relative mx-auto max-w-5xl">
      <Link href={`/movie/${encodeURIComponent(slug)}`} className="text-sm text-zinc-400 hover:text-white">
        ← Kembali ke detail
      </Link>
      <h1 className="mt-2 text-xl font-bold text-white">{title ?? slug.replace(/-/g, " ")}</h1>
      {meta ? <p className="mt-1 text-xs text-zinc-400">{meta}</p> : null}

      {loading ? (
        <div className="mt-4 rounded-xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
          <p className="text-lg font-bold text-white">Menyiapkan stream… ({elapsed}s)</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
            Sumber menerapkan jeda keamanan ±15–20 detik sebelum URL keluar. Jangan tutup halaman ini.
          </p>
          <div className="mx-auto mt-4 h-2 w-full max-w-md overflow-hidden rounded bg-white/10">
            <div className="h-full animate-pulse bg-red-600" style={{ width: `${Math.min(100, (elapsed / 18) * 100)}%` }} />
          </div>
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
              href={`/watch/series/${encodeURIComponent(slug)}?season=1&episode=1`}
              className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Buka sebagai Series →
            </Link>
          </div>
        </div>
      ) : null}

      {!loading && url ? (
        <div className="mt-4">
          <Player src={url} subtitles={subs} slug={slug} poster={poster} onStreamExhausted={retry} />
        </div>
      ) : null}
      </div>
    </div>
  );
}
