import Link from "next/link";
import PagedListing from "@/components/PagedListing";
import { NETWORKS } from "@/lib/constants";
import { parsePage } from "@/lib/pagination";

export default async function SeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);

  return (
    <PagedListing
      title="Series TV"
      page={page}
      hrefBase="/series"
      // Endpoint paginasi khusus (ditambahkan di IDLIX-API lokal): /series/trending/:page
      listPath={`/series/trending/${page}`}
      kind="series"
      chips={NETWORKS.map((n) => (
        <Link
          key={n}
          href={`/network/${n}?type=series`}
          className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:border-red-600 hover:text-white"
        >
          {n}
        </Link>
      ))}
    />
  );
}
