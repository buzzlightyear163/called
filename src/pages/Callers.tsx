import { Link } from "react-router-dom";
import { Eyebrow, Panel, Pill } from "../components/Bits";
import { Receipt } from "../components/Receipt";
import { BoardTable, Countdown, PotMoney } from "./Home";
import { usePoll } from "../lib/hooks";
import { useSite } from "../lib/site";
import { date, short, sol, usd } from "../lib/format";
import { CALLS, weekEnd } from "../../shared/calls";
import { ECON } from "../../shared/curve";
import type { Leaderboard } from "../lib/api";

export default function Callers() {
  const { data } = usePoll<Leaderboard>("/api/board", 30_000);
  const { solUsd } = useSite();
  const pot = data?.pot.sol ?? null;
  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <Eyebrow>Leaderboard · {data?.week ?? "this week"}</Eyebrow>
          <h1 className="h-page">
            Ranked by what <mark>followers made</mark>.
          </h1>
          <p className="lead">
            Callers with {CALLS.minCallsToQualify} or more settled calls this week, ranked by the median points of their calls. Only callers who registered themselves
            are listed.
          </p>
        </div>

        <div className="potband">
          <div className="potcard">
            <span className="kicker">This week's pot</span>
            <b className="pot-v">{pot == null ? "–" : sol(pot, 2)}</b>
            <span className="dim">{pot != null && solUsd > 0 ? usd(pot * solUsd) : ""}</span>
            <span className="pot-note">
              {Math.round(ECON.potShare * 100)}% of the platform fees waiting in CALLED's LaunchLab vault, read live
              {data?.pot.vaultSol != null && <> ({sol(data.pot.vaultSol, 2)} in the vault)</>}.
            </span>
          </div>
          <div className="potcard">
            <span className="kicker">Week closes in</span>
            <b className="pot-v mono">
              <Countdown to={data?.weekEnd ?? weekEnd(Date.now())} />
            </b>
            <span className="pot-note">Monday 00:00 UTC. Calls from the last day settle by Tuesday, then the pot is paid by hand from the treasury.</span>
          </div>
          <div className="potcard split">
            <span className="kicker">The split</span>
            {CALLS.split.map((x, i) => (
              <div className="split-row" key={i}>
                <span className={`rank r${i + 1}`}>{i + 1}</span>
                <span className="split-bar">
                  <span style={{ width: `${(x / CALLS.split[0]) * 100}%` }} />
                </span>
                <span className="mono">{Math.round(x * 100)}%</span>
                <span className="mono dim">{pot != null ? sol(pot * x, 2) : "–"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-line">
          <span>
            <b>{data?.stats.calls ?? "–"}</b> calls this week
          </span>
          <span>
            <b>{data?.stats.settled ?? "–"}</b> settled
          </span>
          <span>
            <b>{data?.stats.open ?? "–"}</b> open
          </span>
          <span>
            <b className={data?.stats.flagged ? "loss" : ""}>{data?.stats.flagged ?? "–"}</b> sold into own call
          </span>
          <span>
            <b>{data?.stats.registered ?? "–"}</b> registered callers
          </span>
        </div>

        <BoardTable rows={data?.rows ?? []} empty="No caller has a settled call this week yet. The board fills as receipts settle, 24 hours after each call." />

        {(data?.flagged?.length ?? 0) > 0 && (
          <section className="sec-sm">
            <div className="sec-head">
              <div>
                <h2 className="h3">Sold into their own call</h2>
                <p>The caller's registered wallet sold or moved the coin inside the 24-hour window. These calls earn nothing.</p>
              </div>
            </div>
            <div className="rcpt-row">
              {data!.flagged.map((c) => (
                <div className="rcpt-cell" key={c.id}>
                  <Receipt call={c} />
                </div>
              ))}
            </div>
          </section>
        )}

        {data?.lastWeek && (
          <section className="sec-sm">
            <div className="sec-head">
              <div>
                <h2 className="h3">Last week · {data.lastWeek.week}</h2>
                <p>The final board for last week. Payouts are sent from it.</p>
              </div>
            </div>
            <BoardTable rows={data.lastWeek.rows} empty="No settled calls last week." showShare={false} />
          </section>
        )}

        <section className="sec-sm" id="payouts">
          <Panel title="Payout receipts" aside={data?.treasury ? `treasury ${short(data.treasury, 4)}` : "treasury not set"}>
            <p className="hint">Every SOL transfer out of the treasury, read from the chain. Pot payouts go out after each week settles.</p>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>To</th>
                    <th className="r">Amount</th>
                    <th className="r">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.payouts ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="dim" style={{ whiteSpace: "normal" }}>
                        No payouts yet. The first goes out after the first full week.
                      </td>
                    </tr>
                  )}
                  {(data?.payouts ?? []).map((p) => (
                    <tr key={p.sig + p.to}>
                      <td className="mono">{p.at ? date(p.at) : "–"}</td>
                      <td>
                        <a className="mono" href={`https://solscan.io/account/${p.to}`} target="_blank" rel="noreferrer">
                          {short(p.to, 4)}
                        </a>
                      </td>
                      <td className="r mono">{sol(p.amount, 3)}</td>
                      <td className="r">
                        <a className="mono" href={`https://solscan.io/tx/${p.sig}`} target="_blank" rel="noreferrer">
                          {short(p.sig, 5)} ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>

        <div className="notice" style={{ marginTop: 22 }}>
          <b>By hand, for now:</b> payouts are sent from the treasury after each week, and the top callers are checked by hand for side wallets before they are paid.{" "}
          <Link to="/docs#by-hand">What runs by hand →</Link> <Pill tone="dim">Not financial advice</Pill>
        </div>
      </div>
    </main>
  );
}
