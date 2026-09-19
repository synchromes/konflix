"use client";

import { useState } from "react";
import Dropdown from "@/components/Dropdown";
import { GENRES, NETWORKS, CURRENT_YEAR } from "@/lib/constants";

export interface GenreOption {
  value: string;
  label: string;
}

export interface BrowseFilters {
  sort: string;
  genre: string;
  country: string;
  year: string;
  network: string;
}

export const DEFAULT_FILTERS: BrowseFilters = {
  sort: "createdAt",
  genre: "",
  country: "",
  year: "",
  network: "",
};

export const SORTS = [
  { value: "createdAt", label: "Terbaru" },
  { value: "popularityScore", label: "Terpopuler" },
  { value: "voteAverage", label: "Rating tertinggi" },
  { value: "title", label: "Judul A–Z" },
];

export interface CountryOption {
  value: string;
  label: string;
}

function pretty(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const YEARS = Array.from({ length: 31 }, (_, i) => String(CURRENT_YEAR - i));

// Bar filter & sort ala Netflix: Urutkan, Genre, Negara, Tahun, Network.
// Nilai "Semua" = string kosong (tidak dikirim ke API).
export default function FilterBar({
  filters,
  onChange,
  countries,
  genres,
  lockedGenre,
}: {
  filters: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
  countries: CountryOption[];
  /** Daftar genre live dari API; fallback ke konstanta bila gagal dimuat. */
  genres: GenreOption[];
  /** Bila halaman sudah mengunci genre tertentu (halaman /genre/:slug). */
  lockedGenre?: string;
}) {
  const set = (patch: Partial<BrowseFilters>) => onChange({ ...filters, ...patch });
  const genreOptions =
    genres.length > 0
      ? genres
      : GENRES.map((g) => ({ value: g, label: pretty(g) }));
  // Hanya satu dropdown terbuka dalam satu waktu.
  const [openName, setOpenName] = useState<string | null>(null);
  const bind = (name: string) => ({
    open: openName === name,
    onOpenChange: (v: boolean) => setOpenName(v ? name : null),
  });
  const activeCount = [filters.genre, filters.country, filters.year, filters.network].filter(Boolean).length
    + (lockedGenre ? 1 : 0);

  return (
    <div className="rounded-xl bg-zinc-900/60 p-4 ring-1 ring-white/10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Dropdown
          label="Urutkan"
          value={filters.sort}
          onChange={(v) => set({ sort: v })}
          options={SORTS}
          {...bind("sort")}
        />
        {lockedGenre ? (
          <div className="min-w-0">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Genre
            </span>
            <span className="block truncate rounded-lg border border-red-600/60 bg-red-600/15 px-3 py-2 text-sm text-white">
              {pretty(lockedGenre)}
            </span>
          </div>
        ) : (
          <Dropdown
            label="Genre"
            value={filters.genre}
            onChange={(v) => set({ genre: v })}
            options={[{ value: "", label: "Semua genre" }, ...genreOptions]}
            {...bind("genre")}
          />
        )}
        <Dropdown
          label="Negara"
          value={filters.country}
          onChange={(v) => set({ country: v })}
          options={[{ value: "", label: "Semua negara" }, ...countries]}
          {...bind("country")}
        />
        <Dropdown
          label="Tahun"
          value={filters.year}
          onChange={(v) => set({ year: v })}
          options={[{ value: "", label: "Semua tahun" }, ...YEARS.map((y) => ({ value: y, label: y }))]}
          {...bind("year")}
        />
        <Dropdown
          label="Network"
          value={filters.network}
          onChange={(v) => set({ network: v })}
          options={[{ value: "", label: "Semua network" }, ...NETWORKS.map((n) => ({ value: n, label: pretty(n) }))]}
          {...bind("network")}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-zinc-400">
          {activeCount > 0 ? `${activeCount} filter aktif` : "Tanpa filter — menampilkan semuanya"}
        </p>
        {(filters.genre || filters.country || filters.year || filters.network || filters.sort !== "createdAt") ? (
          <button
            onClick={() => onChange({ ...DEFAULT_FILTERS, genre: lockedGenre ?? "" })}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            Atur ulang
          </button>
        ) : null}
      </div>
    </div>
  );
}
