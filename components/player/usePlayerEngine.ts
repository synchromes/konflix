"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls, { ErrorTypes, type ErrorData, type LevelSwitchedData } from "hls.js";
import { HOOK_NETWORK_RETRIES, NATIVE_RETRIES, hookRetryDelayMs, resilientHlsConfig } from "./config";
import { describeHlsError, describeNativeError } from "./messages";

export type PlayerEngine = "" | "hls" | "native";
type HlsInstance = InstanceType<typeof Hls>;

// Deteksi kemampuan sekali (initializer useState, bukan di effect) agar tidak
// memicu set-state-in-effect dan tidak mismatch hidrasi (komponen "use client").
//
// MSE (hls.js) SELALU diutamakan bila tersedia — jalurnya sudah terverifikasi
// terhadap manifest multi-audio + segmen samaran sumber ini. Native hanya
// dipakai bila MSE tidak ada (Safari iOS lawas). Alasannya: sebagian Chrome
// desktop melaporkan canPlayType("mpegurl") truthy (ekstensi HLS dsb),
// padahal implementasi nativenya gagal memainkan stream ini.
function detectEngine(): PlayerEngine {
  if (typeof document === "undefined") return "";
  if (Hls.isSupported()) return "hls";
  const probe = document.createElement("video");
  if (probe.canPlayType("application/vnd.apple.mpegurl") !== "") return "native";
  return "";
}

interface EngineOptions {
  src: string;
  onFatal: (message: string) => void;
}

