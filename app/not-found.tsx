import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">404</p>
      <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Judul atau halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Kemungkinan slug-nya sudah berubah di sumber (katalog sering berganti), atau judulnya belum ada di
        IDLIX-API.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="rounded-md bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">
          Ke beranda
        </Link>
        <Link href="/film" className="rounded-md border border-white/15 px-5 py-2.5 text-sm hover:bg-white/10">
          Jelajahi film
        </Link>
        <Link href="/series" className="rounded-md border border-white/15 px-5 py-2.5 text-sm hover:bg-white/10">
          Jelajahi series
        </Link>
      </div>
    </div>
  );
}
