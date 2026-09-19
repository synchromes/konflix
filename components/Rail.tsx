"use client";

import Link from "next/link";
import type { ContentItem, Kind } from "@/lib/idlix";
import ContentCard from "./ContentCard";
import ScrollRow from "./ScrollRow";

export default function Rail({
  title,
  items,
  href,
  kind,
}: {
  title: string;
  items: ContentItem[];
  href?: string;
  kind?: Kind;
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className="relative min-w-0">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-lg font-bold text-white sm:text-xl">{title}</h2>
        {href ? (
          <Link href={href} className="text-xs font-medium text-zinc-400 hover:text-white">
            Lihat semua →
          </Link>
        ) : null}
      </div>
      <ScrollRow>
        {items.map((it, idx) => (
          <ContentCard key={`${it.slug ?? it.title}-${idx}`} item={it} kind={kind} />
        ))}
      </ScrollRow>
    </section>
  );
}
