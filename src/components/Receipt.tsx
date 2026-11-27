import { Link } from "react-router-dom";
import { Mark } from "./Mark";
import { useSite } from "../lib/site";
import { useNow } from "../lib/hooks";
import { points, priceSol, ret, short, until, usd, utc, sol } from "../lib/format";
import { CALLS, WINDOW_MS } from "../../shared/calls";
import type { Call, Snap } from "../lib/api";

// The signature of CALLED: every call printed as a receipt of what it did for the people who followed it.

function Mc({ s }: { s: Snap | null }) {
  const { solUsd } = useSite();
  if (!s) return <>–</>;
  if (s.mcUsd != null) return <>{usd(s.mcUsd)}</>;
  if (s.mcSol != null) return <>{solUsd > 0 ? usd(s.mcSol * solUsd) : sol(s.mcSol, 0)}</>;
  return <>–</>;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Barcode({ seed, width = 220, height = 34 }: { seed: string; width?: number; height?: number }) {
  let h = hash(seed);
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < width) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const w = 1 + (h % 4);
    const gap = 1 + ((h >>> 8) % 3);
    if (x + w > width) break;
    bars.push({ x, w });
    x += w + gap;
  }
  return (
    <svg className="barcode" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} />
      ))}
    </svg>
  );
}

export type ReceiptState = "up" | "down" | "dump" | "open";

export function receiptState(c: Call): ReceiptState {
  if (c.sells.sold || c.result?.flagged) return "dump";
  if (!c.result) return "open";
  return c.result.points > 0 ? "up" : "down";
}

function Row({ k, v, tone, big }: { k: string; v: React.ReactNode; tone?: "gain" | "loss" | "mark"; big?: boolean }) {
  return (
    <div className={`rc-row${big ? " big" : ""}`}>
      <span className="rc-k">{k}</span>
      <span className={`rc-v${tone ? ` t-${tone}` : ""}`}>{v}</span>
    </div>
  );
}

const tone = (v: number | null | undefined) => (v == null ? undefined : v >= 0 ? "gain" : "loss");

export function Receipt({ call, example = false, className = "", link = true }: { call: Call; example?: boolean; className?: string; link?: boolean }) {
  const now = useNow(30_000);
  const st = receiptState(call);
  const r = call.result;
  const live = call.live;
  const liveReturn = live?.priceSol && call.entry.priceSol ? live.priceSol / call.entry.priceSol - 1 : null;
  const left = Math.max(0, (call.due - now) / 1000);
  const elapsed = Math.min(1, Math.max(0, (now - call.at) / WINDOW_MS));
  const no = String(call.seq || 0).padStart(6, "0");

  const body = (
    <article className={`rcpt s-${st} ${className}`} aria-label={`Call receipt for $${call.symbol}`}>
      <header className="rc-top">
        <span className="rc-brand">
          <Mark size={20} />
          CALLED
        </span>
        <span>CALL RECEIPT</span>
      </header>
      <div className="rc-no">
        <span>No. {no}</span>
        <span>{utc(call.at)}</span>
      </div>
      {example && <div className="rc-ex">EXAMPLE · HOW EVERY CALL IS SCORED</div>}
      <hr />
      <Row k="CALLER" v={<>@{call.handle}{call.xVerified ? <i className="rc-tick" title="X post checked">✓</i> : null}</>} />
      <Row k="WALLET" v={<>{short(call.wallet, 4)} · signed</>} />
      <Row k="COIN" v={<>${call.symbol} · {short(call.mint, 4)}</>} />
      <hr />
      <Row k="AT THE CALL" v={<Mc s={call.entry} />} />
      <div className="rc-sub">{priceSol(call.entry.priceSol)}</div>
      {r ? (
        <>
          <Row k="+24H" v={<Mc s={r.price} />} />
          <div className="rc-sub">{priceSol(r.price.priceSol)}</div>
          <Row k="THE CALL" v={ret(r.callReturn)} tone={tone(r.callReturn)} />
        </>
      ) : (
        <>
          <Row k="NOW" v={<Mc s={live} />} />
          <Row k="SO FAR" v={ret(liveReturn)} tone={tone(liveReturn)} />
          <div className="rc-clock">
            <span className="rc-bar">
              <span style={{ width: `${elapsed * 100}%` }} />
            </span>
            <span>{left > 0 ? `SETTLES IN ${until(left).replace(/ \d\ds$/, "").toUpperCase()}` : "SETTLING NOW"}</span>
          </div>
        </>
      )}
      <hr />
      {r ? (
        <>
          <Row k="REAL BUYERS AFTER" v={`${r.buyers}${r.buyersExact ? "" : "+"}`} />
          <Row k="FOLLOWERS MADE" v={ret(r.followerMedian)} tone={tone(r.followerMedian)} big />
          <div className="rc-sub">median of buyers after the call, at +24h</div>
        </>
      ) : (
        <Row k="FOLLOWERS MADE" v="AT +24H" />
      )}
      <Row k="CALLER SOLD IN WINDOW" v={st === "dump" ? "YES" : call.sells.checkedAt || example ? "NO" : "CHECKING"} tone={st === "dump" ? "loss" : undefined} />
      <hr />
      <div className="rc-total">
        <span>POINTS</span>
        <b className={st === "dump" ? "t-loss" : r ? `t-${tone(r.points)}` : ""}>{r ? points(r.points) : "OPEN"}</b>
      </div>
      <div className={`rc-stamp st-${st}`} aria-hidden="true">
        {st === "up" && (
          <>
            <b>FOLLOWERS UP</b>
            <span>PAID FROM THE POT</span>
          </>
        )}
        {st === "down" && (
          <>
            <b>FOLLOWERS DOWN</b>
            <span>NO PAY</span>
          </>
        )}
        {st === "dump" && (
          <>
            <b>SOLD INTO OWN CALL</b>
            <span>{r && r.points < -0.05 ? "NO PAY · LOSS COUNTS" : "0 POINTS"}</span>
          </>
        )}
        {st === "open" && (
          <>
            <b>OPEN</b>
            <span>{CALLS.windowHours}H WINDOW</span>
          </>
        )}
      </div>
      <footer className="rc-foot">
        <Barcode seed={call.id} width={128} />
        <span>{example ? "calledpot · example" : `${call.week} · ${call.id.slice(0, 10)}`}</span>
      </footer>
    </article>
  );
  if (!link || example) return body;
  return (
    <Link to={`/r/${call.id}`} className="rcpt-link" aria-label={`Open receipt for $${call.symbol}`}>
      {body}
    </Link>
  );
}

