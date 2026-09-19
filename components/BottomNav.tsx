"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigasi bawah ala aplikasi untuk layar kecil. Ikon berupa outline SVG
// minimalis (stroke, tanpa warna solid) agar seragam dengan ikon Beranda.
// Disembunyikan di sm ke atas (navbar atas sudah cukup) dan saat fullscreen
// video (elemen fullscreen menutupi viewport sehingga bar ikut tersembunyi).
function Icon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d={d} />
    </svg>
  );
}

const ITEMS = [
  {
    href: "/",
    label: "Beranda",
    exact: true,
    icon: <Icon d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  },
  {
    href: "/film",
    label: "Film",
    exact: false,
    icon: <Icon d="M4 5h16v14H4zM4 9h16M4 15h16M8 5v14M16 5v14" />,
  },
  {
    href: "/series",
    label: "Series",
    exact: false,
    icon: <Icon d="M3 6h18v11H3zM9 21h6M12 17v4" />,
  },
  {
    href: "/search",
    label: "Cari",
    exact: false,
    icon: <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5 21 21" />,
  },
  {
    href: "/my-list",
    label: "Saya",
    exact: false,
    icon: <Icon d="M7 4h10v16l-5-4-5 4z" />,
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((it) => {
          const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] ${
                active ? "font-semibold text-red-500" : "text-zinc-400"
              }`}
            >
              {it.icon}
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
