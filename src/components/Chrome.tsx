import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wordmark } from "./Mark";
import { useSite } from "../lib/site";
import { usePoll } from "../lib/hooks";
import { points, ret, short } from "../lib/format";
import type { Leaderboard } from "../lib/api";

export function XIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.8-6.3L6.4 22H3.3l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18.2h1.7L6.3 3.7H4.5l13.3 16.5Z" />
    </svg>
  );
}

export function ConnectButton({ className = "" }: { className?: string }) {
  const { publicKey, disconnect, connected } = useWallet();
  const { openWallet } = useSite();
  if (connected && publicKey)
    return (
      <button className={`btn-connect on ${className}`} onClick={() => disconnect().catch(() => {})} title="Disconnect">
        <span className="dot" />
        {short(publicKey.toBase58(), 4)}
      </button>
    );
  return (
    <button className={`btn-connect ${className}`} onClick={openWallet}>
      Connect
    </button>
  );
}

const nav = ({ isActive }: { isActive: boolean }) => `nav-a${isActive ? " on" : ""}`;

export function Header() {
  const { config } = useSite();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const coinHref = config?.ca ? `/c/${config.ca}` : "/#called-coin";
  const links = (
    <>
      <NavLink to={coinHref} className={() => "nav-a"}>
        ${config?.ticker || "CALLED"}
      </NavLink>
      <NavLink to="/launch" className={nav}>
        Launch
      </NavLink>
      <NavLink to="/live" className={nav}>
        Explore
      </NavLink>
      <NavLink to="/callers" className={nav}>
        Leaderboard
      </NavLink>
      <NavLink to="/docs" className={nav}>
        Docs
      </NavLink>
    </>
  );
  return (
    <header className={`hdr${scrolled ? " scrolled" : ""}`}>
      <div className="hdr-in">
        <Link to="/" className="brand" aria-label="CALLED home">
          <Wordmark />
        </Link>
        <nav className="nav">{links}</nav>
        <div className="hdr-r">
          <NavLink to="/call" className={({ isActive }) => `btn-call${isActive ? " on" : ""}`}>
            Make a call
          </NavLink>
          {config?.x && (
            <a className="icon-btn" href={config.x} target="_blank" rel="noreferrer" aria-label="CALLED on X">
              <XIcon />
            </a>
          )}
          <button className="icon-btn menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <ConnectButton />
        </div>
      </div>
      {open && (
        <nav className="nav-mobile">
          {links}
          <NavLink to="/call" className={nav}>
            Make a call
          </NavLink>
        </nav>
      )}
    </header>
  );
}

// The tape under the header: what pump.fun's callout rewards paid for, then the latest calls here.
const HOOK = [
  "pump.fun paid $29.6M in callout rewards since August",
  "51,115 wallets were paid",
  "10 wallets took 16% of it",
  "the median payout was $13",
  "paid on the volume a call drags in",
  "CALLED pays on what followers made",
];

export function Tape() {
  const { data } = usePoll<Leaderboard>("/api/board", 30_000);
  const calls = (data?.recent ?? []).slice(0, 8).map((c) => {
    const r = c.result;
    const live = c.live?.priceSol && c.entry.priceSol ? c.live.priceSol / c.entry.priceSol - 1 : null;
    const flag = c.sells.sold || r?.flagged;
    return `@${c.handle} called $${c.symbol} · ${flag ? "sold into own call" : r ? `${points(r.points)} pts` : `${ret(live)} so far`}`;
  });
  const items = [...HOOK, ...calls];
  const row = (k: string) => (
    <div className="tape-row" aria-hidden={k === "b"}>
      {items.map((t, i) => (
        <span key={`${k}${i}`} className={i < HOOK.length ? (i === HOOK.length - 1 ? "tape-us" : "") : "tape-call"}>
          {t}
        </span>
      ))}
    </div>
  );
  return (
    <div className="tape" role="marquee" aria-label="pump.fun callout rewards against CALLED">
      <div className="tape-track">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}

export function Footer() {
  const { config } = useSite();
  return (
    <footer className="ftr">
      <div className="ftr-in">
        <Wordmark size={22} />
        <Link to="/callers#payouts">Payout receipts</Link>
        <Link to="/docs#by-hand">What runs by hand</Link>
        <span>Built on Raydium LaunchLab</span>
        {config?.x && (
          <a href={config.x} target="_blank" rel="noreferrer" className="ftr-x">
            <XIcon size={12} /> X
          </a>
        )}
        <span className="dim">Only callers who registered themselves are shown. Market data is third-party and provided as-is. Nothing here is financial advice.</span>
      </div>
    </footer>
  );
}
