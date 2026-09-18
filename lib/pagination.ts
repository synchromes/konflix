const MAX_PAGE = 200;

// Nomor halaman datang dari query string dan dipakai untuk menyusun URL upstream,
// jadi harus selalu bilangan bulat positif dalam rentang yang wajar.
export function parsePage(raw?: string): number {
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  const int = Math.floor(n);
  return int >= 1 && int <= MAX_PAGE ? int : 1;
}

export { MAX_PAGE };
