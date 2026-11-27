import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Receipt } from "../components/Receipt";
import { usePoll, useCopy } from "../lib/hooks";
import { points, ret, short } from "../lib/format";
import type { Call } from "../lib/api";

export default function ReceiptPage() {
  const { id = "" } = useParams();
  const { data, error } = usePoll<{ call: Call }>(`/api/calls?id=${id}`, 30_000);
  const { copied, copy } = useCopy();
  const c = data?.call;
  useEffect(() => {
    if (c) document.title = `@${c.handle} called $${c.symbol} · CALLED`;
  }, [c]);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const line = c
    ? c.result
      ? `@${c.handle} called $${c.symbol}. Followers made ${ret(c.result.followerMedian)} at +24h. ${points(c.result.points)} points on CALLED.`
      : `@${c.handle} called $${c.symbol} on CALLED. The receipt settles 24 hours after the call.`
    : "";
  return (
    <main className="page">
      <div className="wrap receipt-page">
        {error && !data && (
          <div className="empty big">
            No call with that receipt number. <Link to="/callers">Leaderboard →</Link>
          </div>
        )}
        {!c && !error && <div className="empty big">Printing…</div>}
        {c && (
          <>
            <div className="rp-paper">
              <Receipt call={c} link={false} />
            </div>
            <div className="rp-side">
              <span className="kicker">Receipt {c.id}</span>
              <h1 className="h-page">
                @{c.handle} called ${c.symbol}
              </h1>
              <p className="lead">{line}</p>
              <div className="hero-cta">
                <a className="btn-primary small" href={`https://x.com/intent/post?text=${encodeURIComponent(line)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
                  Share on X ↗
                </a>
                <button className="btn-ghost small" onClick={() => copy(url)}>
                  {copied === url ? "Link copied" : "Copy link"}
                </button>
              </div>
              <dl className="sum rp-sum">
                <div>
                  <dt>Caller</dt>
                  <dd>
                    <Link to={`/caller/${c.wallet}`}>@{c.handle}</Link>
                  </dd>
                </div>
                <div>
                  <dt>Coin</dt>
                  <dd>
                    <Link to={`/c/${c.mint}`} className="mono">
                      ${c.symbol} · {short(c.mint, 4)}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>X post</dt>
                  <dd>
                    <a href={c.post} target="_blank" rel="noreferrer">
                      Open ↗
                    </a>{" "}
                    <span className="dim">{c.postVerified ? "checked" : c.postVerified === false ? "not checked" : "couldn't be read"}</span>
                  </dd>
                </div>
                {c.result && (
                  <>
                    <div>
                      <dt>Priced at +24h by</dt>
                      <dd>{c.result.price.source === "last-trade" ? "the last trade before +24h" : c.result.price.source === "dexscreener" ? "DexScreener" : "the LaunchLab pool"}</dd>
                    </div>
                    <div>
                      <dt>Trades read</dt>
                      <dd className="mono">
                        {c.result.tradesRead}
                        {c.result.buyersExact ? "" : " (sampled)"}
                      </dd>
                    </div>
                  </>
                )}
                {c.sells.sold && c.sells.sig && (
                  <div>
                    <dt>Caller's sell</dt>
                    <dd>
                      <a className="mono" href={`https://solscan.io/tx/${c.sells.sig}`} target="_blank" rel="noreferrer">
                        {short(c.sells.sig, 5)} ↗
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
