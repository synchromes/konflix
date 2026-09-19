"use client";

import type { HlsConfig } from "hls.js";

// Konfigurasi hls.js untuk CDN yang hostile: edge Cloudflare kadang SYN-drop
// (ETIMEDOUT) atau 403 sesaat, lalu pulih. Default hls.js menyerah terlalu
// cepat (manifest 1x, frag 4x, timeout pendek) sehingga satu jendela buruk
// langsung jadi layar error. Preset ini: retry berlapis + timeout longgar +
// buffer depan besar agar pemutaran selamat melewati jendela buruk.
export function resilientHlsConfig(): Partial<HlsConfig> {
  return {
    enableWorker: true,
    // Mulai konservatif di jaringan lambat, naikkan perlahan bila lega.
    abrEwmaDefaultEstimate: 600_000,
    capLevelToPlayerSize: true,
    // Buffer depan 60 dtk (maks 600 dtk) — pemutaran terus jalan walau
    // beberapa segmen berturut-turut gagal dimuat sesaat.
    maxBufferLength: 60,
    maxMaxBufferLength: 600,
    backBufferLength: 60,
    // Retry: manifest & level & frag jauh di atas default.
    manifestLoadingMaxRetry: 4,
    manifestLoadingRetryDelay: 1500,
    manifestLoadingTimeOut: 25000,
    levelLoadingMaxRetry: 6,
    levelLoadingRetryDelay: 1500,
    levelLoadingTimeOut: 25000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1500,
    fragLoadingTimeOut: 40000,
  };
}

// Berapa kali engine boleh startLoad ulang (dengan backoff) sebelum dianggap
// fatal di level hook — di atas retry internal hls.js di atas.
export const HOOK_NETWORK_RETRIES = 3;

// Retry untuk jalur native (tanpa retry internal apa pun).
export const NATIVE_RETRIES = 3;

// Backoff antar percobaan hook: 1.5s, 3s, 6s.
export function hookRetryDelayMs(retryIndex: number): number {
  return 1500 * 2 ** retryIndex;
}
