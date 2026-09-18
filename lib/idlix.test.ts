import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractStreamUrl,
  extractSubtitles,
  formatDuration,
  itemKind,
  itemPoster,
  itemSlug,
  itemTitle,
  pickList,
  pickLists,
  youtubeId,
} from "./idlix.ts";
import { asContentItem, readEnvelope, readStreamData } from "./upstream.ts";

// Fixture diambil apa adanya dari IDLIX-API lokal, dan sengaja dilewatkan
// readEnvelope/readStreamData supaya yang diuji adalah pipeline nyata
// (JSON mentah -> normalizer -> helper UI), bukan objek yang sudah rapi.

const junkItem = {
  title: "",
  originalTitle: "",
  year: null,
  type: "movie",
  rating: null,
  poster: null,
  link: { endpoint: "movie/undefined", url: "https://z2.idlixku.com/movie/undefined", thumbnail: null },
};

const movieItem = {
  title: "The End of Oak Street",
  year: 2026,
  type: "movie",
  rating: 6.35,
  poster: "https://image.tmdb.org/t/p/w300/fYXqpgPmHMphSF2W30GbTeJVIa5.jpg",
  slug: "the-end-of-oak-street-2026",
  link: {
    endpoint: "movie/the-end-of-oak-street-2026",
    url: "https://z2.idlixku.com/movie/the-end-of-oak-street-2026",
    thumbnail: "https://image.tmdb.org/t/p/w300/fYXqpgPmHMphSF2W30GbTeJVIa5.jpg",
  },
};

test("pickList membuang entri sampah tanpa judul/slug", () => {
  const env = readEnvelope({ success: true, data: [junkItem, movieItem] });
  const list = pickList(env);
  assert.equal(list.length, 1);
  assert.equal(itemTitle(list[0]), "The End of Oak Street");
});

test("pickList membaca data dari key bersarang", () => {
  const env = readEnvelope({ success: true, data: { results: [movieItem] } });
  assert.equal(pickList(env).length, 1);
});

test("pickList aman untuk respons kosong dan payload rusak", () => {
  assert.deepEqual(pickList(null), []);
  assert.deepEqual(pickList(readEnvelope({ success: true, data: [] })), []);
  assert.deepEqual(pickList(readEnvelope({ success: true, data: { results: [] } })), []);
  assert.deepEqual(pickList(readEnvelope({ success: true, data: "bukan daftar" })), []);
});

// Bentuk nyata /api/leaderboard: data.topMovies + data.topSeries (bukan data.results).
test("pickList menemukan daftar pada key non-standar seperti topMovies", () => {
  const env = readEnvelope({
    success: true,
    data: { month: "2026-09", updatedAt: "2026-09-18T08:47:21.684Z", topMovies: [movieItem] },
  });
  assert.equal(pickList(env).length, 1);
});

test("pickLists menggabungkan beberapa daftar dari satu respons", () => {
  const seriesItem = { ...movieItem, title: "A Bona Fide Killer", slug: "a-bona-fide-killer-2026" };
  const env = readEnvelope({
    success: true,
    data: { topMovies: [movieItem], topSeries: [seriesItem], topUsers: [{ username: "x" }] },
  });
  const merged = pickLists(env, ["topMovies", "topSeries"]);
  assert.deepEqual(
    merged.map((i) => itemTitle(i)),
    ["The End of Oak Street", "A Bona Fide Killer"]
  );
  assert.deepEqual(pickLists(null, ["topMovies"]), []);
});

test("itemSlug mengambil segmen terakhir dari URL penuh dan menolak 'undefined'", () => {
  assert.equal(itemSlug(asContentItem(movieItem)!), "the-end-of-oak-street-2026");
  assert.equal(
    itemSlug(asContentItem({ link: { url: "https://z2.idlixku.com/series/plastic-beauty-2026" } })!),
    "plastic-beauty-2026"
  );
  assert.equal(itemSlug(asContentItem({ slug: "movie/breaking-bad-2008" })!), "breaking-bad-2008");
  assert.equal(itemSlug(asContentItem({ link: { endpoint: "movie/undefined" } })!), "");
  assert.equal(itemSlug(asContentItem({})!), "");
});

