"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Beranda" },
  { href: "/film", label: "Film" },
  { href: "/series", label: "Series" },
  { href: "/genre", label: "Genre" },
  { href: "/my-list", label: "Daftar Saya" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setOpen(false);
    setSearchOpen(false);
  };

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

        <form className="ml-auto hidden items-center gap-2 sm:flex" onSubmit={submitSearch}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari film / series…"
            aria-label="Cari film atau series"
            className="w-52 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-zinc-400 focus:border-red-600 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Cari
          </button>
        </form>
        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Cari"
            aria-expanded={searchOpen}
            className="rounded-md border border-white/15 p-2 text-zinc-200"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5 21 21" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-white/15 px-2.5 py-1.5 text-sm text-white md:hidden"
            aria-label="Menu"
            aria-expanded={open}
          >
            ☰
          </button>
        </div>
      </div>

      {searchOpen && (
        <form className="border-t border-white/10 bg-black/95 px-4 py-3 sm:hidden" onSubmit={submitSearch}>
          <div className="flex gap-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari film / series…"
              aria-label="Cari film atau series"
              className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:border-red-600 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Cari
            </button>
          </div>
        </form>
      )}

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
