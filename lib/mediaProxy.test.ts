import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPlaylistBody,
  isProxyableMediaUrl,
  rewritePlaylist,
  signedMediaPath,
  verifyMediaPath,
} from "./mediaProxy.ts";

const MEDIA = "https://e2e.majorplay.net/v/z4/GcdNdtL0Q6nf/config-380234.json?t=abc";

function parseSigned(path: string) {
  const url = new URL(path, "http://localhost:4001");
  return {
    src: url.searchParams.get("src") ?? "",
    exp: Number(url.searchParams.get("exp") ?? 0),
    sig: url.searchParams.get("sig") ?? "",
  };
}

test("URL bertanda tangan bisa diverifikasi", () => {
  const signed = parseSigned(signedMediaPath(MEDIA));
  assert.equal(signed.src, MEDIA);
  assert.deepEqual(verifyMediaPath(signed.src, signed.exp, signed.sig), { ok: true });
});

test("tanda tangan yang diubah atau kedaluwarsa ditolak", () => {
  const signed = parseSigned(signedMediaPath(MEDIA));
  assert.equal(verifyMediaPath(signed.src, signed.exp, "palsu").ok, false);
  assert.equal(verifyMediaPath(signed.src.replace("config", "configX"), signed.exp, signed.sig).ok, false);
  assert.equal(verifyMediaPath(signed.src, 1, signed.sig).ok, false);
});

test("host internal tidak boleh diproksikan", () => {
  assert.equal(isProxyableMediaUrl("https://e2e.majorplay.net/a.m3u8"), true);
  assert.equal(isProxyableMediaUrl("http://127.0.0.1:4000/api/x"), false);
  assert.equal(isProxyableMediaUrl("http://localhost:4000/api/x"), false);
  assert.equal(isProxyableMediaUrl("http://10.0.0.5/secret"), false);
  assert.equal(isProxyableMediaUrl("http://192.168.1.10/secret"), false);
  assert.equal(isProxyableMediaUrl("file:///etc/passwd"), false);
  assert.equal(isProxyableMediaUrl("bukan-url"), false);
});

test("playlist ditulis ulang: URI relatif dan absolut dialihkan ke proxy", () => {
  const body = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-KEY:METHOD=AES-128,URI=\"https://e2e.majorplay.net/key.bin\"",
    "segmen-1.ts",
    "https://e2e.majorplay.net/sub/segmen-2.ts",
  ].join("\n");

  const out = rewritePlaylist(body, "https://e2e.majorplay.net/v/z4/abc/index.m3u8");
  const lines = out.split("\n");
  assert.equal(lines[0], "#EXTM3U");
  assert.equal(lines[1], "#EXT-X-VERSION:3");

  const keyUri = /URI="([^"]+)"/.exec(lines[2])?.[1] ?? "";
  assert.ok(keyUri.startsWith("/api/media?"), "URI key dialihkan ke proxy");
  assert.equal(parseSigned(keyUri).src, "https://e2e.majorplay.net/key.bin");

  assert.ok(lines[3].startsWith("/api/media?"), "segmen relatif dialihkan");
  assert.equal(parseSigned(lines[3]).src, "https://e2e.majorplay.net/v/z4/abc/segmen-1.ts");
  assert.equal(parseSigned(lines[4]).src, "https://e2e.majorplay.net/sub/segmen-2.ts");
});

test("deteksi playlist dari body, content-type, atau ekstensi", () => {
  assert.equal(isPlaylistBody("#EXTM3U\n#EXT-X-VERSION:3", "application/octet-stream", MEDIA), true);
  assert.equal(isPlaylistBody("{}", "application/vnd.apple.mpegurl", MEDIA), true);
  assert.equal(isPlaylistBody("{}", "application/json", "https://x/a.m3u8?t=1"), true);
  assert.equal(isPlaylistBody('{"json":true}', "application/json", MEDIA), false);
});
