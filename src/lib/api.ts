export async function getJSON<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json().catch(() => null);
  if (!r.ok || j == null) throw new Error(j?.error || `Request failed (${r.status})`);
  return j as T;
}

export async function postJSON<T = any>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`);
  return j as T;
}

export type Platform = {
  id: string;
  own: boolean;
  name: string;
  feeRate: number;
  creatorFeeRate: number;
};

export type SiteConfig = {
  ticker: string;
  ca: string | null;
  x: string | null;
  platform: Platform | null;
  ownPlatformExpected: string | null;
  platformAdmin: string | null;
  treasury: string | null;
  protocolFee: number;
  solUsd: number;
};

export type Coin = {
  mint: string;
  poolId: string;
  name: string;
  symbol: string;
  image: string | null;
  creator: string;
  createdAt: number | null;
  platformId: string;
  status: "curve" | "graduating" | "graduated";
  mcSol: number | null;
  mcUsd: number | null;
  priceSol: number | null;
  fill: number;
  raiseSol: number;
  raisedSol: number;
  startMcSol: number;
  gradMcSol: number;
  isCalled: boolean;
  calls?: number;
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
};

export type Board = {
  at: number;
  coins: Coin[];
  stats: { launched: number; onCurve: number; graduated: number };
};

// A price read at one moment: from the LaunchLab pool on chain, or DexScreener once graduated.
export type Snap = {
  at: number;
  priceSol: number | null;
  mcSol: number | null;
  mcUsd: number | null;
  status: "curve" | "graduating" | "graduated";
  source: "launchlab" | "dexscreener" | "last-trade";
};

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

export type SellCheck = { checkedAt: number | null; sold: boolean; sig?: string; at?: number; amount?: number };

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
};

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

export type Receipt = { sig: string; at: number | null; to: string; amount: number; asset: string; mint: string | null };

export type Leaderboard = {
  at: number;
  week: string;
  weekStart: number;
  weekEnd: number;
  pot: { sol: number | null; usd: number | null; vaultSol: number | null; potShare: number };
  rows: BoardRow[];
  recent: Call[];
  best: Call | null;
  flagged: Call[];
  stats: { calls: number; callers: number; settled: number; open: number; flagged: number; registered: number };
  lastWeek: { week: string; rows: BoardRow[] } | null;
  payouts: Receipt[];
  treasury: string | null;
};

export type CoinDetail = { coin: Coin; calls: Call[]; now: number };

export type CallerDetail = { caller: Caller | null; calls: Call[]; row: BoardRow | null; code: string };
