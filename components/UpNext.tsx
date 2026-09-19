"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Overlay "Berikutnya" ala Netflix: hitung mundur otomatis ke episode
// berikutnya, bisa dibatalkan atau langsung diklik. Muncul saat video selesai.
export default function UpNext({
  href,
  label,
  seconds = 8,
}: {
  href: string;
  label: string;
  seconds?: number;
}) {
  const [left, setLeft] = useState(seconds);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (cancelled) return;
    if (left <= 0) {
      window.location.href = href;
      return;
    }
    const id = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [left, cancelled, href]);

  if (cancelled) return null;

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-xl bg-zinc-900 p-5 text-center ring-1 ring-white/10 sm:flex-row sm:text-left">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-black text-white">
        {left}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-widest text-zinc-400">Berikutnya</p>
        <p className="truncate text-sm font-bold text-white">{label}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={href}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
        >
          Putar sekarang
        </Link>
        <button
          onClick={() => setCancelled(true)}
          className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
