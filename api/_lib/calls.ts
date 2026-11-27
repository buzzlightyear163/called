import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createHash } from "crypto";
import { CALLS, WINDOW_MS, callPoints, buyerWeight, median, weekKey } from "../../shared/calls";
import { rpcBatch, solUsd } from "./solana";
import { cached, listJson, putJson, readJson } from "./store";
import { loadCoins, type CoinRow } from "./coins";

export type Snap = {
  at: number;
  priceSol: number | null;
  mcSol: number | null;
  mcUsd: number | null;
  status: "curve" | "graduating" | "graduated";
  source: "launchlab" | "dexscreener" | "last-trade";
};

export type SellCheck = { checkedAt: number | null; sold: boolean; sig?: string; at?: number; amount?: number };

export type CallResult = {
  price: Snap;
  callReturn: number;
  buyers: number;
  buyersExact: boolean;
  tradesRead: number;
  followerMedian: number | null;
  weight: number;
  points: number;
  flagged: boolean;
  settledAt: number;
};

export type Call = {
  id: string;
  seq: number;
  wallet: string;
  handle: string;
  xVerified: boolean;
  mint: string;
  symbol: string;
  name: string;
  image: string | null;
  creator: string;
  post: string;
  postAt: number;
  postVerified: boolean | null;
  at: number;
  due: number;
  week: string;
  entry: Snap;
  live: Snap | null;
  sells: SellCheck;
  result: CallResult | null;
};

export type Caller = {
  wallet: string;
  handle: string;
  xVerified: boolean;
  proofPost: string;
  registeredAt: number;
  checkedAt?: number;
};

export const callId = (wallet: string, mint: string) => createHash("sha256").update(`${wallet}:${mint}`).digest("hex").slice(0, 16);

export function snapOf(c: CoinRow, sol: number): Snap {
  return {
    at: Date.now(),
    priceSol: c.priceSol,
    mcSol: c.mcSol,
    mcUsd: c.mcUsd ?? (c.mcSol != null && sol > 0 ? c.mcSol * sol : null),
    status: c.status,
    source: c.status === "graduated" ? "dexscreener" : "launchlab",
  };
}

// ——— Storage ———

export async function allCalls(): Promise<Call[]> {
  return cached("calls", 15_000, async () => {
    const list = await listJson<Call>("calls/", 5000);
    return list.sort((a, b) => b.at - a.at);
  });
}

export async function saveCall(c: Call) {
  await putJson(`calls/${c.id}.json`, c);
}

export async function allCallers(): Promise<Caller[]> {
  return cached("callers", 30_000, () => listJson<Caller>("callers/", 5000));
}

export async function getCaller(wallet: string) {
  return readJson<Caller>(`callers/${wallet}.json`);
}

// ——— Live prices for open calls ———

export async function withLive(calls: Call[]): Promise<Call[]> {
  const open = calls.filter((c) => !c.result);
  if (!open.length) return calls;
  const mints = Array.from(new Set(open.map((c) => c.mint))).sort();
  const live = await cached(`live:${mints.join(",").slice(0, 400)}:${mints.length}`, 20_000, async () => {
    const [rows, sol] = await Promise.all([loadCoins(mints, { meta: false }), solUsd().catch(() => ({ usd: 0 }))]);
    const m: Record<string, Snap> = {};
    for (const r of rows) m[r.mint] = snapOf(r, sol.usd);
    return m;
  });
  return calls.map((c) => (c.result ? c : { ...c, live: live[c.mint] ?? c.live }));
}

// ——— Did the caller's registered wallet sell or move this coin inside the window? ———

function tokenDelta(tx: any, mint: string, owner: string) {
  const pre: any[] = tx?.meta?.preTokenBalances || [];
  const post: any[] = tx?.meta?.postTokenBalances || [];
  const sum = (xs: any[]) => xs.filter((b) => b.mint === mint && b.owner === owner).reduce((s, b) => s + Number(b.uiTokenAmount?.uiAmount || 0), 0);
  return sum(post) - sum(pre);
}

export async function sellCheck(c: Call): Promise<SellCheck> {
  const now = Date.now();
  let ata: string;
  try {
    ata = getAssociatedTokenAddressSync(new PublicKey(c.mint), new PublicKey(c.wallet), true).toBase58();
  } catch {
    return { checkedAt: now, sold: false };
  }
  const [sigs] = await rpcBatch<{ signature: string; blockTime: number | null; err: unknown }[]>([
    { method: "getSignaturesForAddress", params: [ata, { limit: 100 }] },
  ]);
  if (sigs == null) return c.sells; // RPC refused: keep the last answer
  const from = c.at / 1000;
  const to = Math.min(c.due, now) / 1000;
  const inWin = sigs.filter((s) => !s.err && s.blockTime != null && s.blockTime >= from && s.blockTime <= to).slice(0, 30);
  if (!inWin.length) return { checkedAt: now, sold: false };
  const txs = await rpcBatch<any>(inWin.map((s) => ({ method: "getTransaction", params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] })));
  for (let i = inWin.length - 1; i >= 0; i--) {
    const d = tokenDelta(txs[i], c.mint, c.wallet);
    if (d < -1e-6) return { checkedAt: now, sold: true, sig: inWin[i].signature, at: (inWin[i].blockTime || 0) * 1000, amount: -d };
  }
  return { checkedAt: now, sold: false };
}

