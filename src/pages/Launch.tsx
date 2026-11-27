import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Eyebrow, Panel, Pill } from "../components/Bits";
import { postJSON } from "../lib/api";
import { useSendTx, useSite } from "../lib/site";
import { CURVE, ECON, MAX_DEV_BUY_SOL, SUPPLY_TOKENS, tokensFor } from "../../shared/curve";
import { CALLS } from "../../shared/calls";
import { pct, sol, tokens, usd } from "../lib/format";

type Stage = "idle" | "upload" | "build" | "sign" | "send" | "confirm" | "register" | "done";
const STAGES: { id: Stage; label: string }[] = [
  { id: "upload", label: "Upload image and details" },
  { id: "build", label: "Build the launch on CALLED's platform" },
  { id: "sign", label: "Approve in your wallet" },
  { id: "send", label: "Send to Solana" },
  { id: "confirm", label: "Confirm on chain" },
  { id: "register", label: "List it on CALLED" },
];
const MAX_DEV = MAX_DEV_BUY_SOL;
const MAX_IMG = 1_500_000;

function readImage(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Could not read the image."));
    r.readAsDataURL(file);
  });
}

export default function Launch() {
  const { publicKey } = useWallet();
  const { openWallet, solUsd, toast } = useSite();
  const sendTx = useSendTx();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [dev, setDev] = useState("0");
  const [stage, setStage] = useState<Stage>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [launched, setLaunched] = useState<{ mint: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sym = symbol.trim().replace(/^\$/, "").toUpperCase();
  const devSol = Math.max(0, Number(dev) || 0);
  const devTokens = tokensFor(CURVE, devSol);
  const devTooBig = devSol > MAX_DEV;

  async function pickFile(f: File | undefined) {
    setImgErr(null);
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return setImgErr("Use a PNG, JPG, WEBP or GIF.");
    if (f.size > MAX_IMG) return setImgErr("The image has to be under 1.5 MB.");
    setImage(await readImage(f));
  }

  const ready = !!name.trim() && /^[A-Z0-9]{1,10}$/.test(sym) && !!image && !devTooBig;
  const busy = stage !== "idle" && stage !== "done";

  async function launch() {
    if (!publicKey) return openWallet();
    if (!ready || busy) return;
    setErr(null);
    try {
      setStage("upload");
      const up = await postJSON<{ uri: string }>("/api/launch", {
        action: "upload",
        name: name.trim(),
        symbol: sym,
        description,
        website,
        twitter,
        telegram,
        image,
      });
      setStage("build");
      const built = await postJSON<{ tx: string; mint: string }>("/api/launch", {
        action: "build",
        owner: publicKey.toBase58(),
        name: name.trim(),
        symbol: sym,
        uri: up.uri,
        devBuySol: devSol,
      });
      await sendTx(built.tx, (s) => setStage(s));
      setStage("register");
      await postJSON("/api/launch", { action: "register", mint: built.mint }).catch(() => toast("Launched. It will be listed in a moment."));
      setLaunched({ mint: built.mint });
      setStage("done");
    } catch (e: any) {
      setErr(String(e?.message || e).replace(/^Error: /, ""));
      setStage("idle");
    }
  }

  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <Eyebrow>Launch</Eyebrow>
          <h1 className="h-page">
            Launch where callers get <mark>scored</mark>.
          </h1>
          <p className="lead">
            Name, ticker, image. Your coin goes live on Raydium LaunchLab through CALLED's platform. Registered callers can call it from the first trade, and
            every trade feeds the caller pot.
          </p>
        </div>

        <div className="launch-grid">
          <div className="launch-l">
            <Panel
              title={
                <>
                  <span className="mono step">01</span> Your coin
                </>
              }
            >
              <p className="hint">Name, ticker and image go on chain for good once it launches.</p>
              <div className="row2">
                <label className="field">
                  <span className="field-l">Coin name</span>
                  <input className="input" value={name} maxLength={32} placeholder="Name your coin" onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-l">Ticker</span>
                  <div className="input-wrap">
                    <span className="input-pre">$</span>
                    <input
                      className="input has-pre"
                      value={symbol}
                      maxLength={11}
                      placeholder="TICKER"
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                  <span className="field-note">Letters and digits, up to 10.</span>
                </label>
              </div>
              <label className="field">
                <span className="field-l">
                  Description <span className="dim">(optional)</span>
                </span>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={600}
                  value={description}
                  placeholder="Write a short description"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="field">
                <span className="field-l">Coin image</span>
                <button
                  type="button"
                  className={`drop${drag ? " drag" : ""}${image ? " has" : ""}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    pickFile(e.dataTransfer.files?.[0]);
                  }}
                >
                  {image ? (
                    <>
                      <img src={image} alt="" />
                      <span>Change image</span>
                    </>
                  ) : (
                    <>
                      <b>Choose a PNG, JPG or WEBP</b>
                      <span className="dim">Square artwork, up to 1.5 MB</span>
                    </>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
                {imgErr && <span className="field-note t-taken">{imgErr}</span>}
              </div>
              <div className="row3">
                <label className="field">
                  <span className="field-l">
                    Website <span className="dim">(optional)</span>
                  </span>
                  <input className="input" value={website} placeholder="https://" onChange={(e) => setWebsite(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-l">
                    X <span className="dim">(optional)</span>
                  </span>
                  <input className="input" value={twitter} placeholder="https://x.com/…" onChange={(e) => setTwitter(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-l">
                    Telegram <span className="dim">(optional)</span>
                  </span>
                  <input className="input" value={telegram} placeholder="https://t.me/…" onChange={(e) => setTelegram(e.target.value)} />
                </label>
              </div>
            </Panel>

            <Panel
              title={
                <>
                  <span className="mono step">02</span> Dev buy
                </>
              }
              aside="optional"
            >
              <p className="hint">Bought in the same transaction as the launch, at the opening price. Up to 10% of supply.</p>
              <div className="devbuy">
                <div className="input-wrap devbuy-in">
                  <input className="input mono" inputMode="decimal" value={dev} onChange={(e) => setDev(e.target.value.replace(/[^0-9.]/g, ""))} />
                  <span className="input-post">SOL</span>
                </div>
                <div className="chips">
                  {[0, 0.5, 1, 2, 5, 10].map((v) => (
                    <button key={v} className={`chip${devSol === v ? " on" : ""}`} onClick={() => setDev(String(v))}>
                      {v === 0 ? "None" : `${v} SOL`}
                    </button>
                  ))}
                </div>
              </div>
              <p className={`field-note ${devTooBig ? "t-taken" : ""}`}>
                {devTooBig
                  ? `At most ${MAX_DEV} SOL on this curve.`
                  : devSol > 0
                    ? `About ${tokens(devTokens)} tokens, ${pct(devTokens / SUPPLY_TOKENS, 1)} of supply.`
                    : "No dev buy. You can still buy on the curve after launch like everyone else."}
              </p>
              <p className="hint warn">
                Callers are scored on what their followers make. A dev who dumps on the first callers makes the coin a bad call for everyone.
              </p>
            </Panel>

            <Panel
              title={
                <>
                  <span className="mono step">03</span> The curve
                </>
              }
              aside="standard LaunchLab"
            >
              <div className="curve-facts">
                <div>
                  <span className="k">Opens at</span>
                  <b className="mono">{sol(CURVE.openMcSol, 0)}</b>
                  {solUsd > 0 && <span className="dim mono">{usd(CURVE.openMcSol * solUsd)}</span>}
                </div>
                <div>
                  <span className="k">Graduates at</span>
                  <b className="mono">{sol(CURVE.gradMcSol, 0)}</b>
                  {solUsd > 0 && <span className="dim mono">{usd(CURVE.gradMcSol * solUsd)}</span>}
                </div>
                <div>
                  <span className="k">Raised to graduate</span>
                  <b className="mono">{sol(CURVE.raiseSol, 0)}</b>
                  <span className="dim mono">{pct(CURVE.soldRate, 1)} sold on the curve</span>
                </div>
              </div>
              <p className="hint">At graduation the coin moves to a Raydium CPMM pool and the LP is burned.</p>
            </Panel>
          </div>

          <aside className="launch-r">
            <Panel title="What your coin gets" aside="every launch">
              <ul className="ticks tight">
                <li>Callers can call it from the first trade. Each call is printed as a receipt on your coin's page.</li>
                <li>Callers are paid only if the people who bought after them made money, so a pump-and-dump call earns nothing.</li>
                <li>{Math.round(ECON.potShare * 100)}% of the platform fee on your coin's trades goes to the weekly caller pot.</li>
              </ul>
            </Panel>
            <Panel title="Launch summary" className="summary">
              <dl className="sum">
                <div>
                  <dt>Coin</dt>
                  <dd>
                    {name.trim() || <span className="dim">Name your coin</span>} {sym && <span className="mono ice">${sym}</span>}
                  </dd>
                </div>
                <div>
                  <dt>Curve</dt>
                  <dd className="mono">
                    {sol(CURVE.openMcSol, 0)} → {sol(CURVE.gradMcSol, 0)}
                  </dd>
                </div>
                <div>
                  <dt>Trade fee</dt>
                  <dd>
                    <span className="mono">{pct(ECON.tradeFee, 2)}</span> <span className="dim">0.25% LaunchLab · 1% CALLED, half to the pot</span>
                  </dd>
                </div>
                <div>
                  <dt>Dev buy</dt>
                  <dd className="mono">{devSol > 0 ? sol(devSol, devSol < 1 ? 2 : 1) : "None"}</dd>
                </div>
                <div>
                  <dt>Network</dt>
                  <dd>
                    <span className="mono">≈ 0.03 SOL</span> <span className="dim">accounts and fees</span>
                  </dd>
                </div>
              </dl>
              <div className="sum-on">
                <span className="k">What's on</span>
                <div className="pills">
                  <Pill tone="mark">Open to callers</Pill>
                  <Pill>Receipts on the coin page</Pill>
                  <Pill>{CALLS.windowHours}h scoring</Pill>
                  <Pill>LP burned</Pill>
                </div>
              </div>

              {stage === "done" && launched ? (
                <div className="done">
                  <b>Live on CALLED.</b>
                  <Link className="btn-primary wide" to={`/c/${launched.mint}`}>
                    Open your coin <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : (
                <button className="btn-primary wide" disabled={(!!publicKey && !ready) || busy} onClick={launch}>
                  {!publicKey
                    ? "Connect a wallet"
                    : busy
                      ? "Launching…"
                      : !name.trim()
                        ? "Name your coin"
                        : !sym
                          ? "Pick a ticker"
                          : !image
                            ? "Add an image"
                            : "Launch coin"}
                </button>
              )}
              {busy && (
                <ol className="stages">
                  {STAGES.map((s, i) => (
                    <li key={s.id} className={i < stageIndex ? "done" : i === stageIndex ? "on" : ""}>
                      {s.label}
                    </li>
                  ))}
                </ol>
              )}
              {err && <p className="err">{err}</p>}
              <p className="hint small">Your wallet signs once. The coin, its pool and the dev buy are created in that one transaction.</p>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}
