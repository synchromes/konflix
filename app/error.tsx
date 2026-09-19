"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Kesalahan sisi klien dicatat di console agar tetap bisa didiagnosis.
    console.error("[baleflix] error halaman:", error);
  }, [error]);

  return (
    <div className="py-16">
      <h1 className="text-2xl font-black text-white">Terjadi kesalahan</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Halaman ini gagal dimuat. Periksa koneksi internetmu, lalu coba lagi.
      </p>
      {error.digest ? <p className="mt-1 text-xs text-zinc-400">Kode: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700"
        >
          Coba lagi
        </button>
        <Link href="/" className="rounded-md border border-white/15 px-5 py-2.5 text-sm hover:bg-white/10">
          Ke beranda
        </Link>
      </div>
    </div>
  );
}
