"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ContentCard from "@/components/ContentCard";
import {
  clientIdlix,
  clientKinds,
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

function SearchInner() {
  const sp = useSearchParams();
  const q = (sp.get("q") ?? "").trim();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [kinds, setKinds] = useState<Record<string, Kind>>({});
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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
              ? "Tidak bisa menghubungi IDLIX-API. Pastikan API jalan, lalu coba lagi."
              : json.success === false && json.message
                ? `Sumber menolak permintaan: “${json.message}”.`
                : ""
          );
        })
        .catch(() => {
          if (!ac.signal.aborted) setError("Gagal menghubungi API.");
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

  const decorated = items.map((item) => {
    const slug = itemSlug(item);
    const kind = kinds[slug];
    return { item, slug, kind, effective: kind ?? itemKind(item) };
  });
  const filtered = decorated.filter((d) => filter === "all" || d.effective === filter);

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black text-white">
        {q ? `Hasil untuk “${q}”` : "Pencarian"}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        {loading
          ? "Mencari…"
          : q
            ? `${filtered.length} hasil${verifying ? " (memverifikasi jenis…)" : ""}`
            : "Ketik kata kunci di kolom atas, lalu tekan Cari."}
      </p>

      <div className="mt-4 flex gap-2 text-xs">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={`rounded-full px-3 py-1 ring-1 ${filter === f.value ? "bg-red-600 text-white ring-red-600" : "text-zinc-300 ring-white/15 hover:ring-white/40"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[240px] w-[160px] animate-pulse rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          {filtered.map((d, i) => (
            <ContentCard
              key={`${d.slug}-${i}`}
              item={d.item}
              kind={d.kind}
              kindPending={d.kind === undefined}
            />
          ))}
        </div>
      )}

      {!loading && error ? (
        <p className="mt-6 rounded-xl border border-yellow-800 bg-yellow-950/60 p-4 text-sm text-yellow-200">{error}</p>
      ) : null}

      {!loading && !error && q && filtered.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-400">
          {items.length > 0
            ? `Tidak ada hasil untuk filter ini, tapi ada ${items.length} hasil lain — coba pilih “Semua”.`
            : "Tidak ada hasil. Coba kata kunci lain atau periksa ejaan."}
        </p>
      ) : null}
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
