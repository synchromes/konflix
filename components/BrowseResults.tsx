import ContentCard from "@/components/ContentCard";
import ApiNotice from "@/components/ApiNotice";
import { MOCK_ITEMS } from "@/lib/mock";
import type { Kind, Section } from "@/lib/idlix";

// Dipakai semua halaman listing supaya hanya ada satu perilaku:
// - API tidak bisa dihubungi  -> tampilkan data contoh + peringatan.
// - API menjawab tapi kosong  -> empty state jujur (JANGAN data contoh).
export default function BrowseResults({
  section,
  kind,
  emptyLabel,
}: {
  section: Section;
  kind?: Kind;
  emptyLabel?: string;
}) {
  const { items, apiDown } = section;

  if (items.length > 0) {
    return (
      <>
        <ApiNotice show={apiDown} />
        <div className="flex flex-wrap gap-3">
          {items.map((it, i) => (
            // Beberapa kartu pertama biasanya berada di atas lipatan pada halaman
            // listing, jadi dimuat eager supaya tidak jadi LCP yang terlambat.
            <ContentCard key={`${it.slug ?? it.title}-${i}`} item={it} kind={kind} eager={i < 6} />
          ))}
        </div>
      </>
    );
  }

  if (apiDown) {
    const sample = kind ? MOCK_ITEMS.filter((m) => m.type === kind) : MOCK_ITEMS;
    return (
      <>
        <ApiNotice show />
        <div className="flex flex-wrap gap-3">
          {sample.map((it, i) => (
            <ContentCard key={`${it.slug ?? it.title}-${i}`} item={it} kind={kind} />
          ))}
        </div>
      </>
    );
  }

  return (
    <p className="rounded-xl bg-zinc-900 p-6 text-sm text-zinc-400 ring-1 ring-white/10">
      {emptyLabel ?? "Tidak ada judul yang cocok. Sumber sedang tidak menyediakan data untuk filter ini."}
    </p>
  );
}
