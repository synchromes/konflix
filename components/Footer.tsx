import Link from "next/link";

const BROWSE = [
  { href: "/film", label: "Film" },
  { href: "/series", label: "Series" },
  { href: "/genre", label: "Genre" },
  { href: "/search", label: "Pencarian" },
];

const LIBRARY = [
  { href: "/my-list", label: "Daftar Saya" },
  { href: "/history", label: "Riwayat Menonton" },
  { href: "/genre/action", label: "Aksi" },
  { href: "/genre/drama", label: "Drama" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/40 py-10 text-sm text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-lg font-black tracking-tight text-red-600">BALEFLIX</p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed">
              Nonton ribuan film dan series favoritmu kapan saja, di mana saja. Tanpa batas, tanpa ribet —
              cukup pilih, tekan putar, dan nikmati.
            </p>
          </div>
          <nav aria-label="Jelajahi">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Jelajahi</p>
            <ul className="mt-3 space-y-2">
              {BROWSE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Koleksimu">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Koleksimu</p>
            <ul className="mt-3 space-y-2">
              {LIBRARY.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Baleflix. Seluruh hak cipta dilindungi.</p>
          <p>Dibuat untuk para pecinta film Indonesia.</p>
        </div>
      </div>
    </footer>
  );
}
