import { Keypair, PublicKey } from "@solana/web3.js";
import { CURVE } from "../shared/curve";
import { WINDOW_MS, weekKey } from "../shared/calls";
import { activePlatform, connection, getConfigInfo, handle, solUsd } from "./_lib/solana";
import { loadCoins } from "./_lib/coins";
import { readTrades, sellCheck, snapOf, type Call } from "./_lib/calls";
import { readPost } from "./_lib/xpost";
import { buildLaunch } from "./launch";
import { buildSetupTx } from "./setup";

// Checks against mainnet without sending anything.
//   /api/selftest                  simulates two launches on CALLED's platform
//   /api/selftest?setup=<wallet>   simulates the platform setup for that wallet
//   /api/selftest?mint=<coin>      dry-runs the scorer on any LaunchLab coin: trades in the last 24h, buyers, prices
//   /api/selftest?post=<x link>    reads an X post the way registration and calls do
export default handle(async (req) => {
  const conn = connection();
  if (req.query.post) return readPost(String(req.query.post));
  if (req.query.setup) {
    const admin = new PublicKey(String(req.query.setup));
    const out = await buildSetupTx(admin, "all", {}, { skipBalance: true });
    const sim = await conn.simulateTransaction(out.tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: "processed" });
    return { status: out.status, bytes: out.bytes, err: sim.value.err, units: sim.value.unitsConsumed, logs: (sim.value.logs || []).filter((l) => /Instruction:|error|Error|failed|insufficient/i.test(l)).slice(-16) };
  }
  if (req.query.mint) {
    const mint = String(req.query.mint);
    const [[coin], sol] = await Promise.all([loadCoins([mint]), solUsd().catch(() => ({ usd: 0 }))]);
    if (!coin) return { error: "not a LaunchLab coin" };
    const at = Date.now() - WINDOW_MS;
    const fake: Call = {
      id: "selftest",
      seq: 0,
      wallet: String(req.query.wallet || coin.creator),
      handle: "selftest",
      xVerified: false,
      mint,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      creator: coin.creator,
      post: "",
      postAt: at,
      postVerified: null,
      at,
      due: Date.now(),
      week: weekKey(at),
      entry: snapOf(coin, sol.usd),
      live: null,
      sells: { checkedAt: null, sold: false },
      result: null,
    };
    const t0 = Date.now();
    const tr = await readTrades(fake);
    const t1 = Date.now();
    const sells = await sellCheck(fake);
    const buys = tr.trades.filter((t) => t.tokens > 0);
    return { coin, readMs: t1 - t0, sellMs: Date.now() - t1, tradesInWindow: tr.total, read: tr.read, exact: tr.exact, buys: buys.length, sample: tr.trades.slice(-8), sells };
  }
  const owner = String(req.query.owner || "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9");
  const [platform, cfg] = await Promise.all([activePlatform(), getConfigInfo()]);
  const results = [];
  for (const k of [
    { label: "Standard curve, no dev buy", devBuySol: 0 },
    { label: "Standard curve, 1 SOL dev buy", devBuySol: 1 },
  ]) {
    try {
      const out = await buildLaunch({ owner, name: "Called Test", symbol: "CTEST", uri: "https://example.com/meta.json", ...k }, { mint: Keypair.generate() });
      const sim = await conn.simulateTransaction(out.tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: "processed" });
      results.push({ label: k.label, bytes: out.tx.serialize().length, err: sim.value.err, units: sim.value.unitsConsumed, logs: (sim.value.logs || []).filter((l) => /Instruction:|error|Error|failed|success/i.test(l)).slice(-14) });
    } catch (e: any) {
      results.push({ label: k.label, err: "build", buildError: String(e?.message || e) });
    }
  }
  return {
    platform,
    config: { minFundRaisingSol: Number(cfg.minFundRaisingB.toString()) / 1e9, migrateFeeSol: Number(cfg.migrateFee.toString()) / 1e9, tradeFeeRate: Number(cfg.tradeFeeRate.toString()) / 1e6 },
    curve: { ...CURVE },
    results,
  };
});
