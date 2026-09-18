"use client";

import { useCallback, useEffect, useRef } from "react";

// Modal trailer yang bisa dipakai ulang. Iframe YouTube hanya dimuat saat modal
// dibuka: tidak ada request pihak ketiga saat halaman pertama kali dirender.
//
// Aksesibilitas: fokus dipindah ke tombol tutup, Tab berputar di dalam dialog
// (focus trap), Esc menutup, dan fokus dikembalikan ke elemen pemicu.
export default function TrailerModal({
  trailerId,
  title,
  onClose,
}: {
  /** null = modal tertutup */
  trailerId: string | null;
  title: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!trailerId) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    // Kunci scroll latar supaya halaman di belakang modal tidak ikut bergulir.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button, [href], iframe, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus();
    };
  }, [trailerId, close]);

  if (!trailerId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Trailer ${title}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={close}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-3xl overflow-hidden rounded-xl bg-black ring-1 ring-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2">
          <p className="text-sm font-semibold text-white">Trailer — {title}</p>
          <button
            ref={closeRef}
            onClick={close}
            className="rounded px-2 py-1 text-white hover:bg-white/10"
            aria-label="Tutup trailer"
          >
            ✕
          </button>
        </div>
        <div className="aspect-video w-full">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${trailerId}?autoplay=1`}
            title={`Trailer ${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
