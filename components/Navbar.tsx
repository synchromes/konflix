"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/film", label: "Film" },
  { href: "/series", label: "Series" },
  { href: "/genre/action", label: "Genre" },
  { href: "/my-list", label: "Daftar Saya" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${
        scrolled ? "bg-black/90 backdrop-blur" : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="text-2xl font-black tracking-tight text-red-600">
          BALEFLIX
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-zinc-300 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "font-semibold text-white" : "hover:text-white"}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            setOpen(false);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari film / series…"
            className="hidden w-52 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-zinc-400 focus:border-red-600 focus:outline-none sm:block"
          />
          <button
            type="submit"
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Cari
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-white/15 px-2.5 py-1.5 text-sm text-white md:hidden"
            aria-label="Menu"
          >
            ☰
          </button>
        </form>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-black/95 px-4 py-3 md:hidden">
          <div className="grid gap-2 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded px-2 py-2 text-zinc-200 hover:bg-white/10"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/history" onClick={() => setOpen(false)} className="rounded px-2 py-2 text-zinc-200 hover:bg-white/10">
              Riwayat
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
