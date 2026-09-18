"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import TrailerModal from "@/components/TrailerModal";
import type { ContentItem } from "@/lib/idlix";
import { itemDetailHref, itemKind, itemSlug, itemTitle, kindLabel, youtubeId } from "@/lib/idlix";

export default function Hero({ items }: { items: ContentItem[] }) {
  const [idx, setIdx] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);

  const item = items[Math.min(idx, Math.max(0, items.length - 1))];
  if (!item) return null;

  const kind = itemKind(item);
  const slug = itemSlug(item);
  const title = itemTitle(item);
  const trailer = youtubeId(item.trailer);
  const backdrop = String(item.backdrop ?? item.poster ?? "");
  const overview = String(item.overview ?? "").trim();
  const watchHref =
    kind === "series"
      ? `/watch/series/${encodeURIComponent(slug)}?season=1&episode=1`
      : `/watch/movie/${encodeURIComponent(slug)}`;

  return (
    <section className="relative -mx-4 -mt-16 overflow-hidden sm:-mx-6">
      <div className="relative h-[78vh] min-h-[520px] w-full">
        {backdrop ? (
          <Image src={backdrop} alt={title} fill priority className="object-cover" sizes="100vw" />
        ) : (
          <div className="h-full w-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/40 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-red-500">
            #{idx + 1} Sorotan • {kindLabel(kind)}
          </p>
          <h1 className="max-w-2xl text-4xl font-black leading-tight text-white sm:text-6xl">{title}</h1>
          {overview ? (
            <p
              className="mt-3 max-w-xl text-sm text-zinc-300 sm:text-base"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {overview}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-300">
            {item.year ? <span className="rounded bg-white/10 px-2 py-1">{String(item.year)}</span> : null}
            {item.rating ? <span className="text-yellow-400">★ {String(item.rating)}</span> : null}
            {Array.isArray(item.genres) ? <span>{item.genres.slice(0, 3).join(" • ")}</span> : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={watchHref} className="rounded-md bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700">
              ▶ Nonton
            </Link>
            <Link
              href={itemDetailHref(item)}
              className="rounded-md bg-white/15 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
            >
              Detail
            </Link>
            {trailer ? (
              <button
                onClick={() => setShowTrailer(true)}
                className="rounded-md border border-white/20 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Trailer
              </button>
            ) : null}
          </div>

          {items.length > 1 ? (
            <div className="mt-6 flex gap-2">
              {items.slice(0, 6).map((slide, i) => (
                <button
                  key={itemSlug(slide) || i}
                  aria-label={`Slide ${i + 1}: ${itemTitle(slide)}`}
                  aria-current={i === idx}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition ${i === idx ? "w-8 bg-red-600" : "w-4 bg-white/30 hover:bg-white/60"}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <TrailerModal
        trailerId={showTrailer ? trailer : null}
        title={title}
        onClose={() => setShowTrailer(false)}
      />
    </section>
  );
}
