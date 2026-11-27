import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, exampleCall } from "../components/Receipt";
import { useSite } from "../lib/site";
import { useNow, usePoll } from "../lib/hooks";
import { points as pts, ret, sol, usd, until } from "../lib/format";
import { CaChip, CoinPill, Pill } from "../components/Bits";
import { ECON } from "../../shared/curve";
import { CALLS, weekEnd } from "../../shared/calls";
import type { Leaderboard } from "../lib/api";

const PrinterScene = lazy(() => import("../visuals/PrinterScene"));

function useNight() {
  const [night, setNight] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("theme-night"));
  useEffect(() => {
    const mo = new MutationObserver(() => setNight(document.documentElement.classList.contains("theme-night")));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return night;
}

export function PotMoney({ v, digits = 2 }: { v: number | null | undefined; digits?: number }) {
  const { solUsd } = useSite();
  if (v == null) return <>–</>;
  return (
    <>
      {sol(v, digits)}
      {solUsd > 0 && <span className="dim"> · {usd(v * solUsd)}</span>}
    </>
  );
}

export function Countdown({ to }: { to: number }) {
  const now = useNow(1000);
  return <>{until(Math.max(0, (to - now) / 1000))}</>;
}

function HeroPrinter({ data }: { data: Leaderboard | null }) {
  const { solUsd } = useSite();
  const night = useNight();
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 1600);
    return () => clearTimeout(t);
  }, []);
  const front = data?.best ?? null;
  const back = data?.flagged?.[0] ?? null;
  // Rebuild the scene only when the call itself changes, not on every poll.
  const fk = front ? `${front.id}:${front.result?.points}` : "ex";
  const bk = back ? `${back.id}:${back.result?.points}` : "ex";
  const frontCall = useMemo(() => front ?? EX_UP, [fk]); // eslint-disable-line react-hooks/exhaustive-deps
  const backCall = useMemo(() => back ?? EX_DUMP, [bk]); // eslint-disable-line react-hooks/exhaustive-deps
  const sol = useRef(solUsd);
  sol.current = solUsd;
  const r = frontCall.result;
  return (
    <div className={`printer-stage${ready ? " ready" : ""}`}>
      <span className="sr-only">
        {front ? "The latest top call" : "An example call receipt"}: ${frontCall.symbol}, followers made{" "}
        {r?.followerMedian != null ? `${Math.round(r.followerMedian * 1000) / 10}%` : "–"}.
      </span>
      {!ready && slow && (
        <div className="stack">
          <div className="stack-back">
            <Receipt call={backCall} example={!back} />
          </div>
          <div className="stack-front">
            <Receipt call={frontCall} example={!front} />
          </div>
        </div>
      )}
      <Suspense fallback={null}>
        <PrinterScene className="scene3d" front={frontCall} frontExample={!front} solUsd={sol.current} night={night} onReady={onReady} />
      </Suspense>
      <span className="stage-tag mono">
        <span className="dot live" /> {front ? "Latest top call" : "Example receipt"}
      </span>
    </div>
  );
}

const EX_UP = exampleCall("up");
const EX_DUMP = exampleCall("dump");

