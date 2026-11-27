// How a call is scored and how the weekly pot is split. Shared by the site and the API,
// so the numbers on the page are the numbers the scorer uses.

export const CALLS = {
  windowHours: 24, // a call is priced again this long after it is registered
  maxPostAgeMin: 15, // the X post has to be this fresh when the call is registered
  perDay: 5, // calls a caller can register in any 24 hours
  minBuySol: 0.05, // smaller buys after a call do not count as real buyers
  buyersFull: 40, // a gain counts in full once this many real buyers came in after the call
  minCallsToQualify: 3, // settled calls in a week to be ranked for the pot
  sampleTx: 120, // most trades read per call when counting buyers
  split: [0.35, 0.25, 0.18, 0.12, 0.1], // pot share by rank
  liveSettleMin: 30, // settled this soon after +24h, the live price is used; later, the last trade before +24h
};

export const WINDOW_MS = CALLS.windowHours * 3600_000;

// Weight a gain by how many real buyers came in after the call: full at buyersFull, a square-root ramp below.
export function buyerWeight(buyers: number) {
  if (!(buyers > 0)) return 0;
  return Math.min(1, Math.sqrt(buyers / CALLS.buyersFull));
}

// Points for one call. A gain is weighted by real buyers. A loss always counts in full.
// A call the caller sold into earns nothing, and a loss on it still counts.
export function callPoints(followerMedian: number | null, callReturn: number, buyers: number, flagged: boolean) {
  const base = buyers > 0 && followerMedian != null ? followerMedian : callReturn;
  const pts = base > 0 ? base * buyerWeight(buyers) * 100 : base * 100;
  return flagged ? Math.min(0, pts) : pts;
}

export function median(xs: number[]) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Weeks run Monday 00:00 UTC to Monday 00:00 UTC.
export function weekStart(ms: number) {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export function weekKey(ms: number) {
  // ISO week: the week belongs to the year of its Thursday.
  const d = new Date(weekStart(ms) + 3 * 86_400_000);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekEnd(ms: number) {
  return weekStart(ms) + 7 * 86_400_000;
}

// The code a caller puts in their X post to register.
export function callerCode(hex: string) {
  return `CALLED-${hex.slice(0, 6).toUpperCase()}`;
}

// Messages the caller's wallet signs. Never a transaction, never a key.
export function registerMessage(wallet: string, handle: string, issued: string) {
  return `CALLED caller registration\nX: @${handle}\nWallet: ${wallet}\nIssued: ${issued}\nThis signature only proves you own this wallet. It moves nothing.`;
}

export function callMessage(wallet: string, mint: string, post: string, issued: string) {
  return `CALLED call\nCaller: ${wallet}\nCoin: ${mint}\nPost: ${post}\nIssued: ${issued}\nThis signature only proves you own this wallet. It moves nothing.`;
}

// X post id → the time it was posted (snowflake ids carry a millisecond timestamp).
export function postIdFrom(url: string): string | null {
  const m = /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{8,20})/.exec(url.trim());
  return m ? m[2] : null;
}

export function postHandleFrom(url: string): string | null {
  const m = /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status/.exec(url.trim());
  return m ? m[1].toLowerCase() : null;
}

export function postTime(id: string) {
  try {
    return Number((BigInt(id) >> 22n) + 1288834974657n);
  } catch {
    return 0;
  }
}

export function cleanHandle(h: string) {
  return String(h || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
}
