import { put, list, head } from "@vercel/blob";
import { HttpError } from "./solana";

export function hasStore() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function ensureToken() {
  if (!hasStore()) throw new HttpError(503, "Storage is not connected yet.");
}

export async function putFile(path: string, data: Buffer | string, contentType: string) {
  ensureToken();
  const r = await put(path, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return r.url;
}

export async function putJson(path: string, v: unknown) {
  if (!hasStore()) return null;
  try {
    return await putFile(path, JSON.stringify(v), "application/json");
  } catch {
    return null;
  }
}

export async function readJson<T>(path: string): Promise<T | null> {
  if (!hasStore()) return null;
  try {
    const h = await head(path);
    const r = await fetch(`${h.url}?v=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function listJson<T>(prefix: string, limit = 500): Promise<T[]> {
  if (!hasStore()) return [];
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    const jsons = await Promise.all(
      page.blobs.map(async (b) => {
        try {
          const r = await fetch(b.url, { cache: "no-store" });
          return (await r.json()) as T;
        } catch {
          return null;
        }
      }),
    );
    for (const j of jsons) if (j) out.push(j);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && out.length < limit);
  return out;
}

// In-memory cache per warm function instance.
const mem = new Map<string, { at: number; v: unknown }>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await fn();
  mem.set(key, { at: Date.now(), v });
  return v;
}
