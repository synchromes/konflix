"use client";

import { useRef } from "react";
import Link from "next/link";
import type { ContentItem, Kind } from "@/lib/idlix";
import ContentCard from "./ContentCard";

export default function Rail({
  title,
  items,
  href,
  kind,
}: {
  title: string;
  items: ContentItem[];
  href?: string;
  kind?: Kind;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!items || items.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 560, behavior: "smooth" });
  };

  // Tombol geser tampil saat hover, tapi juga saat fokus keyboard (focus-visible)
  // dan selalu tampil di perangkat sentuh — sebelumnya hanya bisa dijangkau mouse.
  const buttonClass =
    "absolute top-1/3 z-10 rounded-full bg-black/70 px-3 py-2 text-white ring-1 ring-white/20 hover:bg-red-600 group-hover:block focus-visible:block max-md:block hidden";

  return (
    <section className="relative">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-lg font-bold text-white sm:text-xl">{title}</h2>
        {href ? (
          <Link href={href} className="text-xs font-medium text-zinc-400 hover:text-white">
            Lihat semua →
          </Link>
        ) : null}
      </div>
      <div className="group relative">
        <button onClick={() => scroll(-1)} aria-label="Geser kiri" className={`${buttonClass} -left-2`}>
          ‹
        </button>
        <div ref={ref} className="no-scrollbar rail-scroll flex gap-3 overflow-x-auto pb-1">
          {items.map((it, idx) => (
            <ContentCard key={`${it.slug ?? it.title}-${idx}`} item={it} kind={kind} />
          ))}
        </div>
        <button onClick={() => scroll(1)} aria-label="Geser kanan" className={`${buttonClass} -right-2`}>
          ›
        </button>
      </div>
    </section>
  );
}
