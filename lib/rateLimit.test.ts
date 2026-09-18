import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { clientKey, rateLimit } from "./rateLimit.ts";

const ENV_URL = "UPSTASH_REDIS_REST_URL";
const ENV_TOKEN = "UPSTASH_REDIS_REST_TOKEN";
const realFetch = globalThis.fetch;

function clearEnv() {
  delete process.env[ENV_URL];
  delete process.env[ENV_TOKEN];
}

afterEach(() => {
  globalThis.fetch = realFetch;
  clearEnv();
});

test("limiter in-memory memblokir setelah batas tercapai", async () => {
  clearEnv();
  const key = `test-mem-${Math.random()}`;
  const first = await rateLimit(key, 2, 60_000);
  const second = await rateLimit(key, 2, 60_000);
  const third = await rateLimit(key, 2, 60_000);

  assert.equal(first.ok, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.ok, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.ok, false);
  assert.ok(third.retryAfterSec >= 1 && third.retryAfterSec <= 60);
});

test("limiter memisahkan kunci dan jendela yang berbeda", async () => {
  clearEnv();
  const a = await rateLimit(`test-a-${Math.random()}`, 1, 60_000);
  const b = await rateLimit(`test-b-${Math.random()}`, 1, 60_000);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
});

test("memakai backend Redis saat env diisi, termasuk PEXPIRE sekali per jendela", async () => {
  process.env[ENV_URL] = "https://redis.contoh";
  process.env[ENV_TOKEN] = "token";

  const calls: Array<{ url: string; body: unknown }> = [];
  let incrCount = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as unknown[][];
    calls.push({ url: String(input), body });
    // Redis mengembalikan nilai baru untuk INCR dan 1 untuk PEXPIRE.
    const results = body.map((command) => (command[0] === "INCR" ? ++incrCount : 1));
    return new Response(JSON.stringify(results.map((result) => ({ result }))), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const key = "test-redis";
  const first = await rateLimit(key, 2, 60_000);
  const second = await rateLimit(key, 2, 60_000);
  const third = await rateLimit(key, 2, 60_000);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false, "hitungan dari Redis dipakai, bukan in-memory");
  assert.ok(calls[0].url.endsWith("/pipeline"));
  // Terakhir kali INCR memanggil endpoint pipeline, TTL hanya dipasang saat count == 1.
  const incrCalls = calls.filter((c) => (c.body as unknown[][]).flat().includes("INCR"));
  const expireCalls = calls.filter((c) => (c.body as unknown[][]).flat().includes("PEXPIRE"));
  assert.equal(incrCalls.length, 3);
  assert.equal(expireCalls.length, 1);
});

test("jatuh kembali ke in-memory kalau backend Redis gagal", async () => {
  process.env[ENV_URL] = "https://redis.contoh";
  process.env[ENV_TOKEN] = "token";
  globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;

  const key = `test-fallback-${Math.random()}`;
  const first = await rateLimit(key, 1, 60_000);
  const second = await rateLimit(key, 1, 60_000);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false, "fallback in-memory tetap membatasi");
});

test("clientKey memakai IP terdepan dari x-forwarded-for", () => {
  const req = new Request("http://localhost/api", {
    headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
  });
  assert.equal(clientKey(req), "203.0.113.7");

  const bare = new Request("http://localhost/api", { headers: { "x-real-ip": "198.51.100.9" } });
  assert.equal(clientKey(bare), "198.51.100.9");

  assert.equal(clientKey(new Request("http://localhost/api")), "unknown");
});
