"use client";

import { useEffect, useId, useRef } from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

// Dropdown kustom bertema gelap pengganti <select> bawaan: tombol pemicu
// berbingkai, popover animasi, centang pada pilihan aktif, bisa keyboard
// (Enter/Spasi buka, Escape tutup) dan tertutup saat klik di luar.
export default function Dropdown({
  label,
  value,
  onChange,
  options,
  open,
  onOpenChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => onOpenChange(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-zinc-900 px-3 py-2 text-left text-sm text-white transition ${
          open
            ? "border-red-600 ring-2 ring-red-600/40"
            : "border-white/15 hover:border-white/40"
        }`}
      >
        <span className="truncate">{current?.label}</span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 origin-top overflow-y-auto rounded-lg bg-zinc-900 p-1.5 shadow-2xl shadow-black/60 ring-1 ring-white/15"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value || "all"} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    onOpenChange(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                    active ? "bg-red-600/15 font-semibold text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {active ? (
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0 text-red-500"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
