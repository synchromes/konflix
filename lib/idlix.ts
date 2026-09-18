// Ekstensi .ts eksplisit diperlukan agar file ini juga bisa dijalankan langsung
// oleh `node --test` (type-stripping Node tidak melakukan resolusi tanpa ekstensi).
import { asContentItemArray, asString, isRecord, readEnvelope } from "./upstream.ts";

// Tipe mengikuti envelope IDLIX-API v3: { success, data, pagination, filters }.
// Semua field opsional karena scraper bisa menghilangkan field kapan saja, tetapi
// tidak ada lagi index signature `[k: string]: unknown` — bentuk yang tidak
// diharapkan ditangani oleh normalizer di lib/upstream.ts, bukan dengan cast.

export interface Pagination {
  currentPage?: number;
  totalPages?: number;
  hasNext?: boolean;
}

export interface Envelope<T = unknown> {
  success: boolean;
  data: T;
  pagination?: Pagination;
  filters?: Record<string, unknown>;
  message?: string;
}

export interface ContentLink {
  endpoint?: string;
  url?: string;
  thumbnail?: string;
}

export interface ContentItem {
  slug?: string;
  title?: string;
  name?: string;
  originalTitle?: string;
  poster?: string;
  backdrop?: string;
  image?: string;
  year?: number | string;
  type?: string;
  quality?: string;
  rating?: number | string;
  season?: number;
  genres?: string[];
  overview?: string;
  trailer?: string;
  link?: ContentLink;
}

export interface StreamTrack {
  label?: string;
  file?: string;
  src?: string;
  url?: string;
  path?: string;
  srclang?: string;
  lang?: string;
  kind?: string;
}

export interface StreamSource {
  file?: string;
  src?: string;
  label?: string;
}

export interface StreamData {
  slug?: string;
  streamUrl?: string;
  sources?: Array<string | StreamSource>;
  subtitles?: StreamTrack[];
  tracks?: StreamTrack[];
  duration?: number;
  durationSec?: number;
  videoId?: string;
  title?: string;
  maxHeight?: number;
  expiresAt?: number;
  season?: number;
  episode?: number;
}

// Port default mengikuti container IDLIX-API (docker compose) — aplikasi ini sendiri
// berjalan di 4001, jadi 3000 bukan nilai yang benar.
export const IDLIX_SERVER_BASE =
  process.env.IDLIX_API_URL?.replace(/\/$/, "") || "http://localhost:4000/api";

