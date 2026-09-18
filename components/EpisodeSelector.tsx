"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { parseSeasons } from "@/lib/seasons";

export default function EpisodeSelector({
  slug,
  detail,
  initialSeason,
}: {
  slug: string;
  detail: Record<string, unknown>;
  initialSeason?: number;
}) {
  const seasons = useMemo(() => parseSeasons(detail), [detail]);

  const preferred = initialSeason && seasons.some((s) => s.num === initialSeason) ? initialSeason : seasons[0]?.num;
  const [season, setSeason] = useState<number>(preferred ?? 1);
  const active = seasons.find((s) => s.num === season) ?? seasons[0];
  const activeNum = active?.num ?? season;

  return (
    <section className="mt-8 rounded-xl bg-zinc-900/60 p-4 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-white">Season:</span>
        {seasons.map((s) => (
          <button
            key={`season-${s.num}`}
            onClick={() => setSeason(s.num)}
            aria-pressed={season === s.num}
            className={`rounded-md px-3 py-1.5 text-sm ring-1 ${season === s.num ? "bg-red-600 text-white ring-red-600" : "text-zinc-300 ring-white/15 hover:ring-white/40"}`}
          >
            {s.num}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {(active?.episodes ?? [1]).map((e) => (
          <Link
            key={`s${activeNum}-e${e}`}
            href={`/watch/series/${encodeURIComponent(slug)}?season=${activeNum}&episode=${e}`}
            className="rounded-md bg-white/10 px-2 py-2 text-center text-sm text-white hover:bg-red-600"
          >
            E{e}
          </Link>
        ))}
      </div>

      {active?.estimated ? (
        <p className="mt-3 text-[11px] text-zinc-400">
          Sumber tidak mengirim daftar episode untuk season ini — jumlah episode di atas adalah perkiraan. Kalau
          ada episode yang gagal dimuat, coba nomor lain atau kembali ke halaman detail.
        </p>
      ) : null}
    </section>
  );
}
