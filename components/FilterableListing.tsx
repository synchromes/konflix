"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ContentCard from "@/components/ContentCard";
import FilterBar, { type BrowseFilters, type CountryOption, type GenreOption } from "@/components/FilterBar";
import { clientIdlix, filterUsableItems, pickList, type ContentItem, type Kind } from "@/lib/idlix";

const VALID_SORTS = new Set(["createdAt", "popularityScore", "voteAverage", "title"]);

function readFilters(sp: URLSearchParams, lockedGenre?: string): BrowseFilters {
  const sort = sp.get("sort") ?? "";
  return {
    sort: VALID_SORTS.has(sort) ? sort : "createdAt",
    genre: lockedGenre ?? sp.get("genre") ?? "",
    country: sp.get("country") ?? "",
    year: sp.get("year") ?? "",
    network: sp.get("network") ?? "",
  };
}

function toQuery(sp: URLSearchParams, f: BrowseFilters, page: number, lockedGenre?: string): string {
  // Pertahankan parameter lain yang sudah ada di URL (mis. ?type= di halaman
  // genre), hanya kunci terkelola yang ditulis ulang.
  const p = new URLSearchParams(sp.toString());
  if (f.sort && f.sort !== "createdAt") p.set("sort", f.sort);
  else p.delete("sort");
  if (!lockedGenre && f.genre) p.set("genre", f.genre);
  else if (!lockedGenre) p.delete("genre");
  if (f.country) p.set("country", f.country);
  else p.delete("country");
  if (f.year) p.set("year", f.year);
  else p.delete("year");
  if (f.network) p.set("network", f.network);
  else p.delete("network");
  if (page > 1) p.set("page", String(page));
  else p.delete("page");
  const s = p.toString();
  return s ? `?${s}` : "";
}

