import BrowseResults from "@/components/BrowseResults";
import { fetchSection, type Kind } from "@/lib/idlix";

function parseKind(value?: string): Kind | undefined {
  return value === "movie" || value === "series" ? value : undefined;
}

export default async function NetworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const kind = parseKind(sp.type);
  const section = await fetchSection(
    `/network/${encodeURIComponent(slug)}${kind ? `?type=${kind}` : ""}`
  );

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black capitalize text-white">Network: {slug.replace(/-/g, " ")}</h1>
      <p className="mt-1 text-sm text-zinc-400">{section.items.length} judul</p>
      <div className="mt-6">
        <BrowseResults section={section} kind={kind} />
      </div>
    </div>
  );
}
