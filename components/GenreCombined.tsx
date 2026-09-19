"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ContentCard from "@/components/ContentCard";
import FilterBar, { type BrowseFilters, type CountryOption, type GenreOption } from "@/components/FilterBar";
import { clientIdlix, filterUsableItems, pickList, type ContentItem, type Envelope } from "@/lib/idlix";

const VALID_SORTS = new Set(["createdAt", "popularityScore", "voteAverage", "title"]);

function readFilters(sp: URLSearchParams): BrowseFilters {
  const sort = sp.get("sort") ?? "";
  return {
    sort: VALID_SORTS.has(sort) ? sort : "createdAt",
    genre: "",
    country: sp.get("country") ?? "",
    year: sp.get("year") ?? "",
    network: sp.get("network") ?? "",
  };
}

function readPage(sp: URLSearchParams, key: string): number {
  return Math.max(1, parseInt(sp.get(key) ?? "1", 10) || 1);
}

// Pertahankan parameter lain di URL; page film & series independen
// (mpage/spage) agar pager satu seksi tidak me-reset seksi lain.
function withPaging(
  sp: URLSearchParams,
  f: BrowseFilters,
  mpage: number,
  spage: number
): string {
  const p = new URLSearchParams(sp.toString());
  if (f.sort && f.sort !== "createdAt") p.set("sort", f.sort);
  else p.delete("sort");
  if (f.country) p.set("country", f.country);
  else p.delete("country");
  if (f.year) p.set("year", f.year);
  else p.delete("year");
  if (f.network) p.set("network", f.network);
  else p.delete("network");
  if (mpage > 1) p.set("mpage", String(mpage));
  else p.delete("mpage");
  if (spage > 1) p.set("spage", String(spage));
  else p.delete("spage");
  const s = p.toString();
  return s ? `?${s}` : "";
}

interface SectionData {
  items: ContentItem[];
  total: number | null;
  hasNext: boolean;
}

const EMPTY_SECTION: SectionData = { items: [], total: null, hasNext: false };

function sectionQuery(filters: BrowseFilters, slug: string, page: number): string {
  const p = new URLSearchParams({ page: String(page), limit: "36", sort: filters.sort });
  p.set("genre", slug);
  if (filters.country) p.set("country", filters.country);
  if (filters.year) p.set("year", filters.year);
  if (filters.network) p.set("network", filters.network);
  return p.toString();
}