function Hero({ data }: { data: Leaderboard | null }) {
  const end = data?.weekEnd ?? weekEnd(Date.now());
  return (
    <div className="hero-band">
      <section className="hero">
        <div className="hero-l">
          <span className="eyebrow">
            <span className="dot live" />
            Live on Raydium LaunchLab
          </span>
          <h1 className="h-display">
            Callers get paid
            <br />
            when <mark>you</mark> do.
          </h1>
          <p className="lead">
            pump.fun pays callers for the volume a call drags in. CALLED pays them for what their followers made. Half of every platform fee fills a weekly pot,
            split by results.
          </p>

          <div className="potbar" aria-label="This week's caller pot">
            <div className="pb-cell pb-pot">
              <span className="pb-k">This week's pot</span>
              <b className="pb-v">
                <PotMoney v={data?.pot.sol} />
              </b>
            </div>
            <div className="pb-cell">
              <span className="pb-k">Week closes in</span>
              <b className="pb-v mono">
                <Countdown to={end} />
              </b>
            </div>
            <div className="pb-cell">
              <span className="pb-k">Calls this week</span>
              <b className="pb-v mono">
                {data ? data.stats.calls : "–"}
                <span className="dim"> · {data ? data.stats.callers : "–"} callers</span>
              </b>
            </div>
          </div>

          <div className="hero-cta">
            <Link to="/launch" className="btn-primary">
              Launch a coin <span aria-hidden="true">→</span>
            </Link>
            <Link to="/call" className="btn-ghost">
              Start calling
            </Link>
          </div>
          <CaChip />
        <p className="hero-note">
            {Math.round(ECON.potShare * 100)}% of the {Math.round(ECON.platformFee * 100)}% platform fee goes to the pot. Callers only earn on coins launched
            here, because that is where the fees come from.
          </p>
        </div>

        <div className="hero-r">
          <HeroPrinter data={data} />
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const { data } = usePoll<Leaderboard>("/api/board", 30_000);
  return (
    <main className="home">
      <Hero data={data} />
      <LatestCalls data={data} />
      <TwoWays />
      <HowScored />
      <DumpRule data={data} />
      <BoardPreview data={data} />
      <OnChain />
      <EndCta />
    </main>
  );
}

function LatestCalls({ data }: { data: Leaderboard | null }) {
  const calls = data?.recent ?? [];
  return (
    <section className="sec wrap" id="calls">
      <div className="sec-head">
        <div>
          <span className="kicker">Printed live</span>
          <h2 className="h2">
            Every call gets a <mark>receipt</mark>.
          </h2>
          <p>Stamped with the price when it was made, priced again 24 hours later, and scored on what the people who followed it made.</p>
        </div>
        <Link to="/callers" className="more">
          Leaderboard →
        </Link>
      </div>
      {calls.length === 0 ? (
        <div className="blank-row">
          <div className="blank-rcpt">
            <span className="mono">CALL RECEIPT · No. 000001</span>
            <b>No calls yet this week.</b>
            <span className="dim">The first receipt prints when a registered caller calls a coin launched here.</span>
            <div className="blank-cta">
              <Link to="/call" className="btn-primary small">
                Make the first call
              </Link>
              <Link to="/launch" className="btn-ghost small">
                Launch a coin
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rcpt-row">
          {calls.slice(0, 8).map((c) => (
            <div className="rcpt-cell" key={c.id}>
              <Receipt call={c} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TwoWays() {
  return (
    <section className="sec wrap">
      <div className="sec-head">
        <div>
          <span className="kicker">Why now</span>
          <h2 className="h2">
            Two ways to pay a <mark>caller</mark>.
          </h2>
          <p>
            Since August, pump.fun has paid callers on the volume a call pulls in. The smaller the cap, the easier the volume. CALLED pays on what happened to
            the people who bought.
          </p>
        </div>
      </div>
      <div className="ways">
        <div className="way way-old">
          <span className="kicker">Paid on volume · pump.fun callout rewards</span>
          <div className="way-stats">
            <div>
              <b>$29.6M</b>
              <span>paid since August</span>
            </div>
            <div>
              <b>51,115</b>
              <span>wallets paid</span>
            </div>
            <div>
              <b>16%</b>
              <span>went to 10 wallets</span>
            </div>
            <div>
              <b>$13</b>
              <span>median payout</span>
            </div>
          </div>
          <ul className="way-list">
            <li>A call earns on the trading volume it generates.</li>
            <li>Volume is easiest to pull on the smallest caps.</li>
            <li>Nothing checks whether the people who bought made money.</li>
          </ul>
          <span className="way-src">Figures: Sparsity, “Where does 95% of Pump.fun's revenue come from”, Nov 2026.</span>
        </div>
        <div className="way way-new">
          <span className="kicker">Paid on results · the CALLED pot</span>
          <ul className="way-list big">
            <li>
              <b>Followers' median at +24h.</b> A call is scored on what the real buyers after it made, priced 24 hours later.
            </li>
            <li>
              <b>Weighted by real buyers.</b> Buys under {CALLS.minBuySol} SOL don't count. A gain counts in full at {CALLS.buyersFull} buyers.
            </li>
            <li>
              <b>Sell into your call, earn nothing.</b> The caller's own wallet is watched for the whole window.
            </li>
            <li>
              <b>Paid from fees, not emissions.</b> {Math.round(ECON.potShare * 100)}% of the {Math.round(ECON.platformFee * 100)}% platform fee on every trade
              here.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function HowScored() {
  const steps = [
    {
      n: "01",
      t: "Register",
      d: "Connect a wallet, post a short code from your X account and sign one message. The signature proves the wallet is yours. It moves nothing.",
    },
    {
      n: "02",
      t: "Call",
      d: `Paste the CA and the link to your X post, made in the last ${CALLS.maxPostAgeMin} minutes. The call is stamped with the time and the price on the spot.`,
    },
    {
      n: "03",
      t: "Settle at +24h",
      d: "The coin is priced again. Every wallet that bought after the call is read from the chain, and its result at +24h is counted.",
    },
    {
      n: "04",
      t: "Weekly pot",
      d: `Callers with ${CALLS.minCallsToQualify}+ settled calls are ranked by the median points of their calls. The top ${CALLS.split.length} split the pot.`,
    },
  ];
  return (
    <section className="sec wrap" id="how">
      <div className="sec-head">
        <div>
          <span className="kicker">How a call is scored</span>
          <h2 className="h2">
            Right gets paid. <mark>Loud</mark> doesn't.
          </h2>
        </div>
        <Link to="/docs" className="more">
          The full rules →
        </Link>
      </div>
      <div className="steps">
        {steps.map((s) => (
          <div className="stepc" key={s.n}>
            <span className="stepc-n">{s.n}</span>
            <h3 className="h3">{s.t}</h3>
            <p>{s.d}</p>
          </div>
        ))}
      </div>
      <div className="formula">
        <div className="f-eq">
          <span className="f-k">points</span>
          <span className="f-op">=</span>
          <span className="f-t">followers' median return at +24h</span>
          <span className="f-op">×</span>
          <span className="f-t">buyer weight</span>
        </div>
        <div className="f-notes">
          <span>Buyer weight is √(buyers ÷ {CALLS.buyersFull}), capped at 1. Ten real buyers count half. Forty count in full.</span>
          <span>A loss always counts in full. A caller who sold into the call earns nothing on it.</span>
          <span>Split: {CALLS.split.map((x) => `${Math.round(x * 100)}%`).join(" · ")}. An unpaid share rolls into next week.</span>
        </div>
      </div>
    </section>
  );
}

function DumpRule({ data }: { data: Leaderboard | null }) {
  const real = data?.flagged?.[0] ?? null;
  return (
    <section className="sec wrap">
      <div className="dump">
        <div className="dump-l">
          <span className="kicker">The one rule that matters</span>
          <h2 className="h2">
            Sell into your own call and it <mark>prints zero</mark>.
          </h2>
          <p className="lead">
            When a caller registers, they sign with the wallet they trade from. For the full 24 hours after a call, that wallet is watched for this coin. If it
            sells or moves the bag, the receipt is stamped and the call earns nothing. If the call was losing anyway, the loss still counts.
          </p>
          <ul className="ticks">
            <li>Read from the chain, on the wallet the caller registered.</li>
            <li>Shown on the receipt the moment it happens.</li>
            <li>Counted on the leaderboard as a flagged dump.</li>
          </ul>
        </div>
        <div className="dump-r">
          <Receipt call={real ?? EX_DUMP} example={!real} />
        </div>
      </div>
    </section>
  );
}

function BoardPreview({ data }: { data: Leaderboard | null }) {
  const rows = (data?.rows ?? []).slice(0, 5);
  return (
    <section className="sec wrap">
      <div className="sec-head">
        <div>
          <span className="kicker">This week · {data?.week ?? "–"}</span>
          <h2 className="h2">
            The pot goes to the <mark>right</mark> callers.
          </h2>
          <p>
            Pot right now:{" "}
            <b>
              <PotMoney v={data?.pot.sol} />
            </b>
            . Closes in <Countdown to={data?.weekEnd ?? weekEnd(Date.now())} />.
          </p>
        </div>
        <Link to="/callers" className="more">
          Full leaderboard →
        </Link>
      </div>
      <BoardTable rows={rows} empty="No caller has a settled call this week yet. The board fills as receipts settle." />
    </section>
  );
}

export function BoardTable({ rows, empty, showShare = true }: { rows: Leaderboard["rows"]; empty: string; showShare?: boolean }) {
  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="tbl board">
          <thead>
            <tr>
              <th>#</th>
              <th>Caller</th>
              <th className="r">Calls</th>
              <th className="r">Hit rate</th>
              <th className="r">Followers' median</th>
              <th className="r">Median points</th>
              <th className="r">Dumps</th>
              {showShare && <th className="r">Pot share</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={showShare ? 8 : 7} className="dim" style={{ padding: "34px 12px", whiteSpace: "normal" }}>
                  {empty}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.wallet} className={r.rank ? "paid" : ""}>
                <td>{r.rank ? <span className={`rank r${r.rank}`}>{r.rank}</span> : <span className="dim mono">{i + 1}</span>}</td>
                <td>
                  <Link to={`/caller/${r.wallet}`} className="who">
                    @{r.handle}
                    {r.xVerified && <i className="xok">✓</i>}
                  </Link>
                </td>
                <td className="r mono">
                  {r.settled}
                  <span className="dim">/{r.calls}</span>
                </td>
                <td className="r mono">{r.hitRate == null ? "–" : `${Math.round(r.hitRate * 100)}%`}</td>
                <td className={`r mono ${r.followerMedian == null ? "" : r.followerMedian >= 0 ? "gain" : "loss"}`}>{ret(r.followerMedian)}</td>
                <td className={`r mono ${r.medianPoints == null ? "" : r.medianPoints >= 0 ? "gain" : "loss"}`}>
                  <b>{pts(r.medianPoints)}</b>
                </td>
                <td className={`r mono ${r.flagged ? "loss" : "dim"}`}>{r.flagged}</td>
                {showShare && (
                  <td className="r mono">
                    {r.rank ? (
                      <>
                        {Math.round(r.share * 100)}%{r.estSol != null && <span className="dim"> · {sol(r.estSol, 2)}</span>}
                      </>
                    ) : (
                      <span className="dim">{r.settled < CALLS.minCallsToQualify ? `${CALLS.minCallsToQualify - r.settled} more` : "–"}</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OnChain() {
  return (
    <section className="sec wrap" id="by-hand">
      <div className="sec-head">
        <div>
          <span className="kicker">No surprises</span>
          <h2 className="h2">
            What runs live, and what we do <mark>by hand</mark>.
          </h2>
        </div>
      </div>
      <div className="split2">
        <div className="panel">
          <div className="panel-b">
            <Pill tone="mark">Live</Pill>
            <ul className="ticks">
              <li>CALLED's own LaunchLab platform: launch, explore, coin pages.</li>
              <li>Caller registration with a wallet signature and an X post.</li>
              <li>A call register with the time and the price stamped on the spot.</li>
              <li>The +24h price from Raydium LaunchLab and DexScreener.</li>
              <li>Real buyers after each call, read from the chain.</li>
              <li>Sell checks on every caller's registered wallet.</li>
              <li>The weekly board and the pot, read live from the platform's fee vault.</li>
            </ul>
          </div>
        </div>
        <div className="panel">
          <div className="panel-b">
            <Pill tone="dim">By hand</Pill>
            <ul className="ticks dim-ticks">
              <li>
                <b>Payouts.</b> The pot is claimed and sent from the treasury by hand after each week settles. Every payout is listed on the leaderboard with
                its transaction.
              </li>
              <li>
                <b>Multi-wallet check.</b> The scorer only watches the wallet a caller registered. Before each payout the top callers are reviewed by hand for
                side wallets buying and dumping with them.
              </li>
            </ul>
            <p className="hint small">Only callers who registered themselves appear anywhere on this site. Nobody is ranked who didn't sign up.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EndCta() {
  return (
    <section className="sec wrap">
      <div className="endcta">
        <div>
          <h2 className="h2">
            Launch where callers have to be <mark>right</mark>.
          </h2>
          <p className="lead">Every trade on a coin launched here feeds the pot. Every caller who calls it is scored on what you made.</p>
        </div>
        <div className="endcta-r">
          <Link to="/launch" className="btn-primary">
            Launch a coin <span aria-hidden="true">→</span>
          </Link>
          <Link to="/call" className="btn-ghost">
            Become a caller
          </Link>
        </div>
      </div>
      <CoinPill />
    </section>
  );
}
