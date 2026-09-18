// Normalisasi payload upstream IDLIX-API.
//
// Bentuk respons scraper tidak stabil (field hilang, tipe berubah, entri sampah),
// jadi semua data eksternal masuk lewat normalizer di sini. Tujuannya:
// 1. Tidak ada `as ContentItem` yang membabi buta di seluruh aplikasi.
// 2. Nilai dengan tipe salah (mis. `year: null`, `rating: "8"`) tidak menjatuhkan UI.

import type {
  ContentItem,
  ContentLink,
  Envelope,
  Pagination,
  StreamData,
  StreamSource,
  StreamTrack,
} from "./idlix";

export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Ketat terhadap tipe: field teks yang dikirim sebagai angka/null adalah sampah
// dan lebih baik dibuang daripada dipaksa menjadi string.
export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export function asOptionalString(value: unknown): string | undefined {
  const s = asString(value).trim();
  return s === "" ? undefined : s;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

// `year`/`rating` bisa berupa angka maupun string tergantung endpoint.
export function asNumberOrString(value: unknown): number | string | undefined {
  if (typeof value === "string") {
    const s = value.trim();
    return s === "" ? undefined : s;
  }
  return asNumber(value);
}

export function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const out = value.map((v) => asString(v).trim()).filter((v) => v !== "");
    return out.length > 0 ? out : undefined;
  }
  // Sebagian endpoint mengirim genres sebagai "Action, Drama".
  if (typeof value === "string") {
    const out = value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "");
    return out.length > 0 ? out : undefined;
  }
  return undefined;
}

export function asContentLink(value: unknown): ContentLink | undefined {
  if (typeof value === "string") return { url: value };
  if (!isRecord(value)) return undefined;
  const link: ContentLink = {};
  const endpoint = asOptionalString(value.endpoint);
  const url = asOptionalString(value.url);
  const thumbnail = asOptionalString(value.thumbnail);
  if (endpoint) link.endpoint = endpoint;
  if (url) link.url = url;
  if (thumbnail) link.thumbnail = thumbnail;
  return Object.keys(link).length > 0 ? link : undefined;
}

export function asContentItem(raw: unknown): ContentItem | null {
  if (!isRecord(raw)) return null;
  const item: ContentItem = {};
  const slug = asOptionalString(raw.slug);
  const title = asOptionalString(raw.title);
  const name = asOptionalString(raw.name);
  const originalTitle = asOptionalString(raw.originalTitle);
  const poster = asOptionalString(raw.poster);
  const backdrop = asOptionalString(raw.backdrop);
  const image = asOptionalString(raw.image);
  const type = asOptionalString(raw.type);
  const quality = asOptionalString(raw.quality);
  const overview = asOptionalString(raw.overview);
  const trailer = asOptionalString(raw.trailer);
  const year = asNumberOrString(raw.year);
  const rating = asNumberOrString(raw.rating);
  const season = asNumber(raw.season);
  const genres = asStringArray(raw.genres);
  const link = asContentLink(raw.link);

  if (slug) item.slug = slug;
  if (title) item.title = title;
  if (name) item.name = name;
  if (originalTitle) item.originalTitle = originalTitle;
  if (poster) item.poster = poster;
  if (backdrop) item.backdrop = backdrop;
  if (image) item.image = image;
  if (type) item.type = type;
  if (quality) item.quality = quality;
  if (overview) item.overview = overview;
  if (trailer) item.trailer = trailer;
  if (year !== undefined) item.year = year;
  if (rating !== undefined) item.rating = rating;
  if (season !== undefined) item.season = season;
  if (genres) item.genres = genres;
  if (link) item.link = link;
  return item;
}

export function asContentItemArray(value: unknown): ContentItem[] {
  if (!Array.isArray(value)) return [];
  const out: ContentItem[] = [];
  for (const raw of value) {
    const item = asContentItem(raw);
    if (item) out.push(item);
  }
  return out;
}

function readPagination(raw: JsonObject): Pagination {
  const pagination: Pagination = {};
  const currentPage = asNumber(raw.currentPage);
  const totalPages = asNumber(raw.totalPages);
  if (currentPage !== undefined) pagination.currentPage = currentPage;
  if (totalPages !== undefined) pagination.totalPages = totalPages;
  if (typeof raw.hasNext === "boolean") pagination.hasNext = raw.hasNext;
  return pagination;
}

