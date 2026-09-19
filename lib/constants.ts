// Daftar filter yang ditautkan dari halaman listing. Dipusatkan di sini karena
// dipakai lebih dari satu halaman (dan halaman tidak seharusnya mengekspor konstanta).
// Sinkron dengan /api/genres upstream (IDLEX-API). Slug di luar daftar ini
// (mis. drama-korea, anime) mengembalikan daftar kosong dari upstream.
export const GENRES = [
  "action",
  "adventure",
  "animation",
  "comedy",
  "crime",
  "documentary",
  "drama",
  "family",
  "fantasy",
  "history",
  "horror",
  "kids",
  "music",
  "mystery",
  "reality",
  "romance",
  "science-fiction",
  "soap",
  "talk",
  "thriller",
  "tv-movie",
  "war",
  "western",
];

export const NETWORKS = ["netflix", "hbo", "disney-plus", "apple-tv-plus", "amazon-prime-video"];

export const CURRENT_YEAR = new Date().getUTCFullYear();
