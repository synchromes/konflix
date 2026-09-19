"use client";

import { useEffect } from "react";

// Menyiapkan stream diam-diam selagi pengguna membaca halaman detail.
// Alur: request ke /api/idlix/<path>/stream menjalankan rantai upstream
// (±20 dtk) dan hasilnya di-cache backend 15 menit — jadi saat pengguna
// menekan "Nonton", halaman watch langsung dapat URL tanpa menunggu lagi.
//
// Pengaman: mulai setelah 3 detik (pengunjung sekilas tidak memicu rantai),
// sekali per path per sesi tab (StrictMode/remount tidak menggandakan).
const FIRED = new Set<string>();

export default function StreamPrewarm({ path }: { path: string }) {
  useEffect(() => {
    if (FIRED.has(path)) return;
    const t = setTimeout(() => {
      FIRED.add(path);
      // Respons sengaja diabaikan — yang penting efek caching di backend.
      // Abort saat unmount agar tidak menggantung.
      const ac = new AbortController();
      const killer = setTimeout(() => ac.abort(), 90000);
      fetch(`/api/idlix${path}`, { cache: "no-store", signal: ac.signal })
        .catch(() => undefined)
        .finally(() => clearTimeout(killer));
    }, 3000);
    return () => clearTimeout(t);
  }, [path]);
  return null;
}
