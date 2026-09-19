"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadProgress, saveProgress, useStoredVolume } from "@/lib/store";
import { usePlayerEngine } from "./usePlayerEngine";
import type { Subtitle } from "./types";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function Player(props: {
  src: string;
  subtitles?: Subtitle[];
  slug: string;
  season?: number;
  episode?: number;
  poster?: string;
  /** Dipanggil saat engine menyerah (perlu URL bertanda tangan yang baru). */
  onStreamExhausted: () => void;
  /** Dipanggil sekali saat video selesai diputar. */
  onEnded?: () => void;
}) {
  const { src, subtitles = [], slug, season, episode, poster, onStreamExhausted, onEnded } = props;
  if (!src) return null;
  return (
    <PlayerSurface
      key={src}
      src={src}
      subtitles={subtitles}
      slug={slug}
      season={season}
      episode={episode}
      poster={poster}
      onStreamExhausted={onStreamExhausted}
      onEnded={onEnded}
    />
  );
}

function PlayerSurface({
  src,
  subtitles,
  slug,
  season,
  episode,
  poster,
  onStreamExhausted,
  onEnded,
}: {
  src: string;
  subtitles: Subtitle[];
  slug: string;
  season?: number;
  episode?: number;
  poster?: string;
  onStreamExhausted: () => void;
  onEnded?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seeking = useRef(false);
  const lastSaved = useRef(0);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useStoredVolume();
  const [mutedOverride, setMutedOverride] = useState(false);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState("");
  const [showUI, setShowUI] = useState(true);
  const [menu, setMenu] = useState<null | "quality" | "subs" | "speed">(null);
  const [level, setLevel] = useState(-1);
  const [subIdx, setSubIdx] = useState(subtitles.length > 0 ? 0 : -1);

  const isMuted = mutedOverride || volume === 0;

  const { engine, levels, autoHeight, pickLevel, rebuild } = usePlayerEngine(videoRef, {
    src,
    onFatal: (message) => setError(message),
  });

  // ---------- event elemen video (resume, progres, status) ----------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;

    video.volume = volume;
    video.muted = isMuted;

    const startAt = loadProgress(slug, season, episode);
    const onMeta = () => {
      if (disposed) return;
      setDur(video.duration || 0);
      if (startAt > 5 && startAt < (video.duration || Infinity) - 10) {
        try {
          video.currentTime = startAt;
          lastSaved.current = startAt;
        } catch {
          // abaikan
        }
      }
    };
    const onTime = () => {
      const t = video.currentTime;
      if (!seeking.current) {
        // Perbarui UI hanya saat detik berubah, simpan progres tiap 5 detik.
        setTime((prev) => (Math.floor(prev) === Math.floor(t) ? prev : t));
      }
      if (Math.abs(t - lastSaved.current) >= 5) {
        lastSaved.current = t;
        saveProgress(slug, t, season, episode);
      }
    };
    const onProg = () => {
      try {
        if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
      } catch {
        // abaikan
      }
    };
    const onPlay = () => {
      setPlaying(true);
      setStarted(true);
      setEnded(false);
    };
    const onPause = () => {
      setPlaying(false);
      if (video.currentTime > 0) saveProgress(slug, video.currentTime, season, episode);
    };
    const onWait = () => setWaiting(true);
    const onCanPlay = () => setWaiting(false);
    const onEnd = () => {
      setEnded(true);
      setPlaying(false);
      saveProgress(slug, 0, season, episode);
      onEndedRef.current?.();
    };

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onProg);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWait);
    video.addEventListener("playing", onCanPlay);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnd);
    return () => {
      disposed = true;
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onProg);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWait);
      video.removeEventListener("playing", onCanPlay);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnd);
      if (video.currentTime > 0) saveProgress(slug, video.currentTime, season, episode);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, slug, season, episode]);

  // ---------- autoplay senyap saat mount ----------
  // Kebijakan browser: play() bersuara butuh gestur, play() bisu selalu boleh.
  // Coba putar bisu sekali saat engine siap — kalau lolos, video langsung jalan
  // (pengguna tinggal ketuk 🔊). Kalau ditolak, diam saja: tombol "Mulai" yang
  // tampil (gestur di sana selalu lolos). Mencegah pesan autoplay palsu.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current || engine === "") return;
    const video = videoRef.current;
    if (!video) return;
    autoTried.current = true;
    video.muted = true;
    void video
      .play()
      .then(() => {
        setMutedOverride(true);
      })
      .catch(() => {
        video.muted = isMuted;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, src]);

  // ---------- terapkan volume ke elemen video ----------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // ---------- subtitle tracks ----------
  const trackKey = subtitles.map((s) => s.src).join("|");
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    Array.from(video.textTracks).forEach((t, i) => {
      t.mode = i === subIdx ? "showing" : "disabled";
    });
  }, [subIdx, trackKey]);

  // ---------- auto-hide UI ----------
  const hideSoon = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) setShowUI(false);
    }, 2800);
  }, []);

  useEffect(() => {
    hideSoon();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [hideSoon]);

  const poke = useCallback(() => {
    setShowUI(true);
    hideSoon();
  }, [hideSoon]);

  // ---------- fullscreen ----------
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) {
        try {
          v.currentTime = 0;
        } catch {
          // abaikan
        }
      }
      // Hanya NotAllowedError yang berarti autoplay diblokir. Jenis lain
      // (mis. AbortError karena load baru, NotSupportedError karena sumber
      // gagal dimuat) punya arti berbeda — jangan tuduh autoplay.
      void v.play().catch((e: unknown) => {
        const name = (e as { name?: string } | null)?.name;
        if (name === "NotAllowedError") {
          setError("Autoplay diblokir browser — tekan tombol play.");
        } else if (name === "AbortError") {
          // play() diinterupsi load baru (mis. rebuild engine) — abaikan.
        } else {
          setError("Video tidak bisa diputar. Coba muat ulang pemain di bawah.");
        }
      });
    } else {
      v.pause();
    }
    poke();
  }, [poke]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setMutedOverride(false);
      if (volume === 0) setVolume(0.5);
    } else {
      setMutedOverride(true);
    }
    poke();
  }, [isMuted, volume, setVolume, poke]);

  const changeVolume = useCallback(
    (val: number) => {
      setVolume(val);
      setMutedOverride(false);
      poke();
    },
    [setVolume, poke]
  );

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      const req =
        el.requestFullscreen?.bind(el) ??
        (el as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.bind(el);
      req?.();
    }
    poke();
  }, [poke]);

  const togglePip = useCallback(async () => {
    const v = videoRef.current as unknown as {
      requestPictureInPicture?: () => Promise<void>;
      disablePictureInPicture?: boolean;
    } | null;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (v && !v.disablePictureInPicture) {
        await v.requestPictureInPicture?.();
      }
    } catch {
      // abaikan (tidak didukung / ditolak)
    }
    poke();
  }, [poke]);

  const changeRate = useCallback(
    (r: number) => {
      const v = videoRef.current;
      if (v) v.playbackRate = r;
      setRate(r);
      setMenu(null);
      poke();
    },
    [poke]
  );

  const onPickLevel = useCallback(
    (h: number) => {
      pickLevel(h, setLevel);
      setMenu(null);
      poke();
    },
    [pickLevel, poke]
  );

  // Muat ulang engine dengan URL yang sama (sesi/CDN edge baru), tanpa
  // menunggu URL bertanda tangan baru (±20 dtk).
  const reloadEngine = useCallback(() => {
    setError("");
    setWaiting(true);
    rebuild();
    poke();
  }, [rebuild, poke]);

  // ---------- seek bar (pointer) ----------
  const seekToClientX = useCallback((clientX: number) => {
    const bar = barRef.current;
    const v = videoRef.current;
    if (!bar || !v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const t = ratio * v.duration;
    setTime(t);
    try {
      v.currentTime = t;
    } catch {
      // abaikan
    }
  }, []);

  // ---------- keyboard ----------
  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          poke();
          break;
        case "ArrowLeft":
          v.currentTime = Math.max(0, v.currentTime - 10);
          poke();
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume(Math.min(1, (isMuted ? 0 : volume) + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(Math.max(0, (isMuted ? 0 : volume) - 0.1));
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        default:
          break;
      }
    },
    [togglePlay, toggleFullscreen, toggleMute, changeVolume, poke, volume, isMuted]
  );

  const pct = dur > 0 ? (time / dur) * 100 : 0;
  const bufPct = dur > 0 ? (buffered / dur) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={poke}
      onTouchStart={poke}
      onClick={() => {
        setMenu(null);
        poke();
      }}
      className={`group relative aspect-video w-full select-none overflow-hidden rounded-xl bg-black ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${showUI ? "" : "cursor-none"}`}
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        preload="metadata"
        poster={poster}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
      >
        {subtitles.map((s, i) => (
          <track key={`${s.src}-${i}`} kind="subtitles" src={s.src} srcLang={s.srclang} label={s.label} />
        ))}
      </video>

      {/* overlay tengah: spinner / play / replay */}
      {waiting && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-red-600" />
        </div>
      ) : null}
      {!playing && !waiting && !error && started && !ended ? (
        <button
          aria-label="Putar"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-black/60 text-2xl text-white ring-1 ring-white/30 hover:bg-red-600"
        >
          ▶
        </button>
      ) : null}
      {!started && !error ? (
        <button
          aria-label="Mulai"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-3xl text-white shadow-xl hover:bg-red-700"
        >
          ▶
        </button>
      ) : null}
      {ended && !error ? (
        <button
          aria-label="Putar ulang"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-black/60 text-2xl text-white ring-1 ring-white/30 hover:bg-red-600"
        >
          ↻
        </button>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-4 text-center">
          <p className="max-w-md text-sm text-red-200">{error}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                reloadEngine();
              }}
              className="rounded-md bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              Muat ulang pemain
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStreamExhausted();
              }}
              className="rounded-md border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Ambil URL stream baru
            </button>
          </div>
          <p className="max-w-md text-[11px] text-zinc-400">
            “Muat ulang” memakai URL yang sama (cepat). “URL baru” meminta tautan baru ke sumber (±20 detik).
          </p>
        </div>
      ) : null}

      {/* petunjuk suara saat autoplay bisu berhasil */}
      {playing && isMuted && started && !error ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 hover:bg-black/90"
        >
          🔇 Tanpa suara — ketuk untuk bersuara
        </button>
      ) : null}

      {/* kontrol bawah */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-8 transition-opacity sm:px-4 ${showUI && !error ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* progress */}
        <div
          ref={barRef}
          role="slider"
          aria-label="Posisi video"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(time)}
          tabIndex={0}
          onKeyDown={(e) => {
            const v = videoRef.current;
            if (!v || !Number.isFinite(v.duration)) return;
            if (e.key === "ArrowRight") v.currentTime = Math.min(v.duration, v.currentTime + 10);
            if (e.key === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 10);
          }}
          onPointerDown={(e) => {
            seeking.current = true;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            seekToClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (seeking.current) seekToClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            if (seeking.current) {
              seeking.current = false;
              seekToClientX(e.clientX);
            }
          }}
          className="group/bar relative h-5 cursor-pointer touch-none"
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-white/20 transition-all group-hover/bar:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded bg-white/30" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded bg-red-600" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 opacity-0 shadow group-hover/bar:opacity-100"
            style={{ left: `${pct}%` }}
          />
        </div>

        {/* tombol-tombol */}
        <div className="flex items-center gap-1 text-white sm:gap-2">
          <button aria-label={playing ? "Jeda" : "Putar"} onClick={togglePlay} className="rounded p-1.5 text-lg hover:bg-white/10">
            {playing ? "⏸" : "▶"}
          </button>
          <button
            aria-label={isMuted ? "Nyalakan suara" : "Bisukan"}
            onClick={toggleMute}
            className="rounded p-1.5 text-lg hover:bg-white/10"
          >
            {isMuted ? "🔇" : volume < 0.5 ? "🔈" : "🔊"}
          </button>
          <input
            aria-label="Volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="hidden h-1 w-20 accent-red-600 sm:block"
          />
          <span className="ml-1 text-xs text-zinc-300">
            {fmt(time)} / {fmt(dur)}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {subtitles.length > 0 ? (
              <div className="relative">
                <button
                  aria-label="Subtitle"
                  onClick={() => setMenu(menu === "subs" ? null : "subs")}
                  className={`rounded px-2 py-1.5 text-xs font-bold hover:bg-white/10 ${subIdx >= 0 ? "text-white underline decoration-red-600 decoration-2 underline-offset-4" : "text-zinc-300"}`}
                >
                  CC
                </button>
                {menu === "subs" ? (
                  <div className="absolute bottom-10 right-0 w-44 overflow-hidden rounded-lg bg-zinc-900 text-xs ring-1 ring-white/15">
                    <button
                      onClick={() => {
                        setSubIdx(-1);
                        setMenu(null);
                      }}
                      className={`block w-full px-3 py-2 text-left hover:bg-white/10 ${subIdx === -1 ? "text-red-400" : "text-zinc-200"}`}
                    >
                      Nonaktif
                    </button>
                    {subtitles.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSubIdx(i);
                          setMenu(null);
                        }}
                        className={`block w-full px-3 py-2 text-left hover:bg-white/10 ${subIdx === i ? "text-red-400" : "text-zinc-200"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {engine === "hls" ? (
              <div className="relative">
                <button
                  aria-label="Kualitas"
                  onClick={() => setMenu(menu === "quality" ? null : "quality")}
                  className="rounded px-2 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10"
                >
                  {level === -1 ? `Auto${autoHeight ? ` ${autoHeight}p` : ""}` : `${level}p`}
                </button>
                {menu === "quality" ? (
                  <div className="absolute bottom-10 right-0 w-36 overflow-hidden rounded-lg bg-zinc-900 text-xs ring-1 ring-white/15">
                    <button
                      onClick={() => onPickLevel(-1)}
                      className={`block w-full px-3 py-2 text-left hover:bg-white/10 ${level === -1 ? "text-red-400" : "text-zinc-200"}`}
                    >
                      Otomatis{autoHeight ? ` (${autoHeight}p)` : ""}
                    </button>
                    {levels.map((h) => (
                      <button
                        key={h}
                        onClick={() => onPickLevel(h)}
                        className={`block w-full px-3 py-2 text-left hover:bg-white/10 ${level === h ? "text-red-400" : "text-zinc-200"}`}
                      >
                        {h}p{levels.length === 1 ? " (satu-satunya)" : ""}
                      </button>
                    ))}
                    {levels.length === 0 ? <p className="px-3 py-2 text-zinc-400">Mendeteksi…</p> : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <span
                className="hidden rounded px-2 py-1.5 text-[11px] text-zinc-400 sm:block"
                title="Kualitas diatur browser/perangkat (mode native)"
              >
                Auto
              </span>
            )}

            <div className="relative">
              <button
                aria-label="Kecepatan"
                onClick={() => setMenu(menu === "speed" ? null : "speed")}
                className="rounded px-2 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10"
              >
                {rate}×
              </button>
              {menu === "speed" ? (
                <div className="absolute bottom-10 right-0 w-28 overflow-hidden rounded-lg bg-zinc-900 text-xs ring-1 ring-white/15">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeRate(s)}
                      className={`block w-full px-3 py-2 text-left hover:bg-white/10 ${rate === s ? "text-red-400" : "text-zinc-200"}`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button aria-label="Mini player" onClick={togglePip} className="hidden rounded p-1.5 text-base hover:bg-white/10 sm:block">
              ▦
            </button>
            <button aria-label="Layar penuh" onClick={toggleFullscreen} className="rounded p-1.5 text-lg hover:bg-white/10">
              {isFullscreen ? "🗗" : "⛶"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
