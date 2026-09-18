// Bentuk data upstream (IDLIX-API):
// seasons: [{ name, seasonNumber, episodeCount, episodes: [] }]
// `episodes` sering kosong dan hanya `episodeCount` yang terisi, jadi jumlah
// episode harus bisa diturunkan dari dua sumber tersebut.

interface RawEpisode {
  episode?: number;
  episodeNumber?: number;
  [k: string]: unknown;
}

interface RawSeason {
  season?: number | string;
  seasonNumber?: number | string;
  name?: string;
  episodes?: RawEpisode[] | number[];
  episodeCount?: number | string;
  [k: string]: unknown;
}

export interface SeasonInfo {
  num: number;
  episodes: number[];
  /** true = jumlah episode diperkirakan (sumber tidak mengirim daftar episode). */
  estimated: boolean;
}

const MAX_SEASONS = 60;
const MAX_EPISODES = 200;

function toPositiveInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function parseSeasons(detail: Record<string, unknown>): SeasonInfo[] {
  const out: SeasonInfo[] = [];
  const push = (num: number | null, episodes: number[], estimated: boolean) => {
    if (num === null || out.some((s) => s.num === num)) return;
    out.push({ num, episodes: episodes.length > 0 ? episodes : [1], estimated });
  };

  const explicit = toPositiveInt(detail.totalSeasons);
  if (Array.isArray(detail.seasons)) {
    for (const raw of (detail.seasons as RawSeason[]).slice(0, MAX_SEASONS)) {
      const num = toPositiveInt(raw.seasonNumber ?? raw.season);
      if (Array.isArray(raw.episodes) && raw.episodes.length > 0) {
        const episodes = (raw.episodes as Array<RawEpisode | number>)
          .map((e, i) => (typeof e === "number" ? toPositiveInt(e) : toPositiveInt(e.episodeNumber ?? e.episode) ?? i + 1))
          .filter((n): n is number => n !== null && n > 0)
          .slice(0, MAX_EPISODES);
        push(num, episodes, false);
        continue;
      }
      const count = toPositiveInt(raw.episodeCount);
      if (count) {
        push(num, Array.from({ length: Math.min(count, MAX_EPISODES) }, (_, i) => i + 1), false);
      } else {
        // Tidak ada daftar episode maupun jumlahnya: tampilkan 12 slot sebagai
        // perkiraan dan tandai `estimated` supaya UI bisa memberi catatan.
        push(num, Array.from({ length: 12 }, (_, i) => i + 1), true);
      }
    }
  } else if (explicit) {
    for (let i = 1; i <= Math.min(explicit, MAX_SEASONS); i++) push(i, [1], true);
  } else if (Array.isArray(detail.episodes)) {
    const episodes = (detail.episodes as Array<RawEpisode | number>)
      .map((e, i) => (typeof e === "number" ? toPositiveInt(e) : toPositiveInt(e.episodeNumber ?? e.episode) ?? i + 1))
      .filter((n): n is number => n !== null && n > 0)
      .slice(0, MAX_EPISODES);
    push(1, episodes, false);
  }

  if (out.length === 0) push(1, [1], true);
  return out.sort((a, b) => a.num - b.num);
}
