import { PublicKey } from "@solana/web3.js";
import { activePlatform, connection, handle, ownPlatformId, solUsd, tokenCa, treasuryWallet } from "./_lib/solana";

// Whether the $CALLED mint exists on chain yet. The CA is shown either way; the chart link waits for this.
async function caLive(ca: string): Promise<boolean> {
  if (!ca) return false;
  try {
    return !!(await connection().getAccountInfo(new PublicKey(ca)));
  } catch {
    return false;
  }
}

let cache: { at: number; v: any } | null = null;

export default handle(async (_req, res) => {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  if (cache && Date.now() - cache.at < 20_000) return cache.v;
  const own = ownPlatformId();
  const ca = tokenCa() || null;
  const [platform, sol, live] = await Promise.all([activePlatform().catch(() => null), solUsd().catch(() => ({ usd: 0, change24h: null })), caLive(ca || "")]);
  const v = {
    ticker: "CALLED",
    ca,
    caLive: live,
    x: process.env.X_URL || null,
    platform,
    ownPlatformExpected: own?.toBase58() ?? null,
    platformAdmin: (process.env.PLATFORM_ADMIN || "").trim() || null,
    treasury: treasuryWallet(),
    protocolFee: 0.0025,
    solUsd: sol.usd,
  };
  cache = { at: Date.now(), v };
  return v;
});
