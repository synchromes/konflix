import type { ReactNode } from "react";
import Link from "next/link";
import BrowseResults from "@/components/BrowseResults";
import ApiNotice from "@/components/ApiNotice";
import { fetchSection, type Kind } from "@/lib/idlix";

// Halaman listing (film/series) untuk satu nomor halaman. Dipakai bersama supaya
// perilaku paginasi hanya didefinisikan sekali.
export default async function PagedListing({
  title,
  page,
  hrefBase,
  listPath,
  kind,
  chips,
}: {
  title: string;
  page: number;
  hrefBase: string;
  listPath: string;
  kind: Kind;
  chips?: ReactNode;
}) {
  const section = await fetchSection(listPath);
  // Sumber mengembalikan daftar kosong di luar jangkauan (mis. halaman 999),
  // jadi tombol "Berikutnya" dihilangkan saat kosong atau saat API mati.
  const hasNext = section.items.length > 0 && !section.apiDown;

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black text-white sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-zinc-400">Jelajahi semua {kind === "movie" ? "film" : "series"}. Halaman {page}.</p>

      {chips ? <div className="mt-4 flex flex-wrap gap-2">{chips}</div> : null}

      <div className="mt-6">
        {section.items.length === 0 && page > 1 ? (
          <>
            <ApiNotice show={section.apiDown} />
            <p className="rounded-xl bg-zinc-900 p-6 text-sm text-zinc-400 ring-1 ring-white/10">
              Halaman {page} kosong — kamu mencapai akhir katalog.{" "}
              <Link href={`${hrefBase}?page=${page - 1}`} className="text-red-400 hover:text-red-300">
                Kembali →
              </Link>
            </p>
          </>
        ) : (
          <BrowseResults
            section={section}
            kind={kind}
            emptyLabel={`Sumber tidak menyediakan daftar ${kind === "movie" ? "film" : "series"} saat ini.`}
          />
        )}
      </div>

      {section.items.length > 0 ? (
        <div className="mt-8 flex gap-3">
          {page > 1 ? (
            <Link
              href={`${hrefBase}?page=${page - 1}`}
              className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
            >
              ← Sebelumnya
            </Link>
          ) : null}
          {hasNext ? (
            <Link
              href={`${hrefBase}?page=${page + 1}`}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700"
            >
              Berikutnya →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
