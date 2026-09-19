import { Suspense } from "react";
import FilterableListing from "@/components/FilterableListing";

function Fallback() {
  return (
    <div className="py-8" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
      <div className="mt-4 h-32 animate-pulse rounded-xl bg-zinc-800/60" />
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

export default function FilmPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <FilterableListing title="Film" kind="movie" hrefBase="/film" />
    </Suspense>
  );
}
