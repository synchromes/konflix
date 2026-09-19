"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ContentItem, Kind } from "@/lib/idlix";
import { itemDetailHref, itemKind, itemPoster, itemSlug, itemTitle, kindLabel } from "@/lib/idlix";

export default function ContentCard({
  item,
  kind,
  kindPending = false,
  eager = false,
}: {
  item: ContentItem;
  kind?: Kind;
  /** true = jenis belum diverifikasi; jangan tampilkan label Film/Series. */
  kindPending?: boolean;
  /** true untuk kartu di atas lipatan supaya tidak ikut lazy-load (LCP). */
  eager?: boolean;
}) {
  const slug = itemSlug(item);
  const [imgFailed, setImgFailed] = useState(false);
  if (!slug) return null;
  const poster = imgFailed ? "" : itemPoster(item);
  const title = itemTitle(item);
  const resolved = itemKind(item, kind);
  const meta = [item.year, kindPending ? undefined : kindLabel(resolved)].filter(Boolean).join(" • ");

  return (
    <Link
      href={itemDetailHref(item, kind)}
      className="group/card w-[140px] shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10 transition hover:ring-red-600 sm:w-[168px]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes="168px"
            className="object-cover transition duration-300 group-hover/card:scale-105"
            loading={eager ? "eager" : "lazy"}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-zinc-400">
            {title}
          </div>
        )}
        {item.rating ? (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-yellow-400">
            ★ {String(item.rating)}
          </span>
        ) : null}
      </div>
      <div className="p-2">
        <p className="truncate text-[13px] font-medium text-zinc-100">{title}</p>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-400">{meta}</p>
      </div>
    </Link>
  );
}