test("itemPoster memakai poster, lalu image/backdrop, lalu thumbnail", () => {
  assert.equal(itemPoster(asContentItem(movieItem)!), movieItem.poster);
  assert.equal(itemPoster(asContentItem({ image: "https://x/y.jpg" })!), "https://x/y.jpg");
  assert.equal(itemPoster(asContentItem({ link: { thumbnail: "https://x/t.jpg" } })!), "https://x/t.jpg");
  assert.equal(itemPoster(asContentItem({})!), "");
});

test("itemKind menghormati konteks halaman karena label upstream sering salah", () => {
  // Series yang dilabeli movie oleh endpoint list.
  const mislabelled = asContentItem({ type: "movie", title: "Breaking Bad" })!;
  assert.equal(itemKind(mislabelled), "movie");
  assert.equal(itemKind(mislabelled, "series"), "series");
  assert.equal(itemKind(asContentItem({ type: "tv" })!), "series");
});

const streamPayload = {
  success: true,
  data: {
    slug: "the-end-of-oak-street-2026",
    streamUrl: "https://e2e.majorplay.net/v/z4/GcdNdtL0Q6nf/config-380234.json?t=abc",
    subtitles: [
      { lang: "en", label: "English", url: "https://e2e.majorplay.net/v/z4/GcdNdtL0Q6nf/i18n/en/c9d7ccc365fcb8a8.vtt" },
      { lang: "id", label: "Indonesian", url: "https://e2e.majorplay.net/v/z4/GcdNdtL0Q6nf/i18n/id/0c007c98286c88b4.vtt" },
    ],
    durationSec: 5985,
    maxHeight: 720,
  },
};

function streamData() {
  return readStreamData(readEnvelope(streamPayload)?.data);
}

test("extractStreamUrl mendukung streamUrl, sources string, dan sources objek", () => {
  assert.equal(extractStreamUrl(streamData()), streamPayload.data.streamUrl);
  assert.equal(extractStreamUrl(readStreamData({ sources: ["https://a/b.m3u8"] })), "https://a/b.m3u8");
  assert.equal(extractStreamUrl(readStreamData({ sources: [{ file: "https://a/c.m3u8" }] })), "https://a/c.m3u8");
  assert.equal(extractStreamUrl(null), "");
  assert.equal(extractStreamUrl(readStreamData({})), "");
});

test("extractSubtitles menormalkan subtitles/tracks dan membuang entri tanpa URL", () => {
  const subs = extractSubtitles(streamData());
  assert.equal(subs.length, 2);
  assert.deepEqual(subs[0], {
    label: "English",
    src: "https://e2e.majorplay.net/v/z4/GcdNdtL0Q6nf/i18n/en/c9d7ccc365fcb8a8.vtt",
    srclang: "en",
  });

  const fromTracks = extractSubtitles(
    readStreamData({
      tracks: [{ kind: "subtitles", file: "https://a/s.vtt", label: "ID" }, { label: "kosong" }],
    })
  );
  assert.equal(fromTracks.length, 1);
  assert.equal(fromTracks[0].label, "ID");
  assert.equal(fromTracks[0].srclang, "id", "fallback srclang ke 'id'");
});

test("formatDuration memformat detik ke menit/jam", () => {
  assert.equal(formatDuration(5985), "1j 40m");
  assert.equal(formatDuration(3720), "1j 2m");
  assert.equal(formatDuration(1800), "30 mnt");
  assert.equal(formatDuration(0), "");
  assert.equal(formatDuration(-5), "");
  assert.equal(formatDuration("bukan angka"), "");
});

test("youtubeId menangani bentuk URL trailer yang berbeda", () => {
  assert.equal(youtubeId("https://www.youtube.com/watch?v=pnoF99qg46A"), "pnoF99qg46A");
  assert.equal(youtubeId("https://youtu.be/pnoF99qg46A"), "pnoF99qg46A");
  assert.equal(youtubeId("https://www.youtube.com/embed/pnoF99qg46A"), "pnoF99qg46A");
  assert.equal(youtubeId("https://contoh.com/video"), "");
  assert.equal(youtubeId(null), "");
});
