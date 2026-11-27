import { waitUntil } from "@vercel/functions";
import { handle, launchApi, ownPlatformId, pk, HttpError, tokenCa } from "./_lib/solana";
import { cached, listJson } from "./_lib/store";
import { type CoinRow, loadCoins } from "./_lib/coins";
import { allCalls, housekeeping, withLive } from "./_lib/calls";

// GET: every coin launched on CALLED's platform, newest first, with how many calls each has.
// GET ?mint=: one coin and every call on it.

export async function calledCoins(): Promise<CoinRow[]> {
  return cached("coins", 15_000, async () => {
    const own = ownPlatformId();
    if (!own) return [];
    const registry = await listJson<{ mint: string }>("launches/");
    const mints = registry.map((r) => r.mint);
    try {
      for (const sort of ["new", "lastTrade"]) {
        const d = await launchApi<{ rows: any[] }>(`/get/list?sort=${sort}&size=100&mintType=default&includeNsfw=true&platformId=${own.toBase58()}`);
        for (const r of d.rows || []) mints.push(r.mint);
      }
    } catch {}
    const rows = await loadCoins(mints);
    return rows.filter((r) => r.isCalled).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  });
}

export default handle(async (req, res) => {
  if (req.query.mint) {
    const mint = pk(req.query.mint, "mint").toBase58();
    const [coin] = await loadCoins([mint]);
    if (!coin) throw new HttpError(404, "This coin is not on LaunchLab.");
    const calls = await withLive((await allCalls()).filter((c) => c.mint === mint));
    coin.calls = calls.length;
    waitUntil(housekeeping(20_000, 1).catch(() => null));
    res.setHeader("Cache-Control", "s-maxage=8, stale-while-revalidate=30");
    return { coin, calls, isToken: !!tokenCa() && mint === tokenCa(), now: Date.now() };
  }
  const [coins, calls] = await Promise.all([calledCoins(), allCalls()]);
  const count = new Map<string, number>();
  for (const c of calls) count.set(c.mint, (count.get(c.mint) || 0) + 1);
  for (const c of coins) c.calls = count.get(c.mint) || 0;
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  return {
    at: Date.now(),
    coins,
    stats: {
      launched: coins.length,
      onCurve: coins.filter((c) => c.status === "curve").length,
      graduated: coins.filter((c) => c.status !== "curve").length,
    },
  };
});