// Listing dengan filter & sort advanced (state di URL agar bisa di-share).
// Dipakai halaman /film, /series, dan /genre/:slug (genre dikunci).
export default function FilterableListing({
  title,
  kind,
  hrefBase,
  lockedGenre,
}: {
  title: string;
  kind: Kind;
  hrefBase: string;
  lockedGenre?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const filters = useMemo(() => readFilters(sp, lockedGenre), [sp, lockedGenre]);
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [genres, setGenres] = useState<GenreOption[]>([]);
  // Info halaman dari backend (bukan tebakan jumlah item — rapuh bila ada
  // item sampah terfilter sehingga < 36 padahal masih ada halaman berikut).
  const [pageInfo, setPageInfo] = useState<{ page: number; total: number | null; hasNext: boolean }>({
    page: 1,
    total: null,
    hasNext: false,
  });
  // Status loading derived dari kunci request (tanpa setState sinkron di
  // effect): true selama kunci yang diminta belum selesai dimuat.
  const requestKey = useMemo(() => JSON.stringify([filters, page, kind]), [filters, page, kind]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  // Daftar negara & genre untuk dropdown (sekali saja, di-cache server).
  // Genre WAJIB dari API: slug hardcoded yang tidak dikenal upstream
  // (mis. drama-korea) mengembalikan daftar kosong.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      clientIdlix<Array<{ title?: unknown; slug?: unknown }>>("/country"),
      clientIdlix<Array<{ title?: unknown; slug?: unknown }>>("/genre"),
    ]).then(([c, g]) => {
      if (cancelled) return;
      const toOptions = (json: { data?: unknown } | null): CountryOption[] => {
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

  useEffect(() => {
    const ac = new AbortController();
    const key = JSON.stringify([filters, page, kind]);
    const params = new URLSearchParams({
      page: String(page),
      limit: "36",
      sort: filters.sort,
    });
    if (filters.genre) params.set("genre", filters.genre);
    if (filters.country) params.set("country", filters.country);
    if (filters.year) params.set("year", filters.year);
    if (filters.network) params.set("network", filters.network);
    clientIdlix<ContentItem[]>(`/${kind}/browse?${params.toString()}`, { signal: ac.signal })
      .then((json) => {
        if (ac.signal.aborted) return;
        if (!json) {
          setFailed(true);
          setItems([]);
          setPageInfo({ page, total: null, hasNext: false });
        } else {
          setFailed(false);
          const list = filterUsableItems(pickList(json));
          setItems(list);
          const pg = json.pagination;
          setPageInfo({
            page,
            total: typeof pg?.totalPages === "number" && pg.totalPages > 0 ? pg.totalPages : null,
            hasNext:
              typeof pg?.hasNext === "boolean" ? pg.hasNext : list.length >= 36,
          });
        }
        setLoadedKey(key);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setFailed(true);
        setItems([]);
        setPageInfo({ page, total: null, hasNext: false });
        setLoadedKey(key);
      });
    return () => ac.abort();
  }, [filters, page, kind]);

  const go = useCallback(
    (f: BrowseFilters, p: number) => {
      router.push(`${hrefBase}${toQuery(sp, f, p, lockedGenre)}`, { scroll: false });
    },
    [router, hrefBase, lockedGenre, sp]
  );

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black text-white sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {loading
          ? "Memuat…"
          : failed
            ? "Gagal memuat"
            : `${items.length} judul • halaman ${pageInfo.page}${pageInfo.total ? ` dari ${pageInfo.total}` : ""}`}
      </p>

      <div className="mt-4">
        <FilterBar
          filters={filters}
          onChange={(f) => go(f, 1)}
          countries={countries}
          genres={genres}
          lockedGenre={lockedGenre}
        />
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6" aria-busy="true" aria-live="polite">
          <span className="sr-only">Memuat…</span>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : failed ? (
        <p className="mt-6 rounded-xl border border-yellow-800 bg-yellow-950/60 p-4 text-sm text-yellow-200">
          Tidak bisa memuat daftar. Periksa koneksi lalu coba lagi.
        </p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl bg-zinc-900 p-6 text-center ring-1 ring-white/10">
          <p className="text-sm font-semibold text-white">Tidak ada judul untuk kombinasi ini</p>
          <p className="mt-1 text-xs text-zinc-400">Longgarkan filter atau tekan “Atur ulang”.</p>
        </div>
      ) : (
        // Grid vertikal ke bawah — kartu yang sama dengan beranda, hanya
        // tersusun mengisi kolom (3 di HP → 6 di desktop).
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((it, i) => (
            <div key={`${it.slug}-${i}`} className="min-w-0 [&>a]:w-full">
              <ContentCard item={it} kind={kind} />
            </div>
          ))}
        </div>
      )}

      {!loading && !failed && items.length > 0 ? (
        <Pager
          page={page}
          hasNext={pageInfo.hasNext}
          prevHref={page > 1 ? `${hrefBase}${toQuery(sp, filters, page - 1, lockedGenre)}` : null}
          nextHref={pageInfo.hasNext ? `${hrefBase}${toQuery(sp, filters, page + 1, lockedGenre)}` : null}
        />
      ) : null}
    </div>
  );
}

function Pager({
  page,
  hasNext,
  prevHref,
  nextHref,
}: {
  page: number;
  hasNext: boolean;
  prevHref: string | null;
  nextHref: string | null;
}) {
  if (!prevHref && !nextHref) {
    return <p className="mt-8 text-center text-xs text-zinc-500">Halaman {page} • mentok — tidak ada lagi</p>;
  }
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      {prevHref ? (
        <Link
          href={prevHref}
          scroll={false}
          className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
        >
          ← Sebelumnya
        </Link>
      ) : null}
      <span className="text-xs text-zinc-400">Halaman {page}</span>
      {nextHref ? (
        <Link
          href={nextHref}
          scroll={false}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700"
        >
          Berikutnya →
        </Link>
      ) : null}
      {!hasNext && page > 1 ? <span className="text-xs text-zinc-500">• terakhir</span> : null}
    </div>
  );
}
