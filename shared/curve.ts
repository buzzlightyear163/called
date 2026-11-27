// CALLED launch math. Shared by the site (live numbers) and the API (the real launch).
// Every coin launched on CALLED uses the standard Raydium LaunchLab curve: it opens at about 28 SOL
// market cap, raises 85 SOL and graduates at about 411 SOL into a CPMM pool with the LP burned.

export const SUPPLY_TOKENS = 1_000_000_000; // 1B, 6 decimals
export const DECIMALS = 6;
export const HOUR = 3600;
export const DAY = 86_400;

// LaunchLab SOL global config (6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX)
export const LL = {
  configId: "6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX",
  protocolFee: 0.0025,
  standardOpenMcSol: 27.96,
  standardGradMcSol: 410.83,
};

// What a trade pays and where it goes.
export const ECON = {
  protocolFee: LL.protocolFee, // to Raydium LaunchLab
  platformFee: 0.01, // to CALLED's platform vault, before graduation
  potShare: 0.5, // share of the platform fee that is the caller pot
  creatorFee: 0,
  get tradeFee() {
    return this.protocolFee + this.platformFee;
  },
};

export type Curve = {
  openMcSol: number;
  gradMcSol: number;
  run: number;
  raiseSol: number;
  soldRate: number;
  poolRate: number;
  virtualA: number; // tokens
  virtualB: number; // SOL
  raw: { supply: string; totalSellA: string; totalLockedAmount: string; totalFundRaisingB: string };
};

const RAW = 10n ** BigInt(DECIMALS);
const RAW_SUPPLY = BigInt(SUPPLY_TOKENS) * RAW;

// A constant-product curve from where it opens and how far it runs to graduation.
export function curveFrom(openMcSol: number, run: number): Curve {
  const N = SUPPLY_TOKENS;
  const r = Math.sqrt(run);
  const pool = N / (1 + r);
  const sold = N - pool;
  const grad = openMcSol * run;
  const raise = (grad * pool) / N;
  const p0 = openMcSol / N;
  const A0 = (raise + (raise * sold) / pool) / (raise / pool - p0);
  const B0 = p0 * A0;
  return {
    openMcSol,
    gradMcSol: grad,
    run,
    raiseSol: raise,
    soldRate: sold / N,
    poolRate: pool / N,
    virtualA: A0,
    virtualB: B0,
    raw: {
      supply: RAW_SUPPLY.toString(),
      totalSellA: BigInt(Math.floor(sold * 1e6)).toString(),
      totalLockedAmount: "0",
      totalFundRaisingB: BigInt(Math.round(raise * 1e9)).toString(),
    },
  };
}

// The standard LaunchLab curve: 793.1M sold on the curve, 85 SOL raised.
export const CURVE = curveFrom(LL.standardOpenMcSol, LL.standardGradMcSol / LL.standardOpenMcSol);

// SOL it costs to buy a fraction of supply from a fresh curve, fee included.
export function costToBuy(c: Curve, fraction: number, feeRate = ECON.tradeFee) {
  const a = fraction * SUPPLY_TOKENS;
  if (a >= c.soldRate * SUPPLY_TOKENS) return Infinity;
  const k = c.virtualA * c.virtualB;
  return (k / (c.virtualA - a) - c.virtualB) * (1 + feeRate);
}

// Tokens a buy of `solIn` (fee included) gets from a fresh curve.
export function tokensFor(c: Curve, solIn: number, feeRate = ECON.tradeFee) {
  if (!(solIn > 0)) return 0;
  const k = c.virtualA * c.virtualB;
  const B = c.virtualB + solIn / (1 + feeRate);
  return Math.min(c.virtualA - k / B, c.soldRate * SUPPLY_TOKENS);
}

// The dev buy can take at most 10% of supply.
export const MAX_DEV_SHARE = 0.1;
export const MAX_DEV_BUY_SOL = Math.floor(costToBuy(CURVE, MAX_DEV_SHARE) * 10) / 10;

// The first coin launched through CALLED's own platform, kept on the site as proof that it works.
// Empty until that launch exists.
export const PROOF_LAUNCH = "";
