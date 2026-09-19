import { Suspense } from "react";
import FilterableListing from "@/components/FilterableListing";
import { NETWORKS } from "@/lib/constants";
import Link from "next/link";

function Fallback() {
  return (
    <div className="py-8" aria-busy="true">
      <div className="h-8 w-44 animate-pulse rounded bg-zinc-800" />
      <div className="mt-4 h-32 animate-pulse rounded-xl bg-zinc-800/60" />
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

export default function SeriesPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <FilterableListing title="Series TV" kind="series" hrefBase="/series" />
      <div className="mt-6 flex flex-wrap gap-2 pb-8">
        {NETWORKS.map((n) => (
          <Link
            key={n}
            href={`/network/${n}?type=series`}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 hover:border-red-600 hover:text-white"
          >
            {n}
          </Link>
        ))}
      </div>
    </Suspense>
  );
}
