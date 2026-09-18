import Hero from "@/components/Hero";
import Rail from "@/components/Rail";
import ApiNotice from "@/components/ApiNotice";
import { MOCK_ITEMS } from "@/lib/mock";
import { CURRENT_YEAR } from "@/lib/constants";
import { fetchSection, type ContentItem, type Section } from "@/lib/idlix";

export const revalidate = 1800;

function firstWithItems(sections: Section[]): ContentItem[] {
  for (const s of sections) if (s.items.length > 0) return s.items;
  return [];
}

export default async function Home() {
  // Sumber `/cinemaxxi` mengembalikan payload yang identik dengan
  // `/movie/trending`, jadi rail "baru ditambahkan" diganti rilis tahun berjalan
  // supaya tidak ada dua rail dengan isi sama.
  const [featured, trendingMovie, trendingSeries, freshMovie, top] = await Promise.all([
    fetchSection("/featured", { revalidate: 1800 }),
    fetchSection("/movie/trending/1", { revalidate: 1800 }),
    fetchSection("/series/trending/1", { revalidate: 1800 }),
    fetchSection(`/year/${CURRENT_YEAR}?type=movie`, { revalidate: 1800 }),
    // Leaderboard mengirim `data.topMovies` + `data.topSeries`, bukan `data.results`.
    fetchSection("/leaderboard", { revalidate: 1800, keys: ["topMovies", "topSeries"] }),
  ]);

  const sections = [featured, trendingMovie, trendingSeries, freshMovie, top];
  const anyLive = sections.some((s) => s.live);
  const apiDown = sections.every((s) => s.apiDown);

  // API hidup tapi semua daftar kosong: tampilkan keadaan apa adanya, bukan katalog palsu.
  if (!anyLive) {
    return (
      <div className="py-10">
        <ApiNotice show={apiDown} />
        <h1 className="text-2xl font-black text-white">
          {apiDown ? "Mode contoh" : "Katalog sedang kosong"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          {apiDown
            ? "IDLIX-API tidak bisa dihubungi, jadi halaman ini menampilkan data contoh di bawah."
            : "Sumber menjawab tetapi tidak mengirim judul apa pun. Coba muat ulang beberapa saat lagi."}
        </p>
        <div className="mt-8 grid gap-8">
          {apiDown ? (
            <>
              <Rail title="Trending Film (contoh)" items={MOCK_ITEMS.filter((m) => m.type === "movie")} />
              <Rail title="Trending Series (contoh)" items={MOCK_ITEMS.filter((m) => m.type === "series")} />
            </>
          ) : null}
        </div>
      </div>
    );
  }

  const heroItems = firstWithItems([featured, top, trendingMovie]);

  return (
    <div className="pb-10">
      <Hero items={heroItems.slice(0, 6)} />
      <div className="mt-8 grid gap-8">
        <ApiNotice show={apiDown} />
        <Rail title="Trending Film" items={trendingMovie.items} href="/film" kind="movie" />
        <Rail title="Trending Series" items={trendingSeries.items} href="/series" kind="series" />
        <Rail
          title={`Rilis ${CURRENT_YEAR}`}
          items={freshMovie.items}
          href={`/year/${CURRENT_YEAR}?type=movie`}
          kind="movie"
        />
        <Rail title="Top 10 Hari Ini" items={top.items.slice(0, 10)} href="/search" />
      </div>
    </div>
  );
}
