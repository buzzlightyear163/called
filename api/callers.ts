import { waitUntil } from "@vercel/functions";
import { CALLS, cleanHandle, postIdFrom, registerMessage, weekKey } from "../shared/calls";
import { HttpError, body, handle, pk } from "./_lib/solana";
import { putJson, readJson } from "./_lib/store";
import { allCalls, boardFor, getCaller, withLive, type Caller } from "./_lib/calls";
import { codeFor, readPost, verifySignature } from "./_lib/xpost";

// GET ?wallet=: a caller, their code, their calls and this week's line.
// POST: register a caller. The wallet signs a message (never a transaction), and an X post carries the caller's code.

async function checkProof(c: Caller): Promise<Caller> {
  const read = await readPost(c.proofPost);
  if (!read.ok) return { ...c, checkedAt: Date.now() };
  const ok = read.author === c.handle && read.text.toUpperCase().includes(codeFor(c.wallet));
  return { ...c, xVerified: ok, checkedAt: Date.now() };
}

export default handle(async (req, res) => {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    const wallet = pk(req.query.wallet, "wallet").toBase58();
    let caller = await getCaller(wallet);
    if (caller && !caller.xVerified && Date.now() - (caller.checkedAt ?? 0) > 2 * 60_000) {
      const p = checkProof(caller).then(async (c) => {
        await putJson(`callers/${wallet}.json`, c);
        return c;
      });
      waitUntil(p.catch(() => null));
      caller = (await Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), 5000))]).catch(() => null)) ?? caller;
    }
    const calls = await withLive((await allCalls()).filter((c) => c.wallet === wallet));
    const week = weekKey(Date.now());
    const [row] = boardFor(calls.filter((c) => c.week === week).map((c) => ({ ...c, xVerified: !!caller?.xVerified })), null);
    return { caller, code: codeFor(wallet), calls, row: row ?? null, rules: CALLS };
  }

  const b = body(req);
  const wallet = pk(b.wallet, "wallet").toBase58();
  const h = cleanHandle(b.handle);
  if (!/^[a-z0-9_]{1,15}$/.test(h)) throw new HttpError(400, "That isn't a valid X handle.");
  const issued = String(b.issued || "");
  const t = Date.parse(issued);
  if (!t || Math.abs(Date.now() - t) > 10 * 60_000) throw new HttpError(400, "The signature is too old. Sign again.");
  if (!verifySignature(wallet, registerMessage(wallet, h, issued), String(b.signature || ""))) throw new HttpError(401, "The signature doesn't match this wallet.");

  const post = String(b.post || "").trim();
  if (!postIdFrom(post)) throw new HttpError(400, "Paste the link to your X post, like https://x.com/you/status/123…");

  const [existing, taken] = await Promise.all([getCaller(wallet), readJson<{ wallet: string }>(`handles/${h}.json`)]);
  if (taken && taken.wallet !== wallet) throw new HttpError(409, `@${h} is already registered to another wallet.`);
  if (existing && existing.handle !== h) throw new HttpError(409, `This wallet is already registered as @${existing.handle}.`);

  const code = codeFor(wallet);
  const read = await readPost(post);
  if (read.ok && read.author !== h) throw new HttpError(400, `That post is from @${read.author}, not @${h}.`);
  if (read.ok && !read.text.toUpperCase().includes(code)) throw new HttpError(400, `The post has to include your code ${code}.`);
  if (!read.ok && read.reason === "missing") throw new HttpError(400, "That post can't be found. Is the account public?");

  const caller: Caller = {
    wallet,
    handle: h,
    xVerified: read.ok,
    proofPost: post,
    registeredAt: existing?.registeredAt ?? Date.now(),
    checkedAt: Date.now(),
  };
  await putJson(`callers/${wallet}.json`, caller);
  await putJson(`handles/${h}.json`, { wallet });
  return { caller, code, pending: !read.ok };
});
