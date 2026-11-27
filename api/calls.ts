import { waitUntil } from "@vercel/functions";
import { CALLS, WINDOW_MS, callMessage, postIdFrom, postTime, weekKey } from "../shared/calls";
import { HttpError, body, handle, ownPlatformId, pk, solUsd } from "./_lib/solana";
import { readJson } from "./_lib/store";
import { loadCoins } from "./_lib/coins";
import { allCalls, callId, getCaller, housekeeping, saveCall, sellCheck, settle, snapOf, withLive, type Call } from "./_lib/calls";
import { readPost, verifySignature } from "./_lib/xpost";

// GET ?id=        one receipt
// GET ?settle=1   settle what is due (the daily cron, and anyone can poke it)
// GET             the latest calls
// POST            register a call: the caller's wallet signs, the X post is checked, the price is stamped.

export default handle(async (req, res) => {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    if (req.query.settle || /vercel-cron/i.test(String(req.headers["user-agent"] || ""))) return housekeeping(50_000, 40);
    if (req.query.id) {
      const id = String(req.query.id).replace(/[^a-f0-9]/g, "").slice(0, 16);
      let c = await readJson<Call>(`calls/${id}.json`);
      if (!c) throw new HttpError(404, "No call with that receipt number.");
      if (!c.result && Date.now() >= c.due) c = await settle(c);
      const [withL] = await withLive([c]);
      return { call: withL };
    }
    waitUntil(housekeeping(25_000, 2).catch(() => null));
    const calls = await withLive((await allCalls()).slice(0, 60));
    return { at: Date.now(), calls };
  }

  const b = body(req);
  const wallet = pk(b.wallet, "wallet").toBase58();
  const mint = pk(b.mint, "coin").toBase58();
  const post = String(b.post || "").trim();
  const issued = String(b.issued || "");
  const t = Date.parse(issued);
  if (!t || Math.abs(Date.now() - t) > 10 * 60_000) throw new HttpError(400, "The signature is too old. Sign again.");
  if (!verifySignature(wallet, callMessage(wallet, mint, post, issued), String(b.signature || ""))) throw new HttpError(401, "The signature doesn't match this wallet.");

  const caller = await getCaller(wallet);
  if (!caller) throw new HttpError(403, "Register as a caller first.");
  if (!ownPlatformId()) throw new HttpError(503, "CALLED's platform is not live yet.");

  const id = callId(wallet, mint);
  const [dupe, calls] = await Promise.all([readJson<Call>(`calls/${id}.json`), allCalls()]);
  if (dupe) throw new HttpError(409, "You already called this coin. One call per coin.");
  const recent = calls.filter((c) => c.wallet === wallet && Date.now() - c.at < 86_400_000).length;
  if (recent >= CALLS.perDay) throw new HttpError(429, `${CALLS.perDay} calls per 24 hours. Your next one opens when the oldest is a day old.`);

  const postId = postIdFrom(post);
  if (!postId) throw new HttpError(400, "Paste the link to your X post, like https://x.com/you/status/123…");
  const postAt = postTime(postId);
  const age = Date.now() - postAt;
  if (age > CALLS.maxPostAgeMin * 60_000) throw new HttpError(400, `The post is ${Math.round(age / 60_000)} minutes old. Calls have to be registered within ${CALLS.maxPostAgeMin} minutes of posting.`);
  if (age < -120_000) throw new HttpError(400, "That post id doesn't look right.");

  const [[coin], sol] = await Promise.all([loadCoins([mint]), solUsd().catch(() => ({ usd: 0 }))]);
  if (!coin) throw new HttpError(404, "That coin isn't on Raydium LaunchLab.");
  if (!coin.isCalled) throw new HttpError(400, "Only coins launched on CALLED can be called here. That's where the pot comes from.");
  if (!coin.priceSol) throw new HttpError(503, "Couldn't read the price right now. Try again in a moment.");

  const read = await readPost(post);
  let postVerified: boolean | null = null;
  if (read.ok) {
    if (read.author !== caller.handle) throw new HttpError(400, `That post is from @${read.author}, not @${caller.handle}.`);
    const txt = read.text.toUpperCase();
    if (!txt.includes(mint.toUpperCase()) && !(coin.symbol && txt.includes(`$${coin.symbol.toUpperCase()}`)))
      throw new HttpError(400, `The post has to mention $${coin.symbol} or the CA.`);
    postVerified = true;
  } else if (read.reason === "missing") throw new HttpError(400, "That post can't be found. Is the account public?");

  const at = Date.now();
  const call: Call = {
    id,
    seq: calls.length + 1,
    wallet,
    handle: caller.handle,
    xVerified: caller.xVerified,
    mint,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image,
    creator: coin.creator,
    post,
    postAt,
    postVerified,
    at,
    due: at + WINDOW_MS,
    week: weekKey(at),
    entry: snapOf(coin, sol.usd),
    live: null,
    sells: { checkedAt: null, sold: false },
    result: null,
  };
  await saveCall(call);
  waitUntil(
    sellCheck(call)
      .then((sells) => saveCall({ ...call, sells }))
      .catch(() => null),
  );
  return { call };
});
