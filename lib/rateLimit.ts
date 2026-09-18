// Rate limit untuk endpoint proxy.
//
// Default: in-memory per instance (cukup untuk dev/single instance).
// Kalau UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN diisi, hitungan dibagi
// lintas instance lewat REST Redis (INCR + PEXPIRE) tanpa menambah dependensi.
// Kalau backend bersama gagal, permintaan jatuh kembali ke limiter in-memory
// supaya proteksi tidak hilang begitu saja.

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_STATE = new Map<string, Bucket>();
const MAX_KEYS = 5000;

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const found = WINDOW_STATE.get(key);

  if (!found || found.resetAt <= now) {
    if (WINDOW_STATE.size >= MAX_KEYS) {
      // Buang entri kedaluwarsa supaya map tidak tumbuh tanpa batas.
      for (const [k, b] of WINDOW_STATE) if (b.resetAt <= now) WINDOW_STATE.delete(k);
      if (WINDOW_STATE.size >= MAX_KEYS) WINDOW_STATE.clear();
    }
    WINDOW_STATE.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (found.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((found.resetAt - now) / 1000)),
    };
  }

  found.count += 1;
  return { ok: true, remaining: limit - found.count, retryAfterSec: 0 };
}

interface UpstashConfig {
  url: string;
  token: string;
}

function upstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function upstashPipeline(config: UpstashConfig, commands: unknown[][]): Promise<unknown[] | null> {
  try {
    const res = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
}

// Jendela tetap berbasis indeks waktu: kunci berganti tiap windowMs sehingga
// satu permintaan pertama per jendela yang mengeset TTL.
async function distributedHit(
  config: UpstashConfig,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  const windowIndex = Math.floor(Date.now() / windowMs);
  const bucketKey = `ratelimit:${key}:${windowIndex}`;
  const resetAt = (windowIndex + 1) * windowMs;

  const result = await upstashPipeline(config, [["INCR", bucketKey]]);
  const count = Number((result?.[0] as { result?: unknown } | undefined)?.result);
  if (!Number.isFinite(count)) return null;

  if (count === 1) {
    // TTL dipasang sekali per jendela; kegagalannya tidak menggagalkan permintaan.
    await upstashPipeline(config, [["PEXPIRE", bucketKey, windowMs]]);
  }

  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec: count <= limit ? 0 : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const config = upstashConfig();
  if (config) {
    const distributed = await distributedHit(config, key, limit, windowMs);
    if (distributed) return distributed;
    console.error("[rateLimit] backend Redis tidak merespons, memakai limit in-memory.");
  }
  return memoryHit(key, limit, windowMs);
}

export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
