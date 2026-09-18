import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSeasons } from "./seasons.ts";

// Bentuk nyata dari /api/series/plastic-beauty-2026:
// seasons: [{ name, seasonNumber, episodeCount, episodes: [] }]
test("memakai episodeCount saat daftar episode kosong", () => {
  const seasons = parseSeasons({
    title: "Plastic Beauty",
    seasons: [{ name: "Season 1", seasonNumber: 1, episodeCount: 8, episodes: [] }],
  });
  assert.equal(seasons.length, 1);
  assert.equal(seasons[0].num, 1);
  assert.equal(seasons[0].episodes.length, 8);
  assert.equal(seasons[0].estimated, false);
});

test("memakai daftar episode asli saat tersedia", () => {
  const seasons = parseSeasons({
    seasons: [
      { seasonNumber: 1, episodes: [{ episodeNumber: 1 }, { episodeNumber: 2 }, { episodeNumber: 5 }] },
      { seasonNumber: 2, episodeCount: 3, episodes: [] },
    ],
  });
  assert.deepEqual(seasons[0].episodes, [1, 2, 5]);
  assert.deepEqual(seasons[1].episodes, [1, 2, 3]);
});

test("menandai perkiraan saat sumber tidak mengirim jumlah episode", () => {
  const seasons = parseSeasons({ seasons: [{ seasonNumber: 1, episodes: [] }] });
  assert.equal(seasons[0].estimated, true);
  assert.equal(seasons[0].episodes.length, 12);
});

test("mendukung totalSeasons dan daftar episodes datar", () => {
  const fromTotal = parseSeasons({ totalSeasons: 3 });
  assert.deepEqual(fromTotal.map((s) => s.num), [1, 2, 3]);

  const flat = parseSeasons({ episodes: [{ episodeNumber: 2 }, { episodeNumber: 4 }] });
  assert.deepEqual(flat, [{ num: 1, episodes: [2, 4], estimated: false }]);
});

test("selalu memberi minimal satu season/episode", () => {
  assert.deepEqual(parseSeasons({}), [{ num: 1, episodes: [1], estimated: true }]);
});

test("mengurutkan season dan mengabaikan duplikat", () => {
  const seasons = parseSeasons({
    seasons: [
      { seasonNumber: 2, episodeCount: 1, episodes: [] },
      { seasonNumber: 1, episodeCount: 1, episodes: [] },
      { seasonNumber: 2, episodeCount: 9, episodes: [] },
    ],
  });
  assert.deepEqual(seasons.map((s) => s.num), [1, 2]);
  assert.equal(seasons[1].episodes.length, 1);
});
