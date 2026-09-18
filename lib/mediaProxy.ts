import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ---- Media proxy (server-only) ----
// Player memutar stream dari CDN pihak ketiga yang TIDAK mengirim header CORS.
// Karena itu manifest (.m3u8 / config-*.json), key, segmen, dan subtitle harus
// dilewatkan lewat origin aplikasi ini. Agar route /api/media tidak menjadi
// open-proxy, setiap URL media ditandatangani HMAC di sini.

const PROCESS_SECRET = randomBytes(32).toString("hex");

function secret(): string {
  // Set STREAM_PROXY_SECRET agar tanda tangan tetap valid lintas restart/HMR dan
  // konsisten di lebih dari satu instance. Tanpa itu, secret acak per-proses dipakai.
  return process.env.STREAM_PROXY_SECRET?.trim() || PROCESS_SECRET;
}

export const MEDIA_TTL_SEC = 6 * 60 * 60;

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signedMediaPath(src: string, ttlSeconds = MEDIA_TTL_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signature(`${exp}.${src}`);
  return `/api/media?src=${encodeURIComponent(src)}&exp=${exp}&sig=${sig}`;
}

export function verifyMediaPath(
  src: string,
  exp: number,
  sig: string
): { ok: true } | { ok: false; reason: string } {
  if (!src) return { ok: false, reason: "src kosong" };
  if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: "exp tidak valid" };
  if (exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "tautan media kedaluwarsa" };
  if (!sig) return { ok: false, reason: "sig kosong" };
  const expected = signature(`${exp}.${src}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "sig tidak valid" };
  return { ok: true };
}

// Pertahanan berlapis walaupun URL selalu berasal dari upstream: tolak host internal.
export function isProxyableMediaUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return false;
  if (host.endsWith(".internal") || host.endsWith(".local")) return false;
  if (/^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) return false;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
  return true;
}

export function absolutizeMediaUrl(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

// Tulis ulang playlist HLS: setiap URI (baris segmen + atribut URI="...") dialihkan
// ke proxy kita supaya tidak ada permintaan lintas-origin dari browser.
export function rewritePlaylist(body: string, base: string): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (match, uri: string) => {
          const absolute = absolutizeMediaUrl(uri, base);
          return absolute ? `URI="${signedMediaPath(absolute)}"` : match;
        });
      }
      const absolute = absolutizeMediaUrl(trimmed, base);
      return absolute ? signedMediaPath(absolute) : line;
    })
    .join("\n");
}

export function isPlaylistBody(body: string, contentType: string, url: string): boolean {
  if (/mpegurl|x-mpegURL/i.test(contentType)) return true;
  if (body.trimStart().startsWith("#EXTM3U")) return true;
  return /\.m3u8?(\?|$)/i.test(url);
}
