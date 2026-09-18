export default function Loading() {
  return (
    <div className="py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat…</span>
      <div className="h-[52vh] min-h-[320px] w-full animate-pulse rounded-xl bg-zinc-900" />
      <div className="mt-8 flex gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[240px] w-[160px] shrink-0 animate-pulse rounded-lg bg-zinc-900" />
        ))}
      </div>
    </div>
  );
}
