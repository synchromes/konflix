"use client";

import type { ContentItem } from "@/lib/idlix";
import { itemSlug } from "@/lib/idlix";
import { toggleWatchlist, useIsInWatchlist } from "@/lib/store";

export default function WatchButton({ item }: { item: ContentItem }) {
  const slug = itemSlug(item);
  const saved = useIsInWatchlist(slug);

  return (
    <button
      onClick={() => toggleWatchlist(item)}
      aria-pressed={saved}
      className={`rounded-md px-6 py-2.5 text-sm font-semibold ring-1 transition ${
        saved
          ? "bg-white/10 text-white ring-white/25 hover:bg-white/20"
          : "bg-white text-black ring-white hover:bg-zinc-200"
      }`}
    >
      {saved ? "✓ Daftar Saya" : "+ Daftar Saya"}
    </button>
  );
}
