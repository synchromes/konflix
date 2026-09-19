"use client";

import { useRef, type ReactNode } from "react";

// Baris geser horizontal standar aplikasi: usap di sentuh, panah ‹ › di
// desktop (hover/fokus keyboard), gulir selebar 80% area terlihat. Dipakai
// Rail, Lanjutkan menonton, dan hasil/jelajah pencarian agar perilaku sama.
export default function ScrollRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: "smooth" });
  };

  const buttonClass =
    "absolute top-1/3 z-10 hidden rounded-full bg-black/70 px-3 py-2 text-white ring-1 ring-white/20 hover:bg-red-600 group-hover:block focus-visible:block";

  return (
    <div className="group relative">
      <button onClick={() => scroll(-1)} aria-label="Geser kiri" className={`${buttonClass} -left-2`}>
        ‹
      </button>
      <div ref={ref} className="no-scrollbar rail-scroll flex gap-3 overflow-x-auto overscroll-x-contain pb-1">
        {children}
      </div>
      <button onClick={() => scroll(1)} aria-label="Geser kanan" className={`${buttonClass} -right-2`}>
        ›
      </button>
    </div>
  );
}
