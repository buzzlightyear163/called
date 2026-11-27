import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getJSON, postJSON } from "../lib/api";
import { useSendTx, useSite } from "../lib/site";
import { ConnectButton } from "../components/Chrome";
import { Panel } from "../components/Bits";
import { short, sol } from "../lib/format";

type Status = {
  wallet: string;
  isExpectedWallet: boolean;
  expectedWallet: string | null;
  balanceSol: number | null;
  minSol: number;
  platformId: string;
  platformExists: boolean;
  done: boolean;
  unclaimedFeesSol: number;
};

function Check({ ok, wait, children }: { ok: boolean; wait?: boolean; children: React.ReactNode }) {
  return (
    <li className={`chk ${ok ? "ok" : wait ? "wait" : ""}`}>
      <span className="chk-i">{ok ? "✓" : ""}</span>
      <span>{children}</span>
    </li>
  );
}

// Admin page (Swedish, for the owner): one approval sets up CALLED's LaunchLab platform.
export default function Setup() {
  const { publicKey } = useWallet();
  const { config } = useSite();
  const sendTx = useSendTx();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<null | "all" | "claim">(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const expected = config?.platformAdmin ?? null;

  const refresh = useCallback(async () => {
    if (!publicKey) return setStatus(null);
    try {
      setStatus(await getJSON<Status>(`/api/setup?owner=${publicKey.toBase58()}`));
    } catch (e: any) {
      setMsg({ tone: "err", text: String(e?.message || e) });
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function run(step: "all" | "claim") {
    if (!publicKey) return;
    setBusy(step);
    setMsg(null);
    try {
      const b = await postJSON<{ tx: string }>("/api/setup", { owner: publicKey.toBase58(), step, web: window.location.origin, img: `${window.location.origin}/mark-512.png` });
      await sendTx(b.tx);
      setMsg({ tone: "ok", text: step === "all" ? "Klart! CALLED-plattformen är skapad." : "Avgifterna är flyttade till din plånbok. Hälften är veckans caller-pott." });
      await refresh();
    } catch (e: any) {
      const t = String(e?.message || e);
      setMsg({ tone: "err", text: /reject|denied|cancel/i.test(t) ? "Du avbröt i Phantom. Tryck på knappen igen när du är redo." : t });
    } finally {
      setBusy(null);
    }
  }

  const right = !!status && (!expected || status.wallet === expected);
  const enoughSol = !!status && (status.done || (status.balanceSol ?? 0) >= status.minSol);

  return (
    <main className="page">
      <div className="wrap setup">
        <h1 className="h-page">
          Sätt upp <mark>CALLED</mark>
        </h1>
        <p className="lead">Ett godkännande i Phantom skapar din LaunchLab-plattform med 1 % plattformsavgift och bränd LP. Avgifterna samlas i plattformens vault, och hälften av dem är caller-potten.</p>

        <Panel title="Din treasury-plånbok">
          {expected ? (
            <p className="hint">
              Sajten väntar på plånboken <b className="mono">{short(expected, 6)}</b>. Koppla den i Phantom.
            </p>
          ) : (
            <p className="hint">Koppla plånboken som ska vara treasury.</p>
          )}

          {!publicKey ? (
            <div className="setup-connect">
              <ConnectButton className="big" />
            </div>
          ) : (
            <ul className="checks">
              <Check ok={right}>
                {right ? (
                  <>
                    Rätt plånbok kopplad: <span className="mono">{short(publicKey.toBase58(), 6)}</span>
                  </>
                ) : status ? (
                  <>
                    Fel plånbok kopplad (<span className="mono">{short(publicKey.toBase58(), 4)}</span>). Öppna Phantom, byt konto till <span className="mono">{short(expected || "", 4)}</span> och ladda om sidan.
                  </>
                ) : (
                  "Läser plånboken…"
                )}
              </Check>
              <Check ok={enoughSol} wait={!status}>
                {status ? (
                  enoughSol ? (
                    <>SOL i plånboken: {status.done ? "klart" : sol(status.balanceSol ?? 0, 3)}</>
                  ) : (
                    <>
                      Plånboken har {sol(status.balanceSol ?? 0, 3)}. Skicka minst {sol(status.minSol, 2)} dit (0,1 SOL ger marginal). Sidan uppdateras själv.
                    </>
                  )
                ) : (
                  "Läser saldo…"
                )}
              </Check>
              <Check ok={!!status?.platformExists}>Plattformen skapad</Check>
            </ul>
          )}

          {status && !status.done && (
            <button className="btn-primary wide" disabled={!right || !enoughSol || !!busy} onClick={() => run("all")}>
              {busy === "all" ? "Godkänn i Phantom…" : "Sätt upp CALLED"}
            </button>
          )}
          {status?.done && <div className="setup-done">Klart. CALLED-plattformen är live. Sätt PLATFORM_ADMIN i Vercel till den här plånboken och deploya om, sen kan du launcha.</div>}
          {msg && <p className={msg.tone === "ok" ? "setup-ok" : "err"}>{msg.text}</p>}
        </Panel>

        {status?.platformExists && right && (
          <Panel title="Avgifter">
            <p className="hint">
              Väntar i LaunchLab: <b className="mono">{sol(status.unclaimedFeesSol, 3)}</b>, varav <b className="mono">{sol(status.unclaimedFeesSol / 2, 3)}</b> är veckans pott. Hämta dem när veckan är avgjord och betala sen ut potten enligt topplistan.
            </p>
            <button className="btn-ghost" disabled={!!busy || !(status.unclaimedFeesSol > 0)} onClick={() => run("claim")}>
              {busy === "claim" ? "Godkänn i Phantom…" : "Hämta avgifter"}
            </button>
          </Panel>
        )}
      </div>
    </main>
  );
}
