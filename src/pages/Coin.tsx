import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar, Mc, Panel, Pill, Progress } from "../components/Bits";
import { Receipt } from "../components/Receipt";
import { usePoll, useCopy } from "../lib/hooks";
import { useSite } from "../lib/site";
import { ago, pct, short, sol } from "../lib/format";
import type { CoinDetail } from "../lib/api";
import { PROOF_LAUNCH } from "../../shared/curve";

export default function CoinPage() {
  const { mint = "" } = useParams();
  const { data, error } = usePoll<CoinDetail & { isToken?: boolean }>(`/api/coins?mint=${mint}`, 20_000);
  const { solUsd } = useSite();
  const { copied, copy } = useCopy();
  const c = data?.coin;

  useEffect(() => {
    if (c?.symbol) document.title = `$${c.symbol} · CALLED`;
  }, [c?.symbol]);

  if (error && !data)
    return (
      <main className="page">
        <div className="wrap">
          <div className="empty big">
            {error.includes("not on LaunchLab") ? "This coin is not on Raydium LaunchLab." : "Could not load this coin right now."} <Link to="/live">Back to Explore →</Link>
          </div>
        </div>
      </main>
    );
  if (!c)
    return (
      <main className="page">
        <div className="wrap">
          <div className="empty big">Reading the chain…</div>
        </div>
      </main>
    );

  const calls = data?.calls ?? [];
  const isProof = !!PROOF_LAUNCH && c.mint === PROOF_LAUNCH;
  const raydium = `https://raydium.io/launchpad/token/?mint=${c.mint}`;
  const axiom = `https://axiom.trade/meme/${c.poolId}`;
  const dex = `https://dexscreener.com/solana/${c.mint}`;
  const settled = calls.filter((k) => k.result);
  const up = settled.filter((k) => k.result!.points > 0).length;

  return (
    <main className="page">
      <div className="wrap">
        <div className="coin-head">
          <Avatar coin={c} size={68} />
          <div className="coin-t">
            <div className="coin-tt">
              <h1>{c.name || "Unnamed"}</h1>
              <span className="mono sym">${c.symbol}</span>
              {c.status === "curve" ? <Pill>On the curve</Pill> : <Pill tone="gain">Graduated</Pill>}
              {data?.isToken ? <Pill tone="mark">$CALLED token</Pill> : c.isCalled ? <Pill tone="mark">Launched on CALLED</Pill> : <Pill tone="loss">Not a CALLED launch</Pill>}
              {isProof && <Pill tone="gain">Proof launch</Pill>}
            </div>
            <div className="coin-meta">
              <button className="ca-btn mono" onClick={() => copy(c.mint)} title="Copy contract address">
                {short(c.mint, 6)} <span className="dim">{copied === c.mint ? "copied" : "copy"}</span>
              </button>
              <span className="dim">launched {ago(c.createdAt)} ago</span>
              {c.website && (
                <a href={c.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              )}
              {c.twitter && (
                <a href={c.twitter} target="_blank" rel="noreferrer">
                  X
                </a>
              )}
              {c.telegram && (
                <a href={c.telegram} target="_blank" rel="noreferrer">
                  Telegram
                </a>
              )}
            </div>
          </div>
          <div className="coin-trade">
            <a className="btn-primary small" href={raydium} target="_blank" rel="noreferrer">
              Trade on Raydium <span aria-hidden="true">↗</span>
            </a>
            <a className="btn-ghost small" href={axiom} target="_blank" rel="noreferrer">
              Axiom
            </a>
          </div>
        </div>

        {!c.isCalled && !data?.isToken && (
          <div className="notice">This coin is on LaunchLab but wasn't launched through CALLED, so it can't be called here and its fees don't reach the pot.</div>
        )}

        <div className="coin-stats">
          <div>
            <span className="k">Market cap</span>
            <b className="mono">
              <Mc solValue={c.mcSol} usdValue={c.mcUsd} />
            </b>
            {c.mcSol != null && solUsd > 0 && <span className="dim mono">{sol(c.mcSol, 1)}</span>}
          </div>
          <div className="wide">
            <span className="k">{c.status === "curve" ? "To graduation" : "Graduated"}</span>
            <b className="mono">{c.status === "curve" ? pct(c.fill, 1) : "100%"}</b>
            <Progress value={c.status === "curve" ? c.fill : 1} tone={c.status === "curve" ? "mark" : "ok"} />
            <span className="dim mono">
              {sol(c.raisedSol, 1)} of {sol(c.raiseSol, 0)} raised
            </span>
          </div>
          <div>
            <span className="k">Calls</span>
            <b className="mono">{calls.length}</b>
            <span className="dim mono">
              {settled.length} settled · {up} up
            </span>
          </div>
        </div>

        <div className="coin-grid">
          <div className="coin-l">
            <Panel
              title="Chart"
              aside={
                <a href={dex} target="_blank" rel="noreferrer">
                  DexScreener ↗
                </a>
              }
              className="chart-panel"
            >
              <iframe
                title="Price chart"
                src={`https://dexscreener.com/solana/${c.mint}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=1`}
                loading="lazy"
              />
            </Panel>
          </div>
          <aside className="coin-r">
            <Panel title="Calls on this coin" aside={calls.length ? `${calls.length} receipt${calls.length === 1 ? "" : "s"}` : "none yet"}>
              {calls.length === 0 ? (
                <p className="hint">No registered caller has called ${c.symbol} yet.</p>
              ) : (
                <div className="rcpt-stack">
                  {calls.map((k) => (
                    <Receipt key={k.id} call={k} />
                  ))}
                </div>
              )}
              {c.isCalled && (
                <Link to={`/call?mint=${c.mint}`} className="btn-primary small wide-mt">
                  Call ${c.symbol}
                </Link>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}
