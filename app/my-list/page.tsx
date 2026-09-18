"use client";

import ContentCard from "@/components/ContentCard";
import { useWatchlist } from "@/lib/store";

export default function MyListPage() {
  const list = useWatchlist();

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black text-white">Daftar Saya</h1>
      <p className="mt-1 text-sm text-zinc-400">{list.length} judul tersimpan di perangkat ini.</p>
      {list.length === 0 ? (
        <p className="mt-6 rounded-xl bg-zinc-900 p-6 text-sm text-zinc-400 ring-1 ring-white/10">
          Belum ada. Buka detail film/series lalu tekan “+ Daftar Saya”.
        </p>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          {list.map((it, i) => (
            <ContentCard key={`${it.slug ?? it.title}-${i}`} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