// Envelope IDLIX-API: { success, data, pagination?, filters?, message? }.
// Satu-satunya tempat nilai `data` di-assert ke tipe yang diharapkan pemanggil —
// pemakai tetap harus memvalidasi bentuknya (lihat asContentItemArray/readStreamData).
export function readEnvelope<T = unknown>(raw: unknown): Envelope<T> | null {
  if (!isRecord(raw)) return null;
  if (!("data" in raw)) return null;
  return {
    success: raw.success === true,
    data: raw.data as T,
    ...(isRecord(raw.pagination) ? { pagination: readPagination(raw.pagination) } : {}),
    ...(isRecord(raw.filters) ? { filters: raw.filters } : {}),
    ...(typeof raw.message === "string" ? { message: raw.message } : {}),
  };
}

function asStreamSource(value: unknown): StreamSource | string | null {
  if (typeof value === "string") return value.trim() === "" ? null : value;
  if (!isRecord(value)) return null;
  const source: StreamSource = {};
  const file = asOptionalString(value.file);
  const src = asOptionalString(value.src);
  const label = asOptionalString(value.label);
  if (file) source.file = file;
  if (src) source.src = src;
  if (label) source.label = label;
  return Object.keys(source).length > 0 ? source : null;
}

export function asStreamTrack(raw: unknown): StreamTrack | null {
  if (!isRecord(raw)) return null;
  const track: StreamTrack = {};
  const label = asOptionalString(raw.label);
  const lang = asOptionalString(raw.lang);
  const file = asOptionalString(raw.file);
  const src = asOptionalString(raw.src);
  const url = asOptionalString(raw.url);
  const path = asOptionalString(raw.path);
  const srclang = asOptionalString(raw.srclang);
  const kind = asOptionalString(raw.kind);
  if (label) track.label = label;
  if (lang) track.lang = lang;
  if (file) track.file = file;
  if (src) track.src = src;
  if (url) track.url = url;
  if (path) track.path = path;
  if (srclang) track.srclang = srclang;
  if (kind) track.kind = kind;
  return Object.keys(track).length > 0 ? track : null;
}

function asTrackArray(value: unknown): StreamTrack[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: StreamTrack[] = [];
  for (const raw of value) {
    const track = asStreamTrack(raw);
    if (track) out.push(track);
  }
  return out.length > 0 ? out : undefined;
}

export function readStreamData(raw: unknown): StreamData | null {
  if (!isRecord(raw)) return null;
  const data: StreamData = {};

  const streamUrl = asOptionalString(raw.streamUrl);
  if (streamUrl) data.streamUrl = streamUrl;

  if (Array.isArray(raw.sources)) {
    const sources: Array<string | StreamSource> = [];
    for (const rawSource of raw.sources) {
      const source = asStreamSource(rawSource);
      if (source !== null) sources.push(source);
    }
    if (sources.length > 0) data.sources = sources;
  }

  const subtitles = asTrackArray(raw.subtitles);
  if (subtitles) data.subtitles = subtitles;
  const tracks = asTrackArray(raw.tracks);
  if (tracks) data.tracks = tracks;

  const slug = asOptionalString(raw.slug);
  const title = asOptionalString(raw.title);
  const videoId = asOptionalString(raw.videoId);
  const durationSec = asNumber(raw.durationSec);
  const duration = asNumber(raw.duration);
  const maxHeight = asNumber(raw.maxHeight);
  const expiresAt = asNumber(raw.expiresAt);
  const season = asNumber(raw.season);
  const episode = asNumber(raw.episode);

  if (slug) data.slug = slug;
  if (title) data.title = title;
  if (videoId) data.videoId = videoId;
  if (durationSec !== undefined) data.durationSec = durationSec;
  if (duration !== undefined) data.duration = duration;
  if (maxHeight !== undefined) data.maxHeight = maxHeight;
  if (expiresAt !== undefined) data.expiresAt = expiresAt;
  if (season !== undefined) data.season = season;
  if (episode !== undefined) data.episode = episode;

  return Object.keys(data).length > 0 ? data : null;
}

// Detail (movie/series) tetap divalidasi seperlunya oleh pemanggil karena
// bentuknya banyak varian; di sini hanya dipastikan objeknya ada.
export function readDetail(raw: unknown): JsonObject | null {
  return isRecord(raw) ? raw : null;
}
