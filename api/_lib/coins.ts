import { PublicKey } from "@solana/web3.js";
import { LAUNCHPAD_PROGRAM, LaunchpadPool, getPdaLaunchpadPoolId } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import { connection, launchApi, ownPlatformId } from "./solana";

export type CoinRow = {
  mint: string;
  poolId: string;
  name: string;
  symbol: string;
  image: string | null;
  creator: string;
  createdAt: number | null; // ms
  platformId: string;
  status: "curve" | "graduating" | "graduated";
  mcSol: number | null;
  mcUsd: number | null;
  priceSol: number | null; // SOL per token
  fill: number; // 0..1 curve progress
  raiseSol: number;
  raisedSol: number;
  startMcSol: number;
  gradMcSol: number;
  isCalled: boolean; // launched through CALLED's own platform
  calls?: number;
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
};

function n(b: { toString(): string }) {
  return Number(b.toString());
}

export function poolIdFor(mint: string) {
  return getPdaLaunchpadPoolId(LAUNCHPAD_PROGRAM, new PublicKey(mint), NATIVE_MINT).publicKey;
}

function fromPool(mint: string, poolId: PublicKey, p: ReturnType<typeof LaunchpadPool.decode>, own: string | null): CoinRow {
  const supply = n(p.supply);
  const vA = n(p.virtualA), vB = n(p.virtualB), rA = n(p.realA), rB = n(p.realB);
  const priceLamportsPerRaw = (vB + rB) / (vA - rA);
  const mcSol = (priceLamportsPerRaw * supply) / 1e9;
  const startMcSol = ((vB / vA) * supply) / 1e9;
  const sellA = n(p.totalSellA), locked = n(p.vestingSchedule.totalLockedAmount), raise = n(p.totalFundRaisingB);
  const migrateAmt = supply - sellA - locked;
  const gradMcSol = migrateAmt > 0 ? (((raise - n(p.migrateFee)) / migrateAmt) * supply) / 1e9 : 0;
  const status = p.status === 0 ? "curve" : p.status === 1 ? "graduating" : "graduated";
  const tokens = supply / 1e6;
  const mc = status === "curve" ? mcSol : status === "graduating" ? gradMcSol : null;
  const platformId = p.platformId.toBase58();
  return {
    mint,
    poolId: poolId.toBase58(),
    name: "",
    symbol: "",
    image: null,
    creator: p.creator.toBase58(),
    createdAt: null,
    platformId,
    status,
    mcSol: mc,
    mcUsd: null,
    priceSol: mc != null ? mc / tokens : null,
    fill: Math.min(1, raise > 0 ? rB / raise : 0),
    raiseSol: raise / 1e9,
    raisedSol: rB / 1e9,
    startMcSol,
    gradMcSol,
    isCalled: !!own && platformId === own,
  };
}

async function chunked<T, R>(items: T[], size: number, fn: (c: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await fn(items.slice(i, i + size))));
  return out;
}

// Pool state from the chain, names and images from Raydium's LaunchLab index, graduated prices from DexScreener.
export async function loadCoins(mints: string[], opts: { meta?: boolean } = {}): Promise<CoinRow[]> {
  const uniq = Array.from(new Set(mints.filter(Boolean))).slice(0, 300);
  if (!uniq.length) return [];
  const own = ownPlatformId()?.toBase58() ?? null;
  const conn = connection();
  const poolIds = uniq.map((m) => poolIdFor(m));
  const accs = await chunked(poolIds, 100, (c) => conn.getMultipleAccountsInfo(c));
  const rows: CoinRow[] = [];
  uniq.forEach((mint, i) => {
    const a = accs[i];
    if (!a) return;
    try {
      rows.push(fromPool(mint, poolIds[i], LaunchpadPool.decode(a.data), own));
    } catch {}
  });

  if (opts.meta !== false) {
    await chunked(rows, 40, async (c) => {
      try {
        const d = await launchApi<{ rows: any[] }>(`/get/by/mints?ids=${c.map((r) => r.mint).join(",")}`);
        for (const api of d.rows || []) {
          const row = c.find((r) => r.mint === api.mint);
          if (!row) continue;
          row.name = api.name || row.name;
          row.symbol = api.symbol || row.symbol;
          row.image = api.imgUrl || null;
          row.createdAt = api.createAt ?? null;
          row.website = api.website || undefined;
          row.twitter = api.twitter || undefined;
          row.telegram = api.telegram || undefined;
          row.description = api.description || undefined;
        }
      } catch {}
      return [];
    });
  }

  // Graduated coins trade on Raydium CPMM: price and market cap from DexScreener.
  const grads = rows.filter((r) => r.status === "graduated");
  await chunked(grads, 30, async (c) => {
    try {
      const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${c.map((x) => x.mint).join(",")}`);
      const pairs: any[] = await r.json();
      for (const row of c) {
        const best = pairs
          .filter((p) => p?.baseToken?.address === row.mint && p?.quoteToken?.address === NATIVE_MINT.toBase58())
          .sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
        if (best?.marketCap) row.mcUsd = Number(best.marketCap);
        if (best?.priceNative) {
          row.priceSol = Number(best.priceNative);
          row.mcSol = row.priceSol * 1e9;
        }
      }
    } catch {}
    return [];
  });
  return rows;
}
