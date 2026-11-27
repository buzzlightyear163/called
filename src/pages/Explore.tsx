import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Eyebrow, Mc, Panel, Pill, Progress } from "../components/Bits";
import { usePoll } from "../lib/hooks";
import { ago, pct } from "../lib/format";
import type { Board, Coin } from "../lib/api";
import { PROOF_LAUNCH } from "../../shared/curve";
import { CALLS } from "../../shared/calls";

type StatusF = "all" | "curve" | "graduated";
type SortF = "new" | "mc" | "calls" | "close";

export function CoinCard({ c }: { c: Coin }) {
  return (
    <Link to={`/c/${c.mint}`} className="ccard">
      <div className="ccard-h">
        <Avatar coin={c} size={42} />
        <div className="ccard-t">
          <b className="mono">${c.symbol || "…"}</b>
          <span className="dim">
            {c.name || "Unnamed"} · {ago(c.createdAt)}
          </span>
        </div>
        {c.status !== "curve" && <Pill tone="gain">Graduated</Pill>}
      </div>
      <div className="ccard-mc">
        <span className="mono">
          <Mc solValue={c.mcSol} usdValue={c.mcUsd} />
        </span>
        <span className="dim mono">{c.status === "curve" ? `${pct(c.fill, 1)} to graduate` : "on Raydium"}</span>
      </div>
      <Progress value={c.status === "curve" ? c.fill : 1} tone={c.status === "curve" ? "mark" : "ok"} />
      <div className="ccard-f">
        {c.mint === PROOF_LAUNCH && <Pill tone="gain">Proof launch</Pill>}
        <Pill tone={c.calls ? "mark" : "dim"}>
          {c.calls ? `${c.calls} call${c.calls === 1 ? "" : "s"}` : "No calls yet"}
        </Pill>
      </div>
    </Link>
  );
}

export default function Explore() {
  const { data, error } = usePoll<Board>("/api/coins", 12_000);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusF>("all");
  const [sort, setSort] = useState<SortF>("new");

  const coins = useMemo(() => {
    let list = data?.coins ?? [];
    const t = q.trim().toLowerCase().replace(/^\$/, "");
    if (t) list = list.filter((c) => c.symbol.toLowerCase().includes(t) || c.name.toLowerCase().includes(t) || c.mint.toLowerCase() === t);
    if (status === "curve") list = list.filter((c) => c.status === "curve");
    if (status === "graduated") list = list.filter((c) => c.status !== "curve");
    const mcOf = (c: Coin) => c.mcUsd ?? (c.mcSol ?? 0) * 100;
    if (sort === "mc") list = [...list].sort((a, b) => mcOf(b) - mcOf(a));
    if (sort === "calls") list = [...list].sort((a, b) => (b.calls ?? 0) - (a.calls ?? 0));
    if (sort === "close") list = [...list].filter((c) => c.status === "curve").sort((a, b) => b.fill - a.fill);
    return list;
  }, [data, q, status, sort]);

  const st = data?.stats;
  const called = (data?.coins ?? []).reduce((s, c) => s + (c.calls ?? 0), 0);
  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <Eyebrow>Explore</Eyebrow>
          <h1 className="h-page">
            Every coin here is <mark>callable</mark>.
          </h1>
          <p className="lead">Every coin launched on CALLED, live from Raydium LaunchLab, with how many registered callers have called it.</p>
        </div>

        <div className="explore-grid">
          <Panel title="Coins launched here" aside={`${data?.coins?.length ?? 0} coins`}>
            <div className="search">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, ticker or address" aria-label="Search coins" />
            </div>
            <div className="filters">
              <div className="chips">
                {(["all", "curve", "graduated"] as StatusF[]).map((s) => (
                  <button key={s} className={`chip${status === s ? " on" : ""}`} onClick={() => setStatus(s)}>
                    {s === "all" ? "All" : s === "curve" ? "On the curve" : "Graduated"}
                  </button>
                ))}
              </div>
              <div className="chips">
                {(["new", "calls", "mc", "close"] as SortF[]).map((s) => (
                  <button key={s} className={`chip${sort === s ? " on" : ""}`} onClick={() => setSort(s)}>
                    {s === "new" ? "Newest" : s === "calls" ? "Most called" : s === "mc" ? "Market cap" : "Closest to graduating"}
                  </button>
                ))}
              </div>
            </div>
            {!data && !error && <div className="empty">Reading the chain…</div>}
            {error && !data && <div className="empty">Could not load coins right now. Retrying.</div>}
            {data && coins.length === 0 && (
              <div className="empty">
                {(data.coins?.length ?? 0) === 0 ? (
                  <>
                    No coins yet. <Link to="/launch">Launch the first one →</Link>
                  </>
                ) : (
                  "Nothing matches."
                )}
              </div>
            )}
            <div className="cgrid">
              {coins.map((c) => (
                <CoinCard key={c.mint} c={c} />
              ))}
            </div>
          </Panel>

          <aside className="explore-r">
            <div className="stat4">
              <div>
                <b>{st?.launched ?? "–"}</b>
                <span>launched</span>
              </div>
              <div>
                <b>{st?.onCurve ?? "–"}</b>
                <span>on the curve</span>
              </div>
              <div>
                <b>{st?.graduated ?? "–"}</b>
                <span>graduated</span>
              </div>
              <div>
                <b>{data ? called : "–"}</b>
                <span>calls made</span>
              </div>
            </div>
            <Panel title="Calling a coin here" aside="registered callers">
              <ul className="ticks tight">
                <li>Paste the CA and your X post on the call page, within {CALLS.maxPostAgeMin} minutes of posting.</li>
                <li>The price is stamped the moment you sign.</li>
                <li>{CALLS.windowHours} hours later the receipt settles on what your followers made.</li>
              </ul>
              <Link to="/call" className="btn-primary small wide-mt">
                Make a call
              </Link>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}
