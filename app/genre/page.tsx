import Link from "next/link";
import { serverIdlix } from "@/lib/idlix";

interface GenreEntry {
  title?: string;
  slug?: string;
  value?: string;
}

// Indeks semua genre (sumber kebenaran dari API) — daftar hardcoded bisa
// basi/asing (pernah: drama-korea) sehingga halaman genre terlihat terkunci.
export default async function GenreIndex() {
  const json = await serverIdlix<GenreEntry[]>("/genre", { revalidate: 86400 });
  const list = (Array.isArray(json?.data) ? json.data : [])
    .map((g) => ({
      title: String(g.title ?? g.slug ?? ""),
      slug: String(g.slug ?? g.value ?? ""),
    }))
    .filter((g) => g.title && g.slug);

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black text-white sm:text-3xl">Jelajahi Genre</h1>
      <p className="mt-1 text-sm text-zinc-400">{list.length > 0 ? `${list.length} genre` : "Memuat…"}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {list.map((g) => (
          <Link
            key={g.slug}
            href={`/genre/${encodeURIComponent(g.slug)}`}
            className="group rounded-xl bg-zinc-900 p-5 text-center ring-1 ring-white/10 transition hover:bg-red-950/40 hover:ring-red-600"
          >
            <p className="truncate text-sm font-bold text-white group-hover:text-red-400">{g.title}</p>
            <p className="mt-1 text-[11px] text-zinc-400">Film & Series →</p>
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="mt-6 rounded-xl border border-yellow-800 bg-yellow-950/60 p-4 text-sm text-yellow-200">
          Tidak bisa memuat daftar genre. Coba lagi beberapa saat lagi.
        </p>
      ) : null}
    </div>
  );
}