// Tampilan gabungan /genre/:slug tanpa ?type=: satu filter bar untuk dua
// endpoint (film + series paralel), tiap seksi full 36 + pager independen.
export default function GenreCombined({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const filters = useMemo(() => readFilters(sp), [sp]);
  const mpage = readPage(sp, "mpage");
  const spage = readPage(sp, "spage");

  const [movies, setMovies] = useState<SectionData>(EMPTY_SECTION);
  const [series, setSeries] = useState<SectionData>(EMPTY_SECTION);
  const [failed, setFailed] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [genres, setGenres] = useState<GenreOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      clientIdlix<Array<{ title?: unknown; slug?: unknown }>>("/country"),
      clientIdlix<Array<{ title?: unknown; slug?: unknown }>>("/genre"),
    ]).then(([c, g]) => {
      if (cancelled) return;
      const toOptions = (json: { data?: unknown } | null) => {
        const list = json && Array.isArray(json.data) ? json.data : [];
        return (list as Array<{ title?: unknown; slug?: unknown }>)
          .map((x) => ({ value: String(x.slug ?? ""), label: String(x.title ?? x.slug ?? "") }))
          .filter((x) => x.value && x.label);
      };
      setCountries(toOptions(c));
      setGenres(toOptions(g));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const movieQuery = useMemo(
    () => sectionQuery(filters, slug, mpage),
    [filters, slug, mpage]
  );
  const seriesQuery = useMemo(
    () => sectionQuery(filters, slug, spage),
    [filters, slug, spage]
  );
  const fetchKey = `${movieQuery}|${seriesQuery}`;

  // Loading derived dari kunci request (tanpa setState sinkron di effect).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== fetchKey;

  useEffect(() => {
    const ac = new AbortController();
    const key = fetchKey;
    const toSection = (json: Envelope<unknown> | null): SectionData => {
      if (!json) return EMPTY_SECTION;
      const items = filterUsableItems(pickList(json));
      const pg = json.pagination;
      const total = typeof pg?.totalPages === "number" && pg.totalPages > 0 ? pg.totalPages : null;
      return {
        items,
        total,
        hasNext: typeof pg?.hasNext === "boolean" ? pg.hasNext : items.length >= 36,
      };
    };
    Promise.all([
      clientIdlix<ContentItem[]>(`/movie/browse?${movieQuery}`, { signal: ac.signal }),
      clientIdlix<ContentItem[]>(`/series/browse?${seriesQuery}`, { signal: ac.signal }),
    ])
      .then(([m, s]) => {
        if (ac.signal.aborted) return;
        if (!m && !s) {
          setFailed(true);
          setMovies(EMPTY_SECTION);
          setSeries(EMPTY_SECTION);
        } else {
          setFailed(false);
          setMovies(toSection(m));
          setSeries(toSection(s));
        }
        setLoadedKey(key);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setFailed(true);
        setMovies(EMPTY_SECTION);
        setSeries(EMPTY_SECTION);
        setLoadedKey(key);
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  const go = useCallback(
    (f: BrowseFilters) => {
      // Ganti filter = kembali ke halaman 1 di kedua seksi.
      router.push(`/genre/${encodeURIComponent(slug)}${withPaging(sp, f, 1, 1)}`, { scroll: false });
    },
    [router, slug, sp]
  );

  const base = `/genre/${encodeURIComponent(slug)}`;
  const currentQuery = withPaging(sp, filters, mpage, spage);
  const querySuffix = (type: string) =>
    `${currentQuery}${currentQuery ? "&" : "?"}type=${type}`;
  const skeleton = (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-zinc-800" />
      ))}
    </div>
  );

  // Pager mini per seksi: halaman seksi ini maju/mundur, seksi lain tidak ikut.
  const pagerFor = (
    kind: "movie" | "series",
    page: number,
    sec: SectionData
  ) => {
    const prevHref =
      page > 1
        ? `${base}${withPaging(sp, filters, kind === "movie" ? page - 1 : mpage, kind === "series" ? page - 1 : spage)}`
        : null;
    const nextHref = sec.hasNext
      ? `${base}${withPaging(sp, filters, kind === "movie" ? page + 1 : mpage, kind === "series" ? page + 1 : spage)}`
      : null;
    if (!prevHref && !nextHref) return null;
    return (
      <div className="mt-4 flex items-center justify-center gap-3">
        {prevHref ? (
          <Link href={prevHref} scroll={false} className="rounded-md border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10">
            ←
          </Link>
        ) : null}
        <span className="text-xs text-zinc-400">
          Hal. {page}
          {sec.total ? ` dari ${sec.total}` : ""}
        </span>
        {nextHref ? (
          <Link href={nextHref} scroll={false} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-700">
            →
          </Link>
        ) : null}
      </div>
    );
  };

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black capitalize text-white sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">Film & series dalam satu halaman</p>

      <div className="mt-4">
        <FilterBar
          filters={{ ...filters, genre: "" }}
          onChange={(f) => go({ ...f, genre: "" })}
          countries={countries}
          genres={genres}
          lockedGenre={slug}
        />
      </div>

      {loading ? (
        <div className="mt-8 grid gap-8">
          <section>
            <div className="mb-3 h-6 w-32 animate-pulse rounded bg-zinc-800" />
            {skeleton}
          </section>
          <section>
            <div className="mb-3 h-6 w-32 animate-pulse rounded bg-zinc-800" />
            {skeleton}
          </section>
        </div>
      ) : failed ? (
        <p className="mt-6 rounded-xl border border-yellow-800 bg-yellow-950/60 p-4 text-sm text-yellow-200">
          Tidak bisa memuat daftar. Periksa koneksi lalu coba lagi.
        </p>
      ) : movies.items.length === 0 && series.items.length === 0 ? (
        <div className="mt-6 rounded-xl bg-zinc-900 p-6 text-center ring-1 ring-white/10">
          <p className="text-sm font-semibold text-white">Tidak ada judul untuk kombinasi ini</p>
          <p className="mt-1 text-xs text-zinc-400">Longgarkan filter atau tekan “Atur ulang”.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-8">
          {movies.items.length > 0 ? (
            <section>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="text-lg font-bold text-white">Film</h2>
                <Link
                  href={`${base}${querySuffix("movie")}`}
                  className="text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Tampilan film penuh →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {movies.items.map((it, i) => (
                  <div key={`${it.slug}-${i}`} className="min-w-0 [&>a]:w-full">
                    <ContentCard item={it} kind="movie" />
                  </div>
                ))}
              </div>
              {pagerFor("movie", mpage, movies)}
            </section>
          ) : null}
          {series.items.length > 0 ? (
            <section>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="text-lg font-bold text-white">Series</h2>
                <Link
                  href={`${base}${querySuffix("series")}`}
                  className="text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Tampilan series penuh →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {series.items.map((it, i) => (
                  <div key={`${it.slug}-${i}`} className="min-w-0 [&>a]:w-full">
                    <ContentCard item={it} kind="series" />
                  </div>
                ))}
              </div>
              {pagerFor("series", spage, series)}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
