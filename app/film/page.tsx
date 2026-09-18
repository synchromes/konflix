import Link from "next/link";
import PagedListing from "@/components/PagedListing";
import { GENRES } from "@/lib/constants";
import { parsePage } from "@/lib/pagination";

export default async function FilmPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);

  return (
    <PagedListing
      title="Film"
      page={page}
      hrefBase="/film"
      // /movie/trending/:page menghormati nomor halaman (browse /movie selalu page 1 di upstream)
      listPath={`/movie/trending/${page}`}
      kind="movie"
      chips={GENRES.map((g) => (
        <Link
          key={g}
          href={`/genre/${g}?type=movie`}
          className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:border-red-600 hover:text-white"
        >
          {g}
        </Link>
      ))}
    />
  );
}
