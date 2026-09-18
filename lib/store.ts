"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ContentItem } from "./idlix";
import { itemSlug } from "./idlix";

// Semua data pengguna disimpan di localStorage perangkat. Aksesnya lewat
// useSyncExternalStore supaya: (1) aman saat SSR/hidrasi, (2) otomatis ikut
// berubah di komponen lain, (3) sinkron antar-tab lewat event `storage`.

const WATCHLIST_KEY = "baleflix:watchlist";
const HISTORY_KEY = "baleflix:history";
const VOLUME_KEY = "baleflix:volume";

export interface HistoryEntry {
  slug: string;
  title: string;
  poster?: string;
  type?: string;
  href: string;
  season?: number;
  episode?: number;
  at: number;
}

function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // abaikan (mode privat / kuota penuh)
  }
}

interface Store<T> {
  read: () => T;
  subscribe: (listener: () => void) => () => void;
  write: (value: T) => void;
  // Buang cache supaya pembacaan berikutnya mengambil ulang dari localStorage.
  refresh: () => void;
}

// getSnapshot wajib mengembalikan referensi yang stabil antar pemanggilan,
// jadi hasil parse di-cache berdasarkan string mentahnya.
function createStore<T>(key: string, decode: (raw: string | null) => T, fallback: T): Store<T> {
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((l) => l());

  const read = (): T => {
    const raw = safeGet(key);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = decode(raw);
    }
    return cachedValue;
  };

  return {
    read,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    write(value) {
      safeSet(key, JSON.stringify(value));
      cachedRaw = undefined;
      notify();
    },
    refresh() {
      cachedRaw = undefined;
      notify();
    },
  };
}

// getServerSnapshot dipanggil berulang saat hidrasi, jadi referensinya harus stabil
// (kalau tidak, React melempar "getServerSnapshot should be cached").
const EMPTY_ARRAY: never[] = [];

function decodeArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function matchHistory(entry: HistoryEntry, slug: string, season?: number, episode?: number) {
  return entry.slug === slug && entry.season === season && entry.episode === episode;
}

const watchlistStore = createStore<ContentItem[]>(WATCHLIST_KEY, (raw) => decodeArray<ContentItem>(raw), []);
const historyStore = createStore<HistoryEntry[]>(HISTORY_KEY, (raw) => decodeArray<HistoryEntry>(raw), []);
const volumeStore = createStore<number>(
  VOLUME_KEY,
  (raw) => {
    const n = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
  },
  1
);

// Sinkron antar-tab: perubahan di tab lain memicu event `storage` di tab ini,
// lalu snapshot dibaca ulang oleh useSyncExternalStore.
if (typeof window !== "undefined") {
  const storesByKey: Array<[string, Store<unknown>]> = [
    [WATCHLIST_KEY, watchlistStore as Store<unknown>],
    [HISTORY_KEY, historyStore as Store<unknown>],
    [VOLUME_KEY, volumeStore as Store<unknown>],
  ];
  window.addEventListener("storage", (e) => {
    if (e.storageArea && e.storageArea !== window.localStorage) return;
    for (const [key, s] of storesByKey) {
      if (e.key === null || e.key === key) s.refresh();
    }
  });
}

// ---- Daftar Saya ----

export function getWatchlist(): ContentItem[] {
  return watchlistStore.read();
}

export function isInWatchlist(slug: string): boolean {
  return watchlistStore.read().some((i) => itemSlug(i) === slug);
}

export function toggleWatchlist(item: ContentItem): boolean {
  const slug = itemSlug(item);
  const list = watchlistStore.read();
  const exists = list.some((i) => itemSlug(i) === slug);
  const next = exists
    ? list.filter((i) => itemSlug(i) !== slug)
    : [{ ...item, slug }, ...list].slice(0, 100);
  watchlistStore.write(next);
  return !exists;
}

export function useWatchlist(): ContentItem[] {
  return useSyncExternalStore(watchlistStore.subscribe, watchlistStore.read, () => EMPTY_ARRAY);
}

export function useIsInWatchlist(slug: string): boolean {
  const list = useWatchlist();
  return list.some((i) => itemSlug(i) === slug);
}

// ---- Riwayat ----

export function getHistory(): HistoryEntry[] {
  return historyStore.read();
}

export function pushHistory(entry: Omit<HistoryEntry, "at">) {
  const list = historyStore.read().filter(
    (h) => !matchHistory(h, entry.slug, entry.season, entry.episode)
  );
  historyStore.write([{ ...entry, at: Date.now() }, ...list].slice(0, 50));
}

export function clearHistory() {
  historyStore.write([]);
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(historyStore.subscribe, historyStore.read, () => EMPTY_ARRAY);
}

// ---- Progres tontonan ----

export function historyKey(slug: string, season?: number, episode?: number) {
  return `baleflix:progress:${slug}:${season ?? 0}:${episode ?? 0}`;
}

export function saveProgress(slug: string, seconds: number, season?: number, episode?: number) {
  safeSet(historyKey(slug, season, episode), String(Math.max(0, Math.floor(seconds))));
}

export function loadProgress(slug: string, season?: number, episode?: number): number {
  const raw = safeGet(historyKey(slug, season, episode));
  const n = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ---- Volume player (persisten per perangkat) ----

export function useStoredVolume(): [number, (value: number) => void] {
  const value = useSyncExternalStore(volumeStore.subscribe, volumeStore.read, () => 1);
  const set = useCallback((next: number) => {
    volumeStore.write(Math.min(1, Math.max(0, next)));
  }, []);
  return [value, set];
}