// Siklus hidup engine HLS/native + state machine pemulihan.
//
// Urutan pemulihan saat error fatal:
//  1. MEDIA_ERROR → recoverMediaError (1x) → rebuild penuh (1x) → fatal.
//  2. NETWORK_ERROR → startLoad dengan backoff (HOOK_NETWORK_RETRIES x,
//     di atas retry internal hls.js) → rebuild penuh → fatal.
//  3. Error lain (key system, mux) → langsung fatal.
// Rebuild penuh (destroy + Hls baru) penting karena koneksi yang keracunan
// (DNS/edge buruk) tidak pulih hanya dengan startLoad.
export function usePlayerEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  { src, onFatal }: EngineOptions
) {
  const [engine] = useState<PlayerEngine>(() => detectEngine());
  const [levels, setLevels] = useState<number[]>([]);
  const [autoHeight, setAutoHeight] = useState<number | null>(null);
  const [build, setBuild] = useState(0);

  const hlsRef = useRef<HlsInstance | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const networkRetries = useRef(0);
  const nativeRetries = useRef(0);
  const mediaRecovered = useRef(false);
  const rebuilt = useRef(false);
  const onFatalRef = useRef(onFatal);
  useEffect(() => {
    onFatalRef.current = onFatal;
  }, [onFatal]);

  // Bangun ulang engine penuh dengan src yang sama (sesi/CDN edge baru).
  const rebuild = useCallback(() => {
    networkRetries.current = 0;
    nativeRetries.current = 0;
    mediaRecovered.current = false;
    rebuilt.current = false;
    setLevels([]);
    setAutoHeight(null);
    setBuild((b) => b + 1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: HlsInstance | null = null;
    let disposed = false;
    const fail = (message: string) => {
      if (!disposed) onFatalRef.current(message);
    };

    if (engine === "native") {
      // Safari/iOS (termasuk Chrome di iPhone yang intinya WebKit) memutar HLS
      // secara native. Tidak seperti hls.js, tidak ada retry internal — jadi
      // percobaan ulang dilakukan di sini: error jaringan sesaat (Server
      // sumber flaky) dimuat ulang 3x dengan backoff sebelum fatal.
      video.src = src;
      const onErr = () => {
        if (disposed) return;
        // MEDIA_ERR_SRC_NOT_SUPPORTED (4) = format/codec ditolak permanen,
        // jangan buang waktu retry. Kode lain (NETWORK=2, DECODE=3) = sesaat.
        const code = video.error?.code ?? 0;
        if (code === 4) {
          onFatalRef.current(
            "Perangkat ini tidak mendukung format stream tersebut. Coba browser lain (Chrome/Firefox di Android atau desktop)."
          );
          return;
        }
        if (nativeRetries.current < NATIVE_RETRIES) {
          const idx = nativeRetries.current;
          nativeRetries.current += 1;
          const id = setTimeout(() => {
            if (disposed) return;
            try {
              video.load();
            } catch {
              // abaikan, error berikutnya ditangani handler ini lagi
            }
          }, hookRetryDelayMs(idx));
          timers.current.push(id);
          return;
        }
        onFatalRef.current(
          code === 2
            ? "Koneksi ke sumber stream gagal. Jaringan sumber sedang tidak stabil — coba Muat ulang."
            : describeNativeError()
        );
      };
      const onCanPlay = () => {
        nativeRetries.current = 0;
      };
      video.addEventListener("error", onErr);
      video.addEventListener("canplay", onCanPlay);
      return () => {
        disposed = true;
        video.removeEventListener("error", onErr);
        video.removeEventListener("canplay", onCanPlay);
        video.removeAttribute("src");
        video.load();
      };
    }

    if (engine !== "hls" || !Hls.isSupported()) {
      fail("Browser ini tidak mendukung pemutaran HLS.");
      return () => {
        disposed = true;
      };
    }

    hls = new Hls({ ...resilientHlsConfig() });
    hlsRef.current = hls;
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const lvls = hlsRef.current?.levels ?? [];
      const heights = [...new Set(lvls.map((l) => l.height).filter((h) => Number.isFinite(h)))].sort(
        (a, b) => (a as number) - (b as number)
      ) as number[];      if (!disposed) setLevels(heights);
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_event: string, data: LevelSwitchedData) => {
      const h = hlsRef.current?.levels[data.level]?.height;
      if (!disposed && Number.isFinite(h)) setAutoHeight(h as number);
    });
    hls.on(Hls.Events.MANIFEST_LOADED, () => {
      networkRetries.current = 0;
    });
    hls.on(Hls.Events.ERROR, (_event: string, data: ErrorData) => {
      if (disposed || !data.fatal) return;
      if (data.type === ErrorTypes.MEDIA_ERROR && !mediaRecovered.current) {
        mediaRecovered.current = true;
        try {
          hlsRef.current?.recoverMediaError();
        } catch {
          // lanjut ke rebuild di bawah bila gagal
        }
        return;
      }
      if (data.type === ErrorTypes.MEDIA_ERROR && !rebuilt.current) {
        rebuilt.current = true;
        rebuild();
        return;
      }
      if (data.type === ErrorTypes.NETWORK_ERROR) {
        if (networkRetries.current < HOOK_NETWORK_RETRIES) {
          const idx = networkRetries.current;
          networkRetries.current += 1;
          const id = setTimeout(() => {
            if (disposed) return;
            // Percobaan terakhir memakai sesi baru, bukan koneksi lama.
            if (idx === HOOK_NETWORK_RETRIES - 1 && !rebuilt.current) {
              rebuilt.current = true;
              rebuild();
            } else {
              hlsRef.current?.startLoad();
            }
          }, hookRetryDelayMs(idx));
          timers.current.push(id);
          return;
        }
        fail(describeHlsError(data));
        return;
      }
      fail(describeHlsError(data));
    });

    return () => {
      disposed = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      hls?.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, build, videoRef]);

  const pickLevel = useCallback((height: number, onPicked: (h: number) => void) => {
    const hls = hlsRef.current;
    if (hls) {
      if (height === -1) {
        hls.currentLevel = -1;
        const cur = hls.levels[hls.nextLevel]?.height;
        setAutoHeight(Number.isFinite(cur) ? (cur as number) : null);
      } else {
        const idx = hls.levels.findIndex((l) => l.height === height);
        if (idx >= 0) hls.currentLevel = idx;
      }
    }
    onPicked(height);
  }, []);

  return { engine, levels, autoHeight, pickLevel, rebuild };
}
