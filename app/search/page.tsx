"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ContentCard from "@/components/ContentCard";
import {
  clientIdlix,
  clientKinds,
  filterUsableItems,
  itemKind,
  itemSlug,
  pickList,
  type ContentItem,
  type Kind,
} from "@/lib/idlix";

type Filter = "all" | Kind;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "movie", label: "Film" },
  { value: "series", label: "Series" },
];

function CardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[210px] w-[140px] shrink-0 animate-pulse rounded-lg bg-zinc-800 sm:h-[252px] sm:w-[168px]" />
      ))}
    </div>
  );
}

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = (sp.get("q") ?? "").trim();

  // Kolom cari besar di halaman (bukan cuma navbar): diketik → URL ikut
  // (debounce) supaya bisa di-share/di-back, hasil mengikuti ?q=.
  const [input, setInput] = useState(q);
  // Konten jelajah saat belum ada kata kunci (ala Netflix). Hasilnya
  // di-cache di state — kembali ke halaman kosong langsung tampil instan.
  const [exploreMovies, setExploreMovies] = useState<ContentItem[]>([]);
  const [exploreSeries, setExploreSeries] = useState<ContentItem[]>([]);
  const [exploreFailed, setExploreFailed] = useState(false);
  // Sinkronkan kolom & reset status jelajah saat URL berubah dari luar
  // (mis. navbar) — pola "adjust state during render" resmi React,
  // bukan setState di effect.
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setInput(q);
    setExploreFailed(false);
  }
  useEffect(() => {
    if (input.trim() === q) return;
    const t = setTimeout(() => {
      const v = input.trim();
      router.replace(v ? `/search?q=${encodeURIComponent(v)}` : "/search", { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [input, q, router]);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [kinds, setKinds] = useState<Record<string, Kind>>({});
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Derived langsung dari state (tanpa flag loading sinkron).
  const exploreLoading = !q && !exploreFailed && exploreMovies.length === 0 && exploreSeries.length === 0;

  // Hasil pencarian: debounce 250ms + batalkan permintaan lama supaya hasil
  // dari kata kunci sebelumnya tidak menimpa yang terbaru.
  useEffect(() => {
    const ac = new AbortController();
    const timer = setTimeout(() => {
      if (!q) {
        setItems([]);
        setError("");
        setLoading(false);
        return;
      }
      setLoading(true);
      clientIdlix<ContentItem[]>(`/search?q=${encodeURIComponent(q)}`, { signal: ac.signal })
        .then((json) => {
          if (ac.signal.aborted) return;
          setItems(pickList(json));
          setError(
            json === null
              ? "Tidak bisa memuat hasil. Periksa koneksi lalu coba lagi."
              : json.success === false && json.message
                ? `Sumber menolak permintaan: “${json.message}”.`
                : ""
          );
        })
        .catch(() => {
          if (!ac.signal.aborted) setError("Gagal memuat hasil pencarian.");
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [q]);

  // Jelajah: trending film + series (jenis sudah pasti dari endpointnya).
  // Tanpa flag loading yang di-set sinkron (aturan lint) — skeleton tampil
  // selama data kosong & belum gagal, derived langsung dari state.
  const hasExploreCache = exploreMovies.length > 0 || exploreSeries.length > 0;
  useEffect(() => {
    if (q || hasExploreCache) return;
    const ac = new AbortController();
    Promise.all([
      clientIdlix<ContentItem[]>("/movie/trending/1", { signal: ac.signal }),
      clientIdlix<ContentItem[]>("/series/trending/1", { signal: ac.signal }),
    ])
      .then(([m, s]) => {
        if (ac.signal.aborted) return;
        setExploreMovies(pickList(m).slice(0, 12));
        setExploreSeries(pickList(s).slice(0, 12));
      })
      .catch(() => {
        if (!ac.signal.aborted) setExploreFailed(true);
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Label `type` di endpoint list tidak bisa dipercaya (series sering dilabeli
  // movie), jadi jenis tiap hasil diverifikasi lewat detail movie/series.
  const verified = useRef<Set<string>>(new Set());
  const slugKey = items.map((it) => itemSlug(it)).filter(Boolean).join(",");

  useEffect(() => {
    const pending = slugKey.split(",").filter((s) => s && !verified.current.has(s));
    if (pending.length === 0) return;
    const ac = new AbortController();
    setVerifying(true);
    clientKinds(pending, { signal: ac.signal })
      .then((map) => {
        if (ac.signal.aborted) return;
        pending.forEach((s) => verified.current.add(s));
        setKinds((prev) => ({ ...prev, ...map }));
      })
      .finally(() => {
        if (!ac.signal.aborted) setVerifying(false);
      });
    return () => ac.abort();
  }, [slugKey]);

  const decorated = useMemo(() => {
    // Buang entri sampah dulu supaya angka "hasil" SELALU sama dengan kartu
    // yang ter-render (dulu: 20 terhitung, 7 terlihat).
    const usable = filterUsableItems(items);
    return usable.map((item) => {
      const slug = itemSlug(item);
      const kind = kinds[slug];
      return { item, slug, kind, effective: kind ?? itemKind(item) };
    });
  }, [items, kinds]);
  const filtered = decorated.filter((d) => filter === "all" || d.effective === filter);

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black text-white sm:text-3xl">Pencarian</h1>

      <div className="relative mt-4 max-w-2xl">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
        >
          <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5 21 21" />
        </svg>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Judul film, series, atau orang…"
          aria-label="Cari film atau series"
          autoFocus
          enterKeyHint="search"
          className="w-full rounded-xl border border-white/15 bg-zinc-900 py-3.5 pl-12 pr-11 text-base text-white placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/40"
        />
        {input ? (
          <button
            onClick={() => setInput("")}
            aria-label="Hapus pencarian"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        ) : null}
      </div>

      {q ? (
        <>
          <p className="mt-4 text-sm text-zinc-400">
            {loading
              ? `Mencari “${q}”…`
              : `${filtered.length} hasil untuk “${q}”${verifying ? " (memverifikasi jenis…)" : ""}`}
          </p>

          <div className="mt-3 flex gap-2 text-xs">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`rounded-full px-4 py-1.5 ring-1 ${filter === f.value ? "bg-red-600 text-white ring-red-600" : "text-zinc-300 ring-white/15 hover:ring-white/40"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mt-6">
              <CardSkeleton />
            </div>
          ) : (
            // Grid vertikal seperti halaman film/series — semua hasil
            // terlihat sekaligus, tidak ada yang terpotong di rail.
            <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((d, i) => (
                <div key={`${d.slug}-${i}`} className="min-w-0 [&>a]:w-full">
                  <ContentCard
                    item={d.item}
                    kind={d.kind}
                    kindPending={d.kind === undefined}
                  />
                </div>
              ))}
            </div>
          )}

          {!loading && error ? (
            <p className="mt-6 rounded-xl border border-yellow-800 bg-yellow-950/60 p-4 text-sm text-yellow-200">{error}</p>
          ) : null}

          {!loading && !error && q && filtered.length === 0 ? (
            <div className="mt-6 rounded-xl bg-zinc-900 p-6 text-center ring-1 ring-white/10">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto h-10 w-10 text-zinc-500"
              >
                <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5 21 21" />
              </svg>
              <p className="mt-2 text-sm font-semibold text-white">Tidak ada hasil untuk “{q}”</p>
              <p className="mt-1 text-xs text-zinc-400">
                {items.length > 0
                  ? "Coba pilih filter “Semua”, atau periksa ejaan."
                  : "Coba kata kunci lain atau periksa ejaan."}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        // Kolom dikunci minmax agar rail tidak mendorong lebar halaman
        // (bug yang sama seperti beranda sebelum diperbaiki).
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8">
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">Film populer</h2>
            {exploreLoading ? (
              <CardSkeleton />
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {exploreMovies.map((it, i) => (
                  <div key={`${itemSlug(it)}-${i}`} className="min-w-0 [&>a]:w-full">
                    <ContentCard item={it} kind="movie" />
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">Series populer</h2>
            {exploreLoading ? (
              <CardSkeleton />
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {exploreSeries.map((it, i) => (
                  <div key={`${itemSlug(it)}-${i}`} className="min-w-0 [&>a]:w-full">
                    <ContentCard item={it} kind="series" />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-8 text-sm text-zinc-400">Memuat…</div>}>
      <SearchInner />
    </Suspense>
  );
}
