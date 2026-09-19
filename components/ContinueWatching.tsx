"use client";

import Link from "next/link";
import ScrollRow from "@/components/ScrollRow";
import { loadProgress, useHistory } from "@/lib/store";

// Rail "Lanjutkan menonton" dari riwayat lokal (riadwayat ditulis player
// setiap stream berhasil). Sembunyi total bila belum ada riwayat —
// getServerSnapshot mengembalikan [] agar tidak mismatch hidrasi.
function timeAgo(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  return `${Math.floor(d / 30)} bln lalu`;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ContinueWatching() {
  const history = useHistory();
  if (history.length === 0) return null;
  const items = history.slice(0, 12);

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-lg font-bold text-white sm:text-xl">Lanjutkan menonton</h2>
        <Link href="/history" className="text-xs font-medium text-zinc-400 hover:text-white">
          Riwayat →
        </Link>
      </div>
      <ScrollRow>
        {items.map((h) => {
          const watchHref =
            h.type === "series"
              ? `/watch/series/${encodeURIComponent(h.slug)}?season=${h.season ?? 1}&episode=${h.episode ?? 1}`
              : `/watch/movie/${encodeURIComponent(h.slug)}`;
          const pos = loadProgress(h.slug, h.season, h.episode);
          const ep = h.type === "series" ? `S${h.season ?? 1} E${h.episode ?? 1} • ` : "";
          return (
            <Link
              key={`${h.slug}-${h.season ?? 0}-${h.episode ?? 0}`}
              href={watchHref}
              className="group w-[220px] shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10 transition hover:ring-red-600 sm:w-[260px]"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-zinc-800">
                {h.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.poster}
                    alt={h.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-3 text-center text-xs text-zinc-400">
                    {h.title}
                  </div>
                )}
                <span className="absolute inset-0 m-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-base text-white ring-1 ring-white/30 transition group-hover:bg-red-600">
                  ▶
                </span>
                {pos > 0 ? (
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {fmt(pos)}
                  </span>
                ) : null}
              </div>
              <div className="p-2">
                <p className="truncate text-[13px] font-medium text-zinc-100">{h.title}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {ep}
                  {pos > 0 ? `Lanjut ${fmt(pos)} • ` : ""}
                  {timeAgo(h.at)}
                </p>
              </div>
            </Link>
          );
        })}
      </ScrollRow>
    </section>
  );
}
