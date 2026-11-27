import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { Avatar, Eyebrow, Mc, Panel, Pill, XHandle } from "../components/Bits";
import { ConnectButton } from "../components/Chrome";
import { Receipt } from "../components/Receipt";
import { getJSON, postJSON, type Board, type Call, type CallerDetail } from "../lib/api";
import { useNow, usePoll } from "../lib/hooks";
import { points, short } from "../lib/format";
import { CALLS, callMessage, cleanHandle, postIdFrom, postTime, registerMessage } from "../../shared/calls";

function useSign() {
  const { signMessage, publicKey } = useWallet();
  return useCallback(
    async (message: string) => {
      if (!publicKey) throw new Error("Connect a wallet first.");
      if (!signMessage) throw new Error("This wallet can't sign messages. Use Phantom or Solflare.");
      const sig = await signMessage(new TextEncoder().encode(message));
      return bs58.encode(sig);
    },
    [signMessage, publicKey],
  );
}

const intent = (text: string) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
const nice = (e: any) => {
  const t = String(e?.message || e).replace(/^Error: /, "");
  return /reject|denied|cancel/i.test(t) ? "You cancelled in your wallet. Try again when you're ready." : t;
};

export default function CallDesk() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [me, setMe] = useState<CallerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) return setMe(null);
    setLoading(true);
    try {
      setMe(await getJSON<CallerDetail>(`/api/callers?wallet=${wallet}`));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [wallet]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <Eyebrow>Make a call</Eyebrow>
          <h1 className="h-page">
            Call it. Get <mark>scored</mark> on it.
          </h1>
          <p className="lead">
            Register once with your X account and the wallet you trade from. Then every call you register here is priced on the spot and scored {CALLS.windowHours}{" "}
            hours later on what your followers made.
          </p>
        </div>

        {!wallet ? (
          <div className="desk-grid">
            <Panel title="Connect the wallet you trade from">
              <p className="hint">
                You sign a message to prove it's yours. Never a transaction, never a seed phrase. If this wallet sells a coin you called inside the {CALLS.windowHours}
                -hour window, that call earns nothing.
              </p>
              <ConnectButton className="big" />
            </Panel>
            <Rules />
          </div>
        ) : loading && !me ? (
          <div className="empty">Reading your caller profile…</div>
        ) : !me?.caller ? (
          <div className="desk-grid">
            <Register wallet={wallet} code={me?.code ?? ""} onDone={load} />
            <Rules />
          </div>
        ) : (
          <div className="desk-grid">
            <div className="desk-l">
              <MakeCall wallet={wallet} handle={me.caller.handle} onDone={load} />
              <MyCalls calls={me.calls} />
            </div>
            <div className="desk-r">
              <Panel title="You" aside={me.caller.xVerified ? "X checked" : "X check pending"}>
                <div className="me">
                  <b className="me-h">
                    <XHandle handle={me.caller.handle} verified={me.caller.xVerified} />
                  </b>
                  <span className="mono dim">{short(me.caller.wallet, 6)}</span>
                </div>
                {!me.caller.xVerified && (
                  <p className="hint small">
                    We couldn't read your registration post yet. Calls still count; the check runs again on its own. Keep the post up until it shows as checked.
                  </p>
                )}
                <dl className="sum">
                  <div>
                    <dt>This week</dt>
                    <dd className="mono">
                      {me.row ? `${me.row.settled} settled · ${me.row.open} open` : "No calls yet"}
                    </dd>
                  </div>
                  <div>
                    <dt>Median points</dt>
                    <dd className="mono">{points(me.row?.medianPoints)}</dd>
                  </div>
                  <div>
                    <dt>Rank</dt>
                    <dd className="mono">{me.row?.rank ? `#${me.row.rank}` : me.row ? `${Math.max(0, CALLS.minCallsToQualify - (me.row.settled || 0))} settled calls to qualify` : "–"}</dd>
                  </div>
                </dl>
                <Link to={`/caller/${me.caller.wallet}`} className="more inline">
                  Your public page →
                </Link>
              </Panel>
              <Rules compact />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Rules({ compact = false }: { compact?: boolean }) {
  return (
    <Panel title="The rules" aside="same for everyone">
      <ul className="ticks tight">
        <li>Only coins launched on CALLED can be called. That's where the pot comes from.</li>
        <li>Register the call within {CALLS.maxPostAgeMin} minutes of posting it on X. The post has to mention the $TICKER or the CA.</li>
        <li>One call per coin. {CALLS.perDay} calls per 24 hours.</li>
        <li>Scored at +{CALLS.windowHours}h on the median result of real buyers after you (at least {CALLS.minBuySol} SOL each).</li>
        {!compact && <li>Sell or move the coin from your registered wallet inside the window and the call earns nothing. A loss still counts.</li>}
        <li>
          Top {CALLS.split.length} callers with {CALLS.minCallsToQualify}+ settled calls split the weekly pot.
        </li>
      </ul>
    </Panel>
  );
}

function Register({ wallet, code, onDone }: { wallet: string; code: string; onDone: () => void }) {
  const sign = useSign();
  const [handle, setHandle] = useState("");
  const [post, setPost] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const h = cleanHandle(handle);
  const validHandle = /^[a-z0-9_]{1,15}$/.test(h);
  const text = `I'm a caller on CALLED. I only get paid when the people who buy my calls make money.\n\n${code}`;
  const postOk = !!postIdFrom(post);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const issued = new Date().toISOString();
      const signature = await sign(registerMessage(wallet, h, issued));
      const r = await postJSON<{ pending: boolean }>("/api/callers", { wallet, handle: h, post: post.trim(), issued, signature });
      setOk(r.pending ? "Registered. We couldn't read the post just now; it's checked again on its own." : "Registered and checked.");
      onDone();
    } catch (e) {
      setErr(nice(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Register as a caller" aside="one time">
      <div className="reg-step">
        <span className="step">01</span>
        <label className="field">
          <span className="field-l">Your X handle</span>
          <div className="input-wrap">
            <span className="input-pre">@</span>
            <input className="input has-pre" value={handle} maxLength={40} placeholder="yourhandle" onChange={(e) => setHandle(e.target.value)} />
          </div>
        </label>
      </div>
      <div className="reg-step">
        <span className="step">02</span>
        <div className="field">
          <span className="field-l">Post your code from that account</span>
          <div className="code-box">
            <b className="mono">{code || "…"}</b>
            <a className={`btn-ghost small${validHandle && code ? "" : " disabled"}`} href={intent(text)} target="_blank" rel="noreferrer">
              Post on X ↗
            </a>
          </div>
          <span className="field-note">The post only has to contain the code. Delete it after your profile shows as checked, if you like.</span>
        </div>
      </div>
      <div className="reg-step">
        <span className="step">03</span>
        <label className="field">
          <span className="field-l">Link to that post</span>
          <input className="input mono" value={post} placeholder="https://x.com/yourhandle/status/…" onChange={(e) => setPost(e.target.value)} />
          {post && !postOk && <span className="field-note t-taken">That doesn't look like a link to an X post.</span>}
        </label>
      </div>
      <div className="reg-step">
        <span className="step">04</span>
        <div className="field">
          <span className="field-l">Sign with this wallet</span>
          <span className="field-note">
            Signs a plain message for <span className="mono">{short(wallet, 4)}</span>. It can't move anything.
          </span>
        </div>
      </div>
      <button className="btn-primary wide" disabled={!validHandle || !postOk || busy} onClick={submit}>
        {busy ? "Sign in your wallet…" : !validHandle ? "Add your X handle" : !postOk ? "Paste the post link" : "Sign and register"}
      </button>
      {err && <p className="err">{err}</p>}
      {ok && <p className="ok-msg">{ok}</p>}
    </Panel>
  );
}

function MakeCall({ wallet, handle, onDone }: { wallet: string; handle: string; onDone: () => void }) {
  const sign = useSign();
  const [params] = useSearchParams();
  const { data: board } = usePoll<Board>("/api/coins", 30_000);
  const [mint, setMint] = useState(params.get("mint") ?? "");
  const [post, setPost] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<Call | null>(null);
  const now = useNow(5000);
  const coins = board?.coins ?? [];
  const coin = useMemo(() => coins.find((c) => c.mint === mint.trim()) ?? null, [coins, mint]);
  const id = postIdFrom(post);
  const age = id ? (now - postTime(id)) / 60_000 : null;
  const tooOld = age != null && age > CALLS.maxPostAgeMin;
  const text = coin ? `Calling $${coin.symbol}.\n\nScored on CALLED: I only get paid if you make money on this.\n\n${coin.mint}` : "";

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const issued = new Date().toISOString();
      const m = mint.trim();
      const signature = await sign(callMessage(wallet, m, post.trim(), issued));
      const r = await postJSON<{ call: Call }>("/api/calls", { wallet, mint: m, post: post.trim(), issued, signature });
      setMade(r.call);
      setPost("");
      onDone();
    } catch (e) {
      setErr(nice(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={<>New call as @{handle}</>} aside={`${CALLS.windowHours}h window`}>
      <div className="reg-step">
        <span className="step">01</span>
        <div className="field">
          <span className="field-l">Coin</span>
          <input className="input mono" value={mint} placeholder="Paste a CA launched on CALLED" onChange={(e) => setMint(e.target.value.trim())} />
          {coins.length > 0 && (
            <div className="coin-picks">
              {coins.slice(0, 8).map((c) => (
                <button key={c.mint} className={`pick${c.mint === mint ? " on" : ""}`} onClick={() => setMint(c.mint)}>
                  <Avatar coin={c} size={22} />
                  <span className="mono">${c.symbol}</span>
                  <span className="dim mono">
                    <Mc solValue={c.mcSol} usdValue={c.mcUsd} />
                  </span>
                </button>
              ))}
            </div>
          )}
          {mint && !coin && board && <span className="field-note">Not in the list of CALLED coins. It will be checked when you sign.</span>}
        </div>
      </div>
      <div className="reg-step">
        <span className="step">02</span>
        <div className="field">
          <span className="field-l">Post the call on X</span>
          <div className="code-box">
            <span className="dim">{coin ? `Mention $${coin.symbol} or the CA.` : "Pick a coin first."}</span>
            <a className={`btn-ghost small${coin ? "" : " disabled"}`} href={coin ? intent(text) : undefined} target="_blank" rel="noreferrer">
              Post on X ↗
            </a>
          </div>
        </div>
      </div>
      <div className="reg-step">
        <span className="step">03</span>
        <label className="field">
          <span className="field-l">Link to the post</span>
          <input className="input mono" value={post} placeholder="https://x.com/you/status/…" onChange={(e) => setPost(e.target.value)} />
          {post && !id && <span className="field-note t-taken">That doesn't look like a link to an X post.</span>}
          {age != null && (
            <span className={`field-note${tooOld ? " t-taken" : ""}`}>
              {tooOld ? `Posted ${Math.round(age)} minutes ago. Calls have to be registered within ${CALLS.maxPostAgeMin} minutes.` : `Posted ${Math.max(0, Math.round(age))} min ago. Good.`}
            </span>
          )}
        </label>
      </div>
      <button className="btn-primary wide" disabled={!mint || !id || tooOld || busy} onClick={submit}>
        {busy ? "Sign in your wallet…" : "Sign and stamp the call"}
      </button>
      {err && <p className="err">{err}</p>}
      {made && (
        <div className="made">
          <p className="ok-msg">Stamped. Your receipt settles in {CALLS.windowHours} hours.</p>
          <Receipt call={made} />
        </div>
      )}
    </Panel>
  );
}

function MyCalls({ calls }: { calls: Call[] }) {
  if (!calls.length) return null;
  return (
    <Panel title="Your receipts" aside={`${calls.length} call${calls.length === 1 ? "" : "s"}`}>
      <div className="rcpt-grid">
        {calls.map((c) => (
          <Receipt key={c.id} call={c} />
        ))}
      </div>
      <p className="hint small">
        <Pill tone="dim">Open</Pill> calls settle {CALLS.windowHours} hours after they were stamped.
      </p>
    </Panel>
  );
}