// Example receipts for when no call has settled yet. Clearly marked, with no real person in them.
export function exampleCall(kind: "up" | "dump"): Call {
  const at = Date.UTC(2026, 10, 24, 14, 12);
  const base = {
    wallet: "Ca11edExamp1eWa11etXXXXXXXXXXXXXXXXXXXXXXXX",
    handle: "your_handle",
    xVerified: true,
    image: null,
    post: "https://x.com/your_handle/status/1",
    postAt: at,
    postVerified: true,
    at,
    due: at + WINDOW_MS,
    week: "2026-W48",
  };
  if (kind === "up")
    return {
      ...base,
      id: "example-up-0412",
      seq: 412,
      mint: "Ex4mp1eCo1nMintXXXXXXXXXXXXXXXXXXXXXXXXCa11",
      symbol: "YOURCOIN",
      name: "Your coin",
      entry: { at, priceSol: 0.0000003066, mcSol: 306.6, mcUsd: 41_200, status: "curve", source: "launchlab" },
      live: null,
      sells: { checkedAt: at + WINDOW_MS, sold: false },
      result: {
        price: { at: at + WINDOW_MS, priceSol: 0.000000729, mcSol: 729, mcUsd: 98_000, status: "graduated", source: "dexscreener" },
        callReturn: 1.379,
        buyers: 63,
        buyersExact: true,
        tradesRead: 118,
        followerMedian: 0.884,
        weight: 1,
        points: 88.4,
        flagged: false,
        settledAt: at + WINDOW_MS,
      },
    };
  return {
    ...base,
    id: "example-dump-0409",
    seq: 409,
    mint: "Dump3dCo1nMintXXXXXXXXXXXXXXXXXXXXXXXXXXCa11",
    symbol: "PUMPIT",
    name: "Pumped",
    entry: { at, priceSol: 0.0000001339, mcSol: 133.9, mcUsd: 18_000, status: "curve", source: "launchlab" },
    live: null,
    sells: { checkedAt: at + 3_600_000, sold: true, at: at + 2_400_000 },
    result: {
      price: { at: at + WINDOW_MS, priceSol: 0.0000001901, mcSol: 190.1, mcUsd: 25_600, status: "curve", source: "launchlab" },
      callReturn: 0.42,
      buyers: 31,
      buyersExact: true,
      tradesRead: 77,
      followerMedian: 0.118,
      weight: 0.88,
      points: 0,
      flagged: true,
      settledAt: at + WINDOW_MS,
    },
  };
}
