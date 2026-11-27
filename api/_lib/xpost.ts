import { createPublicKey, createHash, verify } from "crypto";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { callerCode } from "../../shared/calls";

// Checks a wallet signature on a plain-text message (Phantom's "Sign message"). No transaction, no key.
const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");
export function verifySignature(wallet: string, message: string, signatureB58: string) {
  try {
    const pub = new PublicKey(wallet).toBytes();
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(pub)]), format: "der", type: "spki" });
    const sig = Buffer.from(bs58.decode(signatureB58));
    if (sig.length !== 64) return false;
    return verify(null, Buffer.from(message, "utf8"), key, sig);
  } catch {
    return false;
  }
}

export function codeFor(wallet: string) {
  return callerCode(createHash("sha256").update(`called:${wallet}`).digest("hex"));
}

export type PostRead = { ok: true; author: string; text: string } | { ok: false; reason: "unreachable" | "missing" };

function decode(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

// Reads a public X post through X's own embed endpoint (no API key): who posted it and what it says.
export async function readPost(url: string): Promise<PostRead> {
  const canonical = url.trim().replace(/^https:\/\/(www\.|mobile\.)?x\.com\//i, "https://twitter.com/").split("?")[0];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(canonical)}`, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(t);
    if (r.status === 404 || r.status === 403) return { ok: false, reason: "missing" };
    if (!r.ok) return { ok: false, reason: "unreachable" };
    const j: any = await r.json();
    const author = String(j?.author_url || "")
      .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
    const para = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(String(j?.html || ""));
    const text = decode(para ? para[1] : String(j?.html || ""));
    if (!author) return { ok: false, reason: "unreachable" };
    return { ok: true, author, text };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
