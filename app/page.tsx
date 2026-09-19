import Hero from "@/components/Hero";
import Rail from "@/components/Rail";
import ContinueWatching from "@/components/ContinueWatching";
import ApiNotice from "@/components/ApiNotice";
import { MOCK_ITEMS } from "@/lib/mock";
import { CURRENT_YEAR } from "@/lib/constants";
import { fetchSection, itemSlug, serverIdlix, type ContentItem, type Section } from "@/lib/idlix";
import { asString } from "@/lib/upstream";

export const revalidate = 1800;

function firstWithItems(sections: Section[]): ContentItem[] {
  for (const s of sections) if (s.items.length > 0) return s.items;
  return [];
}

// List hanya membawa poster potrait w300 — di-stretch fullscreen jadi pecah.
// Ambil backdrop landscape asli (w1280) dari endpoint detail untuk ≤6 item
// hero. Detail di-cache 2 jam di level fetch maupun backend, jadi murah.
async function withHeroBackdrops(items: ContentItem[]): Promise<ContentItem[]> {
  const out = await Promise.all(
    items.slice(0, 6).map(async (it) => {
      if (asString(it.backdrop)) return it;
      const slug = itemSlug(it);
      if (!slug) return it;
      const enc = encodeURIComponent(slug);
      const [movie, series] = await Promise.all([
        serverIdlix<{ backdrop?: unknown }>(`/movie/${enc}`, { revalidate: 7200 }),
        serverIdlix<{ backdrop?: unknown }>(`/series/${enc}`, { revalidate: 7200 }),
      ]);
      const backdrop =
        asString(movie?.data?.backdrop) || asString(series?.data?.backdrop);
      return backdrop ? { ...it, backdrop } : it;
    })
  );
  return out;
}

export default async function Home() {
  // Sumber `/cinemaxxi` mengembalikan payload yang identik dengan
  // `/movie/trending`, jadi rail "baru ditambahkan" diganti rilis tahun berjalan
  // supaya tidak ada dua rail dengan isi sama.
  const [featured, trendingMovie, trendingSeries, freshMovie, top] = await Promise.all([
    fetchSection("/featured", { revalidate: 1800 }),
    fetchSection("/movie/trending/1", { revalidate: 1800 }),
    fetchSection("/series/trending", { revalidate: 1800 }),
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
          {apiDown ? "Katalog tidak tersedia" : "Katalog sedang kosong"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          {apiDown
            ? "Tidak dapat memuat katalog saat ini. Periksa koneksi lalu muat ulang — atau intip pilihan editor di bawah."
            : "Sumber menjawab tetapi tidak mengirim judul apa pun. Coba muat ulang beberapa saat lagi."}
        </p>
        <div className="mt-8 grid gap-8">
          {apiDown ? (
            <>
              <Rail title="Pilihan Editor: Film" items={MOCK_ITEMS.filter((m) => m.type === "movie")} />
              <Rail title="Pilihan Editor: Series" items={MOCK_ITEMS.filter((m) => m.type === "series")} />
            </>
          ) : null}
        </div>
      </div>
    );
  }

  const heroItems = await withHeroBackdrops(firstWithItems([featured, top, trendingMovie]));

  // Beranda hanya menampilkan 12 kartu per rail (sisanya lewat "Lihat semua")
  // supaya halaman tidak kepanjangan di desktop maupun HP.
  const RAIL_LIMIT = 12;

  return (
    <div className="pb-10">
      <Hero items={heroItems.slice(0, 6)} />
      {/* Kolom grid dipaksa minmax(0,1fr): tanpa ini anak grid (rail) memakai
          min-width:auto sehingga mendorong LEBAR HALAMAN mengikuti isi rail —
          akibatnya yang tergeser halamannya, bukan list filmnya. */}
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8">
        <ApiNotice show={apiDown} />
        <ContinueWatching />
        <Rail title="Trending Film" items={trendingMovie.items.slice(0, RAIL_LIMIT)} href="/film" kind="movie" />
        <Rail title="Trending Series" items={trendingSeries.items.slice(0, RAIL_LIMIT)} href="/series" kind="series" />
        <Rail
          title={`Rilis ${CURRENT_YEAR}`}
          items={freshMovie.items.slice(0, RAIL_LIMIT)}
          href={`/year/${CURRENT_YEAR}?type=movie`}
          kind="movie"
        />
        <Rail title="Top 10 Hari Ini" items={top.items.slice(0, 10)} href="/search" />
      </div>
    </div>
  );
}
