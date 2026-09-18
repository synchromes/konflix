import Link from "next/link";
import BrowseResults from "@/components/BrowseResults";
import { fetchSection, type Kind } from "@/lib/idlix";

// Catatan: halaman ini membaca searchParams sehingga selalu dirender dinamis.
// `export const revalidate` tidak berpengaruh di sini — caching dilakukan pada
// level fetch (lihat `next: { revalidate }` di lib/idlix.ts).

function parseKind(value?: string): Kind | undefined {
  return value === "movie" || value === "series" ? value : undefined;
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const kind = parseKind(sp.type);
  const section = await fetchSection(`/genre/${encodeURIComponent(slug)}${kind ? `?type=${kind}` : ""}`);

  const filters: Array<{ label: string; type?: Kind }> = [
    { label: "Semua" },
    { label: "Film", type: "movie" },
    { label: "Series", type: "series" },
  ];

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black capitalize text-white">Genre: {slug.replace(/-/g, " ")}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {section.items.length} judul{kind ? ` • ${kind === "movie" ? "film" : "series"}` : ""}
      </p>
      <div className="mt-4 flex gap-2 text-xs">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.type ? `/genre/${encodeURIComponent(slug)}?type=${f.type}` : `/genre/${encodeURIComponent(slug)}`}
            className={`rounded-full border px-3 py-1 ${
              (kind ?? undefined) === f.type
                ? "border-red-600 bg-red-600/20 text-white"
                : "border-white/15 text-zinc-300 hover:border-red-600"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <BrowseResults section={section} kind={kind} />
      </div>
    </div>
  );
}
