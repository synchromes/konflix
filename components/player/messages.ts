"use client";

import { ErrorDetails, ErrorTypes, type ErrorData } from "hls.js";

// Pesan error spesifik agar tidak semua kegagalan tampil sebagai
// "Gagal memuat stream" (403 kedaluwarsa vs 5xx sumber vs jaringan).
export function describeHlsError(data: ErrorData): string {
  const code = data.response?.code;
  if (code === 401 || code === 403) return "Tautan stream sudah kedaluwarsa atau ditolak sumber.";
  if (code === 404) return "Manifest stream tidak ditemukan di sumber.";
  if (code && code >= 500) return `Sumber stream sedang bermasalah (HTTP ${code}).`;
  if (data.details === ErrorDetails.MANIFEST_PARSING_ERROR) return "Format stream tidak dikenali.";
  if (data.details === ErrorDetails.MANIFEST_LOAD_TIMEOUT) return "Sumber stream tidak merespons (timeout).";
  if (data.type === ErrorTypes.NETWORK_ERROR) return "Koneksi ke sumber stream gagal. Jaringan sumber sedang tidak stabil.";
  if (code) return `Gagal memuat stream (HTTP ${code}).`;
  return "Koneksi ke sumber stream gagal.";
}

export function describeNativeError(): string {
  return "Sumber stream tidak bisa diputar browser ini.";
}
