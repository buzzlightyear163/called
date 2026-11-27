import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mark } from "./Mark";
import { useSite } from "../lib/site";
import { useCopy } from "../lib/hooks";
import { short, usd, sol } from "../lib/format";
import type { Coin } from "../lib/api";

export function Avatar({ coin, size = 32 }: { coin: Pick<Coin, "image" | "symbol">; size?: number }) {
  return coin.image ? (
    <img className="ava" src={coin.image} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }} />
  ) : (
    <span className="ava ava-txt" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {(coin.symbol || "?").slice(0, 2)}
    </span>
  );
}

export function Pill({ children, tone = "dim" }: { children: ReactNode; tone?: "mark" | "gain" | "loss" | "dim" | "ink" }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="eyebrow">
      <span className="dot live" />
      {children}
    </span>
  );
}

export function Panel({ title, aside, children, className = "", id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel ${className}`} id={id}>
      {title && (
        <header className="panel-h">
          <h3>{title}</h3>
          {aside && <span className="panel-aside">{aside}</span>}
        </header>
      )}
      <div className="panel-b">{children}</div>
    </section>
  );
}

// Market cap in USD when the SOL price is known, SOL otherwise.
export function Mc({ solValue, usdValue }: { solValue: number | null; usdValue?: number | null }) {
  const { solUsd } = useSite();
  if (usdValue != null) return <>{usd(usdValue)}</>;
  if (solValue == null) return <>–</>;
  if (solUsd > 0) return <>{usd(solValue * solUsd)}</>;
  return <>{sol(solValue, 0)}</>;
}

export function Progress({ value, tone = "mark" }: { value: number; tone?: "mark" | "ok" }) {
  return (
    <div className={`prog prog-${tone}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function XHandle({ handle, verified }: { handle: string; verified?: boolean }) {
  return (
    <>
      @{handle}
      {verified && (
        <i className="xok" title="X post checked" aria-label="X post checked">
          ✓
        </i>
      )}
    </>
  );
}

// $CALLED itself: the CA once it is live.
export function CoinPill() {
  const { config } = useSite();
  const { copied, copy } = useCopy();
  const ca = config?.ca;
  return (
    <div className="coinpill" id="called-coin">
      <div className="coinpill-l">
        <Mark size={30} />
        <b>$CALLED</b>
        <span className="dim">the platform's own coin</span>
      </div>
      <div className="coinpill-r">
        {ca ? (
          <>
            <span className="mono">{short(ca, 4)}</span>
            <button className="btn-mini" onClick={() => copy(ca)}>
              {copied === ca ? "Copied" : "Copy CA"}
            </button>
            <Link className="btn-mini" to={`/c/${ca}`}>
              Chart
            </Link>
          </>
        ) : (
          <span className="mono dim">CA posted on X</span>
        )}
      </div>
    </div>
  );
}