// ——— Trades after the call, read from the chain ———

type Trade = { owner: string; tokens: number; sol: number; at: number };

function keyOf(k: any): string {
  return typeof k === "string" ? k : k?.pubkey ?? "";
}

export function tradesIn(tx: any, mint: string, at: number): Trade[] {
  if (!tx?.meta || tx.meta.err) return [];
  const keys: string[] = (tx.transaction?.message?.accountKeys || []).map(keyOf);
  const owners = new Set<string>();
  for (const b of [...(tx.meta.preTokenBalances || []), ...(tx.meta.postTokenBalances || [])]) if (b.mint === mint && b.owner) owners.add(b.owner);
  const out: Trade[] = [];
  for (const owner of owners) {
    const tokens = tokenDelta(tx, mint, owner);
    if (Math.abs(tokens) < 1e-6) continue;
    const i = keys.indexOf(owner);
    if (i < 0) continue; // a pool vault or a transfer recipient, not a trader
    const lamports = (tx.meta.preBalances?.[i] ?? 0) - (tx.meta.postBalances?.[i] ?? 0); // + spent, − received
    out.push({ owner, tokens, sol: lamports / 1e9, at });
  }
  return out;
}

export async function readTrades(c: Call) {
  const from = c.at / 1000;
  const to = c.due / 1000;
  const all: { signature: string; blockTime: number | null; err: unknown }[] = [];
  let before: string | undefined;
  let reachedStart = false;
  for (let page = 0; page < 6; page++) {
    const [sigs] = await rpcBatch<{ signature: string; blockTime: number | null; err: unknown }[]>([
      { method: "getSignaturesForAddress", params: [c.mint, { limit: 1000, ...(before ? { before } : {}) }] },
    ]);
    if (!sigs?.length) {
      reachedStart = true;
      break;
    }
    all.push(...sigs);
    const last = sigs[sigs.length - 1];
    if ((last.blockTime ?? 0) < from || sigs.length < 1000) {
      reachedStart = true;
      break;
    }
    before = last.signature;
  }
  const win = all.filter((s) => !s.err && s.blockTime != null && s.blockTime >= from && s.blockTime <= to).reverse(); // oldest first
  let pick = win;
  if (win.length > CALLS.sampleTx) {
    // Spread evenly over the window, and always keep the last trades before +24h for the closing price.
    const step = win.length / (CALLS.sampleTx - 6);
    const idx = new Set<number>();
    for (let k = 0; k < CALLS.sampleTx - 6; k++) idx.add(Math.floor(k * step));
    for (let k = 1; k <= 6; k++) idx.add(win.length - k);
    pick = Array.from(idx)
      .sort((a, b) => a - b)
      .map((k) => win[k]);
  }
  const txs = await rpcBatch<any>(pick.map((s) => ({ method: "getTransaction", params: [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] })));
  const trades: Trade[] = [];
  txs.forEach((tx, k) => trades.push(...tradesIn(tx, c.mint, (pick[k].blockTime || 0) * 1000)));
  return { trades, total: win.length, read: pick.length, exact: reachedStart && win.length <= CALLS.sampleTx };
}

// ——— Settle: price the call at +24h and score it ———

const settling = new Set<string>();

