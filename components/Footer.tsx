import Link from "next/link";

const LINKS = [
  { href: "/film", label: "Film" },
  { href: "/series", label: "Series" },
  { href: "/search", label: "Pencarian" },
  { href: "/my-list", label: "Daftar Saya" },
  { href: "/history", label: "Riwayat" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 py-10 text-sm text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-lg font-black text-red-600">BALEFLIX</p>
        <p className="mt-2 max-w-2xl">
          Website streaming film & series. Data & stream berasal dari IDLIX-API (scraper pihak ketiga). Gunakan
          untuk pembelajaran/pribadi. Jalankan API lokal via Docker agar katalog tampil penuh.
        </p>
        <p className="mt-2 max-w-2xl text-xs text-zinc-400">
          Proyek demo: sumber konten tidak memiliki lisensi distribusi, jadi jangan dipublikasikan atau
          dipakai secara komersial.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          {LINKS.map((l) => (
            <Link key={l.href} className="hover:text-white" href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
