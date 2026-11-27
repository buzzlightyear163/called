import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Eyebrow, Panel, XHandle } from "../components/Bits";
import { Receipt } from "../components/Receipt";
import { usePoll } from "../lib/hooks";
import { date, points, ret, short } from "../lib/format";
import { median } from "../../shared/calls";
import type { CallerDetail } from "../lib/api";

export default function CallerPage() {
  const { wallet = "" } = useParams();
  const { data, error } = usePoll<CallerDetail>(`/api/callers?wallet=${wallet}`, 30_000);
  const c = data?.caller;
  useEffect(() => {
    if (c) document.title = `@${c.handle} · CALLED`;
  }, [c]);

  if (error && !data)
    return (
      <main className="page">
        <div className="wrap">
          <div className="empty big">
            Couldn't load this caller. <Link to="/callers">Back to the leaderboard →</Link>
          </div>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="page">
        <div className="wrap">
          <div className="empty big">Reading receipts…</div>
        </div>
      </main>
    );
  if (!c)
    return (
      <main className="page">
        <div className="wrap">
          <div className="empty big">
            This wallet isn't a registered caller. <Link to="/callers">Back to the leaderboard →</Link>
          </div>
        </div>
      </main>
    );

  const settled = data.calls.filter((k) => k.result);
  const allPts = settled.map((k) => k.result!.points);
  const hits = allPts.filter((p) => p > 0).length;
  const dumps = data.calls.filter((k) => k.sells.sold || k.result?.flagged).length;
  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <Eyebrow>Caller · since {date(c.registeredAt / 1000)}</Eyebrow>
          <h1 className="h-page caller-h">
            <XHandle handle={c.handle} verified={c.xVerified} />
          </h1>
          <p className="lead">
            Registered wallet <span className="mono">{short(c.wallet, 6)}</span>. Every call below was signed by this wallet, and this wallet is checked for sells.
          </p>
        </div>
        <div className="stat4 wide4">
          <div>
            <b>{data.calls.length}</b>
            <span>calls</span>
          </div>
          <div>
            <b>{settled.length ? `${Math.round((hits / settled.length) * 100)}%` : "–"}</b>
            <span>hit rate</span>
          </div>
          <div>
            <b className={(median(allPts) ?? 0) >= 0 ? "gain" : "loss"}>{points(median(allPts))}</b>
            <span>median points, all time</span>
          </div>
          <div>
            <b className={dumps ? "loss" : ""}>{dumps}</b>
            <span>sold into own call</span>
          </div>
        </div>
        {data.row && (
          <p className="hint">
            This week: {data.row.settled} settled, {data.row.open} open, followers' median {ret(data.row.followerMedian)}
            {data.row.rank ? `, rank #${data.row.rank}.` : "."}
          </p>
        )}
        <Panel title="Receipts" aside="newest first">
          {data.calls.length === 0 ? (
            <p className="hint">No calls yet.</p>
          ) : (
            <div className="rcpt-grid">
              {data.calls.map((k) => (
                <Receipt key={k.id} call={k} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
