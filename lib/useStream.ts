"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientIdlix, extractStreamUrl, extractSubtitles, formatDuration, type Kind } from "./idlix";
import { readStreamData } from "./upstream";
import { pushHistory } from "./store";

export interface Subtitle {
  label: string;
  src: string;
  srclang: string;
}

export interface StreamResult {
  loading: boolean;
  url: string;
  subs: Subtitle[];
  meta: string;
  error: string;
  elapsed: number;
  retry: () => void;
}

interface Options {
  /** Path stream di IDLIX-API, mis. /movie/<slug>/stream */
  path: string;
  slug: string;
  /** Judul asli dari halaman detail (kalau tersedia), untuk riwayat tontonan. */
  title?: string;
  poster?: string;
  kind: Kind;
  href: string;
  season?: number;
  episode?: number;
}

// Ambil URL stream + subtitle, dengan pembatalan permintaan, detak waktu tunggu,
// dan pesan error yang membedakan API mati vs stream tidak tersedia.
export function useStream(options: Options): StreamResult {
  const { path, slug, title, poster, kind, href, season, episode } = options;

  const [state, setState] = useState({ loading: true, url: "", subs: [] as Subtitle[], meta: "", error: "" });
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    startedAt.current = Date.now();

    void (async () => {
      const json = await clientIdlix<unknown>(path, { signal: ac.signal });
      if (cancelled) return;

      const data = json ? readStreamData(json.data) : null;
      const url = extractStreamUrl(data);

      if (url) {
        const subs = extractSubtitles(data);
        const duration = formatDuration(data?.durationSec);
        const trackCount = [...(data?.subtitles ?? []), ...(data?.tracks ?? [])].length;
        setState({
          loading: false,
          url,
          subs,
          meta: [
            duration,
            subs.length > 0
              ? `${subs.length} dari ${trackCount || subs.length} subtitle: ${subs.map((s) => s.label).join(", ")}`
              : "tanpa subtitle",
            "kualitas otomatis (atur manual di bawah player)",
          ]
            .filter(Boolean)
            .join(" • "),
          error: "",
        });
        pushHistory({
          slug,
          title: title || slug.replace(/-/g, " "),
          poster,
          type: kind,
          href,
          season,
          episode,
        });
        return;
      }

      setState({
        loading: false,
        url: "",
        subs: [],
        meta: "",
        error:
          json === null
            ? "Tidak bisa menghubungi IDLIX-API. Pastikan layanan API jalan (docker ps harus menampilkan container idlix-api), lalu tekan Coba lagi."
            : `Stream ${kind === "series" ? "episode" : "judul"} ini tidak tersedia di sumber.${
                typeof json.message === "string" && json.message ? ` Pesan sumber: “${json.message}”.` : ""
              } Coba lagi atau pilih judul lain yang detailnya bisa dibuka.`,
      });
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [path, slug, title, poster, kind, href, season, episode, attempt]);

  useEffect(() => {
    if (!state.loading) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [state.loading, attempt]);

  const retry = useCallback(() => {
    startedAt.current = Date.now();
    setElapsed(0);
    setState({ loading: true, url: "", subs: [], meta: "", error: "" });
    setAttempt((a) => a + 1);
  }, []);

  return {
    loading: state.loading,
    url: state.url,
    subs: state.subs,
    meta: state.meta,
    error: state.error,
    elapsed,
    retry,
  };
}
