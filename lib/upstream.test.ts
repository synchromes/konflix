import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asContentItem,
  asContentItemArray,
  asNumber,
  asStringArray,
  isRecord,
  readEnvelope,
  readStreamData,
} from "./upstream.ts";

test("isRecord hanya menerima objek biasa", () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord("{}"), false);
  assert.equal(isRecord(1), false);
});

test("readEnvelope menolak payload yang bukan envelope", () => {
  assert.equal(readEnvelope(null), null);
  assert.equal(readEnvelope([]), null);
  assert.equal(readEnvelope("teks"), null);
  assert.equal(readEnvelope({ success: true }), null, "tanpa `data` bukan envelope");
});

test("readEnvelope menormalkan pagination/filters/message", () => {
  const env = readEnvelope({
    success: true,
    data: [1],
    pagination: { currentPage: "2", totalPages: 5, hasNext: true, lain: "diabaikan" },
    filters: { type: "movie" },
    message: "ok",
  });
  assert.equal(env?.success, true);
  assert.deepEqual(env?.pagination, { currentPage: 2, totalPages: 5, hasNext: true });
  assert.deepEqual(env?.filters, { type: "movie" });
  assert.equal(env?.message, "ok");
});

test("readEnvelope menganggap success yang hilang sebagai false", () => {
  assert.equal(readEnvelope({ data: [] })?.success, false);
  assert.equal(readEnvelope({ data: [], success: "yes" })?.success, false);
});

test("asContentItem membuang field bertipe salah dan null", () => {
  const item = asContentItem({
    title: "The End of Oak Street",
    year: null,
    rating: "6.35",
    season: null,
    poster: 12345,
    overview: 42,
    genres: "Action, Drama",
    link: { endpoint: "movie/x", url: null, thumbnail: "https://x/t.jpg" },
    fieldTakDikenal: "harus hilang",
  });
  assert.deepEqual(item, {
    title: "The End of Oak Street",
    rating: "6.35",
    genres: ["Action", "Drama"],
    link: { endpoint: "movie/x", thumbnail: "https://x/t.jpg" },
  });
});

test("asContentItem mengembalikan null untuk entri sampah non-objek", () => {
  assert.equal(asContentItem(null), null);
  assert.equal(asContentItem("judul"), null);
  assert.equal(asContentItem(["a"]), null);
  // Objek kosong tetap objek (penyaringan judul/slug dilakukan pickList).
  assert.deepEqual(asContentItem({}), {});
});

test("asContentItemArray melewati entri yang tidak bisa dinormalkan", () => {
  const list = asContentItemArray([{ title: "A", slug: "a" }, null, "B", 42]);
  assert.equal(list.length, 1);
  assert.equal(list[0].slug, "a");
  assert.deepEqual(asContentItemArray(null), []);
});

test("asStringArray menerima array maupun CSV", () => {
  assert.deepEqual(asStringArray(["Action", "", " Drama "]), ["Action", "Drama"]);
  assert.deepEqual(asStringArray("Action, Drama"), ["Action", "Drama"]);
  assert.equal(asStringArray(""), undefined);
  assert.equal(asStringArray({}), undefined);
});

test("asNumber menolak NaN/Infinity dan menerima string angka", () => {
  assert.equal(asNumber("30"), 30);
  assert.equal(asNumber("abc"), undefined);
  assert.equal(asNumber(Number.NaN), undefined);
  assert.equal(asNumber(Number.POSITIVE_INFINITY), undefined);
  assert.equal(asNumber(null), undefined);
});

test("readStreamData menormalkan payload stream nyata", () => {
  const data = readStreamData({
    slug: "the-end-of-oak-street-2026",
    streamUrl: "https://e2e.majorplay.net/v/z4/x/config-1.json?t=abc",
    subtitles: [
      { lang: "en", label: "English", url: "https://e2e.majorplay.net/x/en.vtt" },
      { label: "" },
    ],
    durationSec: "5985",
    maxHeight: 720,
    sumberTambahan: "diabaikan",
  });
  assert.equal(data?.durationSec, 5985);
  // Entri tanpa field berguna dibuang, supaya hitungan subtitle tidak menggelembung.
  assert.equal(data?.subtitles?.length, 1);
  assert.deepEqual(data?.subtitles?.[0], { label: "English", lang: "en", url: "https://e2e.majorplay.net/x/en.vtt" });
  assert.equal(data?.maxHeight, 720);
  assert.equal(readStreamData({}) === null, true, "objek tanpa field berguna dianggap kosong");
  assert.equal(readStreamData("https://x/y.m3u8"), null);
});

test("readStreamData menerima sources string maupun objek", () => {
  const fromStrings = readStreamData({ sources: ["https://a/b.m3u8", "", 42] });
  assert.deepEqual(fromStrings?.sources, ["https://a/b.m3u8"]);

  const fromObjects = readStreamData({ sources: [{ file: "https://a/c.m3u8" }, { src: "https://a/d.m3u8", label: "720p" }] });
  assert.deepEqual(fromObjects?.sources, [
    { file: "https://a/c.m3u8" },
    { src: "https://a/d.m3u8", label: "720p" },
  ]);
});
