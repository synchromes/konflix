"use client";

import Link from "next/link";
import { clearHistory, useHistory } from "@/lib/store";

export default function HistoryPage() {
  const list = useHistory();

  return (
    <div className="py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Riwayat Nonton</h1>
          <p className="mt-1 text-sm text-zinc-400">Lanjutkan tontonan terakhir kamu.</p>
        </div>
        {list.length > 0 ? (
          <button
            onClick={clearHistory}
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Hapus semua
          </button>
        ) : null}
      </div>

      {list.length === 0 ? (
        <p className="mt-6 rounded-xl bg-zinc-900 p-6 text-sm text-zinc-400 ring-1 ring-white/10">
          Belum ada riwayat. Mulai nonton dari halaman detail.
        </p>
      ) : (
        <div className="mt-6 grid gap-3">
          {list.map((h, i) => (
            <Link
              key={`${h.slug}-${h.season ?? 0}-${h.episode ?? 0}-${i}`}
              href={
                h.type === "series" && h.season
                  ? `/watch/series/${encodeURIComponent(h.slug)}?season=${h.season}&episode=${h.episode ?? 1}`
                  : `/watch/movie/${encodeURIComponent(h.slug)}`
              }
              className="flex items-center justify-between rounded-xl bg-zinc-900 p-4 ring-1 ring-white/10 hover:ring-red-600"
            >
              <div>
                <p className="font-semibold text-white">{h.title}</p>
                <p className="text-xs text-zinc-400">
                  {h.type === "series" ? `S${h.season ?? 1} E${h.episode ?? 1} • ` : ""}
                  {new Date(h.at).toLocaleString("id-ID")}
                </p>
              </div>
              <span className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Lanjutkan →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