// ---- Server-side fetch (langsung ke IDLIX-API, dengan cache Next) ----
export async function serverIdlix<T>(
  path: string,
  opts: { revalidate?: number; noStore?: boolean } = {}
): Promise<Envelope<T> | null> {
  const url = `${IDLIX_SERVER_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      ...(opts.noStore ? { cache: "no-store" } : { next: { revalidate: opts.revalidate ?? 3600 } }),
    });
    if (!res.ok) return null;
    return readEnvelope<T>(await res.json());
  } catch {
    return null;
  }
}

export interface Section {
  items: ContentItem[];
  live: boolean;
  // true = API benar-benar tidak bisa dihubungi (bukan sekadar hasil kosong).
  apiDown: boolean;
}

// Nama key yang lazim dipakai upstream untuk daftar. `/leaderboard` misalnya
// mengirim `data.topMovies`/`data.topSeries`, bukan `data.results`.
const LIST_KEYS = [
  "results",
  "items",
  "movies",
  "series",
  "content",
  "topMovies",
  "topSeries",
  "list",
];

// Pembungkus standar untuk semua halaman listing supaya halaman bisa membedakan
// "API mati" (tampilkan mode contoh) dari "hasil memang kosong" (tampilkan empty state).
export async function fetchSection(
  path: string,
  opts: { revalidate?: number; keys?: string[] } = {}
): Promise<Section> {
  const json = await serverIdlix<ContentItem[]>(path, { revalidate: opts.revalidate ?? 1800 });
  const items = opts.keys ? pickLists(json, opts.keys) : pickList(json);
  return { items, live: items.length > 0, apiDown: json === null };
}

// Entri sampah dari upstream: judul kosong atau slug "undefined".
export function isUsableItem(i: ContentItem): boolean {
  const slug = itemSlug(i);
  return itemTitleRaw(i) !== "" && slug !== "" && !slug.includes("undefined");
}

export function filterUsableItems(items: ContentItem[]): ContentItem[] {
  return items.filter(isUsableItem);
}

function pickFromObject(obj: Record<string, unknown>, keys: string[]): ContentItem[] {
  for (const key of keys) {
    if (Array.isArray(obj[key])) return asContentItemArray(obj[key]);
  }
  // Fallback: array pertama yang benar-benar berisi objek.
  for (const value of Object.values(obj)) {
    if (Array.isArray(value) && value.some((v) => v && typeof v === "object")) {
      return asContentItemArray(value);
    }
  }
  return [];
}

// Gabungkan beberapa daftar dari satu respons (mis. leaderboard: film + series).
export function pickLists(json: Envelope<unknown> | null, keys: string[]): ContentItem[] {
  if (!json) return [];
  const d = json.data;
  if (Array.isArray(d)) return filterUsableItems(asContentItemArray(d));
  if (!isRecord(d)) return [];
  const out: ContentItem[] = [];
  for (const key of keys) {
    if (Array.isArray(d[key])) out.push(...asContentItemArray(d[key]));
  }
  return filterUsableItems(out);
}

export function pickList(json: Envelope<unknown> | null): ContentItem[] {
  if (!json) return [];
  const d = json.data;
  if (Array.isArray(d)) return filterUsableItems(asContentItemArray(d));
  if (!isRecord(d)) return [];
  return filterUsableItems(pickFromObject(d, LIST_KEYS));
}

function itemTitleRaw(i: ContentItem): string {
  return String(i.title ?? i.name ?? "").trim();
}

// ---- Client-side fetch (via proxy /api/idlix agar bebas CORS) ----
// null = gagal jaringan (API benar-benar tidak reachable).
// success:false + message = API menjawab tapi request gagal (mis. judul tak ada di upstream).
export async function clientIdlix<T>(
  path: string,
  init?: { signal?: AbortSignal }
): Promise<Envelope<T> | null> {
  try {
    const res = await fetch(`/api/idlix${path.startsWith("/") ? path : `/${path}`}`, {
      signal: init?.signal,
    });
    const raw = await res.json().catch(() => null);
    return readEnvelope<T>(raw) ?? { success: res.ok, data: [] as unknown as T };
  } catch {
    return null;
  }
}

// Pemetaan slug -> jenis konten untuk klien. Label `type` di endpoint list tidak bisa
// dipercaya, jadi tipe diverifikasi lewat detail movie/series (di-cache 2 jam di server).
export async function clientKinds(
  slugs: string[],
  init?: { signal?: AbortSignal }
): Promise<Record<string, Kind>> {
  if (slugs.length === 0) return {};
  try {
    const res = await fetch(`/api/kind?slugs=${encodeURIComponent(slugs.join(","))}`, {
      signal: init?.signal,
    });
    if (!res.ok) return {};
    const raw: unknown = await res.json().catch(() => null);
    if (!isRecord(raw) || !isRecord(raw.kinds)) return {};
    const out: Record<string, Kind> = {};
    for (const [slug, kind] of Object.entries(raw.kinds)) {
      if (kind === "movie" || kind === "series") out[slug] = kind;
    }
    return out;
  } catch {
    return {};
  }
}

interface KindProbe {
  title?: string;
  poster?: string;
  image?: string;
}

export interface KindInfo {
  kind: Kind;
  title: string;
  poster: string;
}

// Kebenaran akhir soal movie-vs-series: label `type` di list upstream
// sering salah (mis. series dilabeli movie), jadi tanyakan kedua endpoint
// detail secara paralel. Sekalian mengambil judul & poster asli supaya halaman
// watch dan riwayat tontonan tidak menampilkan slug mentah.
export async function resolveKindInfo(
  slug: string,
  preferred: Kind = "movie"
): Promise<KindInfo | null> {
  const enc = encodeURIComponent(slug);
  const [movie, series] = await Promise.all([
    serverIdlix<KindProbe>(`/movie/${enc}`, { revalidate: 7200 }),
    serverIdlix<KindProbe>(`/series/${enc}`, { revalidate: 7200 }),
  ]);
  const movieTitle = movie?.success ? String(movie.data?.title ?? "") : "";
  const seriesTitle = series?.success ? String(series.data?.title ?? "") : "";
  const posterOf = (probe: KindProbe | undefined) => String(probe?.poster ?? probe?.image ?? "");

  if (movieTitle && seriesTitle) {
    const useMovie = preferred === "movie";
    return {
      kind: preferred,
      title: useMovie ? movieTitle : seriesTitle,
      poster: useMovie ? posterOf(movie?.data) : posterOf(series?.data),
    };
  }
  if (movieTitle) return { kind: "movie", title: movieTitle, poster: posterOf(movie?.data) };
  if (seriesTitle) return { kind: "series", title: seriesTitle, poster: posterOf(series?.data) };
  return null;
}

export async function resolveKind(slug: string, preferred: Kind = "movie"): Promise<Kind | null> {
  const info = await resolveKindInfo(slug, preferred);
  return info?.kind ?? null;
}

// ID YouTube dari berbagai bentuk URL trailer (watch?v=, youtu.be/, embed/).
export function youtubeId(url: unknown): string {
  if (typeof url !== "string") return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}

// Verifikasi jenis banyak slug sekaligus dengan batas konkurensi, supaya scraper
// upstream tidak dibanjiri permintaan. Dipakai endpoint /api/kind.
export async function resolveKinds(
  slugs: string[],
  preferred: Kind = "movie",
  concurrency = 4
): Promise<Record<string, Kind>> {
  const out: Record<string, Kind> = {};
  const queue = [...new Set(slugs.filter(Boolean))].slice(0, 24);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
    while (cursor < queue.length) {
      const slug = queue[cursor];
      cursor += 1;
      const kind = await resolveKind(slug, preferred);
      if (kind) out[slug] = kind;
    }
  });
  await Promise.all(workers);
  return out;
}

export function itemTitle(i: ContentItem): string {
  return asString(i.title ?? i.name ?? "Tanpa judul") || "Tanpa judul";
}

export function itemSlug(i: ContentItem): string {
  const candidates = [i.slug, i.link?.endpoint, i.link?.url];
  for (const c of candidates) {
    if (typeof c !== "string" || !c) continue;
    let raw = c;
    // slug kadang berupa URL penuh atau "movie/slug" — ambil segmen terakhir
    if (raw.includes("://")) {
      try {
        const u = new URL(raw);
        const seg = u.pathname.split("/").filter(Boolean);
        raw = seg[seg.length - 1] ?? "";
      } catch {
        continue;
      }
    } else {
      raw = raw.split("/").filter(Boolean).pop() ?? "";
    }
    if (raw && raw !== "undefined") return raw;
  }
  return "";
}

export function itemPoster(i: ContentItem): string {
  return asString(i.poster ?? i.image ?? i.backdrop ?? i.link?.thumbnail ?? "");
}

export type Kind = "movie" | "series";

// Jenis konten final: paksa dari konteks halaman bila diberikan
// (label `type` upstream sering salah, mis. series dilabeli movie).
export function itemKind(i: ContentItem, forced?: Kind): Kind {
  if (forced) return forced;
  const t = asString(i.type).toLowerCase();
  if (t.includes("series") || t.includes("tv")) return "series";
  return "movie";
}

export function kindLabel(kind: Kind): string {
  return kind === "series" ? "Series" : "Film";
}

export function itemDetailHref(i: ContentItem, forced?: Kind): string {
  const slug = itemSlug(i);
  const kind = itemKind(i, forced);
  return `/${kind}/${encodeURIComponent(slug)}`;
}

export function extractStreamUrl(s: StreamData | null): string {
  if (!s) return "";
  if (typeof s.streamUrl === "string" && s.streamUrl) return s.streamUrl;
  const first = s.sources?.[0];
  if (typeof first === "string") return first;
  if (first) return asString(first.file ?? first.src ?? "");
  return "";
}

export function extractSubtitles(s: StreamData | null): { label: string; src: string; srclang: string }[] {
  if (!s) return [];
  const raw = [...(s.subtitles ?? []), ...(s.tracks ?? [])];
  return raw
    .map((t, idx) => ({
      label: asString(t.label ?? t.lang ?? `Subtitle ${idx + 1}`) || `Subtitle ${idx + 1}`,
      // Bentuk asli IDLIX-API: { lang, label, url } — dukung juga file/src/path.
      src: asString(t.file ?? t.src ?? t.url ?? t.path ?? ""),
      srclang: asString(t.srclang ?? t.lang ?? "id") || "id",
    }))
    .filter((t) => Boolean(t.src));
}

// Format detik -> "1j 51m" / "62m" untuk info durasi di halaman watch.
export function formatDuration(sec: unknown): string {
  const n = typeof sec === "number" ? sec : Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const m = Math.round(n / 60);
  if (m < 60) return `${m} mnt`;
  return `${Math.floor(m / 60)}j ${m % 60}m`;
}