export async function settle(c: Call): Promise<Call> {
  if (c.result || settling.has(c.id) || Date.now() < c.due) return c;
  settling.add(c.id);
  try {
    const now = Date.now();
    const [sells, tr, sol] = await Promise.all([sellCheck(c), readTrades(c), solUsd().catch(() => ({ usd: 0 }))]);

    // The closing price: live if we are settling on time, else the last trade before +24h.
    let price: Snap | null = null;
    if (now - c.due <= CALLS.liveSettleMin * 60_000) {
      const [row] = await loadCoins([c.mint], { meta: false });
      if (row?.priceSol) price = snapOf(row, sol.usd);
    }
    if (!price) {
      const last = [...tr.trades].reverse().find((t) => Math.abs(t.tokens) > 0 && Math.abs(t.sol) > 0.0005);
      if (last) {
        const p = Math.abs(last.sol) / Math.abs(last.tokens);
        price = { at: last.at, priceSol: p, mcSol: p * 1e9, mcUsd: sol.usd > 0 ? p * 1e9 * sol.usd : null, status: c.live?.status ?? c.entry.status, source: "last-trade" };
      }
    }
    if (!price) {
      const [row] = await loadCoins([c.mint], { meta: false });
      if (row?.priceSol) price = snapOf(row, sol.usd);
    }
    if (!price?.priceSol || !c.entry.priceSol) return c; // try again on the next pass

    // Real buyers after the call: first buy per wallet, at least minBuySol, never the caller or the creator.
    const first = new Map<string, Trade>();
    for (const t of tr.trades) {
      if (t.tokens <= 0 || t.sol < CALLS.minBuySol) continue;
      if (t.owner === c.wallet || t.owner === c.creator) continue;
      if (!first.has(t.owner)) first.set(t.owner, t);
    }
    const rets = Array.from(first.values()).map((t) => (price!.priceSol! * t.tokens) / t.sol - 1);
    const buyers = first.size;
    const followerMedian = median(rets);
    const callReturn = price.priceSol / c.entry.priceSol - 1;
    const flagged = sells.sold;
    const result: CallResult = {
      price,
      callReturn,
      buyers,
      buyersExact: tr.exact,
      tradesRead: tr.read,
      followerMedian,
      weight: buyerWeight(buyers),
      points: callPoints(followerMedian, callReturn, buyers, flagged),
      flagged,
      settledAt: now,
    };
    const done: Call = { ...c, sells, result, live: null };
    await saveCall(done);
    return done;
  } catch {
    return c;
  } finally {
    settling.delete(c.id);
  }
}

// Settles what is due and refreshes sell checks on open calls, within a time budget.
export async function housekeeping(budgetMs: number, maxSettle = 2) {
  const started = Date.now();
  const calls = await allCalls();
  const due = calls.filter((c) => !c.result && Date.now() >= c.due).sort((a, b) => a.due - b.due);
  let settled = 0;
  for (const c of due) {
    if (settled >= maxSettle || Date.now() - started > budgetMs) break;
    const out = await settle(c);
    if (out.result) settled++;
  }
  const stale = calls
    .filter((c) => !c.result && Date.now() < c.due && !c.sells.sold && Date.now() - (c.sells.checkedAt ?? 0) > 10 * 60_000)
    .slice(0, 3);
  for (const c of stale) {
    if (Date.now() - started > budgetMs) break;
    const sells = await sellCheck(c).catch(() => c.sells);
    if (sells.checkedAt !== c.sells.checkedAt) await saveCall({ ...c, sells });
  }
  return { settled, due: due.length };
}

// ——— The weekly board ———

export type BoardRow = {
  wallet: string;
  handle: string;
  xVerified: boolean;
  calls: number;
  settled: number;
  open: number;
  hits: number;
  hitRate: number | null;
  medianPoints: number | null;
  followerMedian: number | null;
  flagged: number;
  qualifies: boolean;
  rank: number | null;
  share: number;
  estSol: number | null;
};

export function boardFor(calls: Call[], potSol: number | null): BoardRow[] {
  const by = new Map<string, Call[]>();
  for (const c of calls) by.set(c.wallet, [...(by.get(c.wallet) || []), c]);
  const rows: BoardRow[] = Array.from(by.values()).map((list) => {
    const settled = list.filter((c) => c.result);
    const pts = settled.map((c) => c.result!.points);
    const med = median(pts);
    const hits = pts.filter((p) => p > 0).length;
    const flagged = list.filter((c) => c.sells.sold || c.result?.flagged).length;
    return {
      wallet: list[0].wallet,
      handle: list[0].handle,
      xVerified: list.some((c) => c.xVerified),
      calls: list.length,
      settled: settled.length,
      open: list.length - settled.length,
      hits,
      hitRate: settled.length ? hits / settled.length : null,
      medianPoints: med,
      followerMedian: median(settled.map((c) => c.result!.followerMedian ?? NaN)),
      flagged,
      qualifies: settled.length >= CALLS.minCallsToQualify && (med ?? 0) > 0 && list[0].xVerified !== false,
      rank: null,
      share: 0,
      estSol: null,
    };
  });
  rows.sort((a, b) => Number(b.qualifies) - Number(a.qualifies) || (b.medianPoints ?? -1e9) - (a.medianPoints ?? -1e9) || (b.hitRate ?? 0) - (a.hitRate ?? 0) || b.calls - a.calls);
  let rank = 0;
  for (const r of rows) {
    if (!r.qualifies) continue;
    rank++;
    r.rank = rank;
    r.share = CALLS.split[rank - 1] ?? 0;
    r.estSol = potSol != null ? potSol * r.share : null;
  }
  return rows;
}

export { weekKey, WINDOW_MS };
