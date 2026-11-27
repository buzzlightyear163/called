import { waitUntil } from "@vercel/functions";
import { ECON } from "../shared/curve";
import { weekEnd, weekKey, weekStart } from "../shared/calls";
import { handle, ownPlatformId, platformVaultFor, rpcBatch, solUsd, treasuryWallet } from "./_lib/solana";
import { cached } from "./_lib/store";
import { allCallers, allCalls, boardFor, housekeeping, withLive, type Call } from "./_lib/calls";

// This week's caller board, the pot (read live from the platform's fee vault), and every payout the treasury sent.

type Receipt = { sig: string; at: number | null; to: string; amount: number; asset: string; mint: string | null };

async function payouts(treasury: string): Promise<Receipt[]> {
  const [sigs] = await rpcBatch<{ signature: string; blockTime: number | null; err: unknown }[]>([{ method: "getSignaturesForAddress", params: [treasury, { limit: 40 }] }]);
  const ok = (sigs || []).filter((s) => !s.err);
  const txs = await rpcBatch<any>(ok.map((s) => ({ method: "getTransaction", params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] })));
  const out: Receipt[] = [];
  txs.forEach((tx, i) => {
    if (!tx) return;
    const ixs: any[] = [...(tx.transaction?.message?.instructions || []), ...((tx.meta?.innerInstructions || []) as any[]).flatMap((x: any) => x.instructions || [])];
    for (const ix of ixs) {
      const info = ix?.parsed?.info;
      if (!info) continue;
      if (ix.program === "system" && ix.parsed.type === "transfer" && info.source === treasury && info.destination !== treasury) {
        const amount = Number(info.lamports || 0) / 1e9;
        if (amount >= 0.001) out.push({ sig: ok[i].signature, at: ok[i].blockTime, to: info.destination, amount, asset: "SOL", mint: null });
      }
    }
  });
  return out;
}


export default handle(async (_req, res) => {
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
  waitUntil(housekeeping(25_000, 2).catch(() => null));
  return cached("board", 15_000, async () => {
    const now = Date.now();
    const week = weekKey(now);
    const lastWeek = weekKey(weekStart(now) - 1);
    const own = ownPlatformId();
    const treasury = treasuryWallet();
    const [calls0, callers, sol, vault, paid] = await Promise.all([
      allCalls(),
      allCallers(),
      solUsd().catch(() => ({ usd: 0 })),
      own ? rpcBatch<any>([{ method: "getTokenAccountBalance", params: [platformVaultFor(own).toBase58()] }]).then(([v]) => (v?.value?.uiAmount ?? 0) as number) : Promise.resolve(null),
      treasury ? cached("payouts", 120_000, () => payouts(treasury).catch(() => [])) : Promise.resolve([] as Receipt[]),
    ]);
    // A caller's current X check and handle win over what was copied onto old calls.
    const who = new Map(callers.map((c) => [c.wallet, c]));
    const calls = calls0.map((c) => {
      const k = who.get(c.wallet);
      return k ? { ...c, handle: k.handle, xVerified: k.xVerified } : c;
    });
    const potSol = vault != null ? vault * ECON.potShare : null;
    const thisWeek = calls.filter((c) => c.week === week);
    const prev = calls.filter((c) => c.week === lastWeek);
    const rows = boardFor(thisWeek, potSol);
    const settledThis = thisWeek.filter((c) => c.result && !c.result.flagged).sort((a, b) => b.result!.points - a.result!.points);
    const settledPrev = prev.filter((c) => c.result && !c.result.flagged).sort((a, b) => b.result!.points - a.result!.points);
    const bestPick = settledThis[0] ?? settledPrev[0] ?? null;
    const best = bestPick && bestPick.result!.points > 0 ? bestPick : null;
    const flagged = calls.filter((c) => c.sells.sold || c.result?.flagged).slice(0, 6);
    const recent = await withLive(calls.slice(0, 14));
    return {
      at: now,
      week,
      weekStart: weekStart(now),
      weekEnd: weekEnd(now),
      pot: { sol: potSol, usd: potSol != null && sol.usd > 0 ? potSol * sol.usd : null, vaultSol: vault, potShare: ECON.potShare },
      rows,
      recent,
      best,
      flagged,
      stats: {
        calls: thisWeek.length,
        callers: new Set(thisWeek.map((c) => c.wallet)).size,
        settled: thisWeek.filter((c) => c.result).length,
        open: thisWeek.filter((c) => !c.result).length,
        flagged: thisWeek.filter((c) => c.sells.sold || c.result?.flagged).length,
        registered: callers.length,
      },
      lastWeek: prev.length ? { week: lastWeek, rows: boardFor(prev, null) } : null,
      payouts: paid,
      treasury,
    };
  });
});
