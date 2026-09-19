import type { ContentItem } from "./idlix";

// Data cadangan saat IDLIX-API belum jalan (Docker belum diinstal).
// Memakai picsum.photos agar UI langsung bisa dilihat.
const seeds: Array<{ slug: string; title: string; year: number; type: "movie" | "series" }> = [
  { slug: "contoh-film-aksi-2024", title: "Contoh Film Aksi", year: 2024, type: "movie" },
  { slug: "contoh-drama-korea-2024", title: "Contoh Drama Korea", year: 2024, type: "series" },
  { slug: "contoh-film-horor-2023", title: "Contoh Film Horor", year: 2023, type: "movie" },
  { slug: "contoh-anime-2024", title: "Contoh Anime", year: 2024, type: "series" },
  { slug: "contoh-film-komedi-2023", title: "Contoh Film Komedi", year: 2023, type: "movie" },
  { slug: "contoh-thriller-2024", title: "Contoh Thriller", year: 2024, type: "movie" },
  { slug: "contoh-scifi-2025", title: "Contoh Sci-Fi", year: 2025, type: "movie" },
  { slug: "contoh-series-misteri-2024", title: "Contoh Series Misteri", year: 2024, type: "series" },
  { slug: "contoh-film-petualangan-2024", title: "Contoh Petualangan", year: 2024, type: "movie" },
  { slug: "contoh-series-keluarga-2023", title: "Contoh Series Keluarga", year: 2023, type: "series" },
];

export const MOCK_ITEMS: ContentItem[] = seeds.map((s) => ({
  slug: s.slug,
  title: s.title,
  year: s.year,
  type: s.type,
  poster: `https://picsum.photos/seed/${s.slug}/500/750`,
  backdrop: `https://picsum.photos/seed/${s.slug}-bg/1280/720`,
  overview: "Sinopsis lengkap segera hadir untuk judul ini.",
  genres: s.type === "series" ? ["Drama", "Series"] : ["Action", "Drama"],
  rating: 7.5,
}));
