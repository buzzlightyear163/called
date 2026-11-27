import { Link } from "react-router-dom";
import { Eyebrow } from "../components/Bits";
import { useSite } from "../lib/site";
import { pct, sol, usd } from "../lib/format";
import { CURVE, ECON, MAX_DEV_BUY_SOL } from "../../shared/curve";
import { CALLS } from "../../shared/calls";

const TOC = [
  ["overview", "How it works"],
  ["launch", "Launching a coin"],
  ["register", "Registering as a caller"],
  ["call", "Making a call"],
  ["score", "How a call is scored"],
  ["sells", "Selling into your own call"],
  ["pot", "The weekly pot"],
  ["by-hand", "What runs by hand"],
  ["data", "Where the data comes from"],
  ["faq", "FAQ"],
];

const FAQ: [string, string][] = [
  [
    "Why not pay on volume like pump.fun?",
    "Volume is easiest to pull on the smallest caps, and it says nothing about whether the people who bought made money. CALLED only pays when the median buyer after a call is up 24 hours later.",
  ],
  [
    "Can I use a different wallet to dump?",
    "The scorer watches the wallet you registered. Side wallets are the one thing it can't see on its own, which is why the top callers are reviewed by hand for side wallets before every payout.",
  ],
  [
    "What if my X post can't be read?",
    "Calls still count when X's embed can't be reached. The receipt shows that the post wasn't checked, and the check on your registration post runs again on its own.",
  ],
  [
    "Does CALLED ever ask for my private key?",
    "No. Registering and calling only ask your wallet to sign a plain-text message. It can't move funds. Launching a coin is a normal transaction you approve in your wallet.",
  ],
  [
    "Who shows up on the leaderboard?",
    "Only callers who registered themselves with a wallet signature and an X post. Nobody is ranked, tracked or named who didn't sign up.",
  ],
];

export default function Docs() {
  const { solUsd } = useSite();
  const money = (s: number) => (solUsd > 0 ? `${sol(s, 0)} (${usd(s * solUsd)})` : sol(s, 0));
  return (
    <main className="page">
      <div className="wrap docs">
        <aside className="toc">
          <span className="kicker">Docs</span>
          {TOC.map(([id, t]) => (
            <a key={id} href={`#${id}`}>
              {t}
            </a>
          ))}
        </aside>
        <article className="doc">
          <Eyebrow>Docs</Eyebrow>
          <h1 className="h-page">
            Callers get paid when <mark>you</mark> do.
          </h1>

          <section id="overview">
            <h2>How it works</h2>
            <p>
              CALLED is a launchpad on Raydium LaunchLab. Every trade on a coin launched here pays a {pct(ECON.platformFee, 0)} platform fee, and{" "}
              {pct(ECON.potShare, 0)} of that fee is the caller pot.
            </p>
            <p>
              Callers register with their X account and the wallet they trade from. When they call a coin launched here, the call is stamped with the time and the
              price. {CALLS.windowHours} hours later it is scored on what the real buyers after the call made. Every week the pot goes to the callers whose followers
              did best.
            </p>
          </section>

          <section id="launch">
            <h2>Launching a coin</h2>
            <ul>
              <li>
                The standard LaunchLab curve: opens at {money(CURVE.openMcSol)}, raises {sol(CURVE.raiseSol, 0)} and graduates at {money(CURVE.gradMcSol)}.
              </li>
              <li>
                Trade fee on the curve: {pct(ECON.tradeFee, 2)}. That is {pct(ECON.protocolFee, 2)} to Raydium LaunchLab and {pct(ECON.platformFee, 0)} to CALLED,
                of which half is the pot.
              </li>
              <li>At graduation the coin moves to a Raydium CPMM pool and the LP is burned.</li>
              <li>An optional dev buy in the same transaction, up to {MAX_DEV_BUY_SOL} SOL (10% of supply).</li>
            </ul>
            <p>
              <Link to="/launch">Launch a coin →</Link>
            </p>
          </section>

          <section id="register">
            <h2>Registering as a caller</h2>
            <ol>
              <li>Connect the wallet you trade from.</li>
              <li>Post your personal code (CALLED-XXXXXX) from your X account.</li>
              <li>Paste the link to that post and sign one message with your wallet.</li>
            </ol>
            <p>The signature proves the wallet is yours. It is not a transaction and it moves nothing. One X account per wallet.</p>
          </section>

          <section id="call">
            <h2>Making a call</h2>
            <ul>
              <li>Only coins launched on CALLED can be called. Their fees are what fill the pot.</li>
              <li>Post the call on X first. It has to mention the $TICKER or the CA.</li>
              <li>Register it here within {CALLS.maxPostAgeMin} minutes of posting. The post's own timestamp is read from its link.</li>
              <li>
                One call per coin per caller, and {CALLS.perDay} calls in any {CALLS.windowHours} hours.
              </li>
              <li>The price is stamped the moment the call is registered: from the LaunchLab pool on chain, or DexScreener once the coin has graduated.</li>
            </ul>
          </section>

          <section id="score">
            <h2>How a call is scored</h2>
            <p>{CALLS.windowHours} hours after the call:</p>
            <ol>
              <li>
                <b>The coin is priced again.</b> If the receipt settles within {CALLS.liveSettleMin} minutes of the mark, the live price is used. Later than that, the
                last trade before +{CALLS.windowHours}h is used.
              </li>
              <li>
                <b>Real buyers are found.</b> Every wallet whose first buy of the coin came after the call, for at least {CALLS.minBuySol} SOL, read from the chain. The
                caller's own wallet and the coin's creator don't count. On very busy coins up to {CALLS.sampleTx} trades are read, spread over the window.
              </li>
              <li>
                <b>Each buyer's result</b> is what their buy was worth at +{CALLS.windowHours}h against what they paid. The median of those is the followers' median.
              </li>
              <li>
                <b>Points</b> = followers' median × buyer weight × 100. The buyer weight is √(buyers ÷ {CALLS.buyersFull}), capped at 1.
              </li>
            </ol>
            <div className="callout mono">
              10 buyers, followers up 40% → 40 × 0.5 = +20 points
              <br />
              {CALLS.buyersFull} buyers, followers up 40% → +40 points
              <br />
              any buyers, followers down 30% → −30 points
            </div>
            <p>A loss always counts in full. A gain needs real buyers behind it.</p>
          </section>

          <section id="sells">
            <h2>Selling into your own call</h2>
            <p>
              From the moment a call is stamped until it settles, the caller's registered wallet is checked for this coin. If its balance goes down, by a sale or a
              transfer out, the receipt is stamped “Sold into own call”.
            </p>
            <ul>
              <li>A flagged call earns no points.</li>
              <li>If the call was losing anyway, the loss still counts. Selling a bad call doesn't clean it up.</li>
              <li>The transaction is linked on the receipt.</li>
            </ul>
          </section>

          <section id="pot">
            <h2>The weekly pot</h2>
            <ul>
              <li>
                Size: {pct(ECON.potShare, 0)} of the platform fees waiting in CALLED's LaunchLab fee vault, read live. The vault is claimed when the week is paid, so
                what sits in it is that week's fees.
              </li>
              <li>Weeks run Monday 00:00 UTC to Monday 00:00 UTC. A call belongs to the week it was made in.</li>
              <li>
                To be ranked, a caller needs {CALLS.minCallsToQualify} or more settled calls in the week and a positive median. Ranking is by the median points of the
                caller's calls, then hit rate.
              </li>
              <li>
                Split: {CALLS.split.map((x, i) => `#${i + 1} ${Math.round(x * 100)}%`).join(", ")}. A share with nobody to take it rolls into the next week.
              </li>
            </ul>
          </section>

          <section id="by-hand">
            <h2>What runs by hand</h2>
            <p>Everything that touches the chain on its own is live. Two things are done by hand, and the site says so wherever they come up:</p>
            <ul>
              <li>
                <b>Payouts.</b> After a week settles, the pot is claimed from the vault and sent from the treasury to the top callers by hand. Each payout is listed
                with its transaction on the <Link to="/callers#payouts">leaderboard</Link>.
              </li>
              <li>
                <b>The multi-wallet check.</b> The scorer only sees the wallet a caller registered. Before each payout the top callers are reviewed by hand for side
                wallets that buy and dump alongside their calls.
              </li>
            </ul>
          </section>

          <section id="data">
            <h2>Where the data comes from</h2>
            <ul>
              <li>Pool state and every trade: the Solana chain, through a Helius RPC.</li>
              <li>Names and images: Raydium's LaunchLab index.</li>
              <li>Prices after graduation: DexScreener.</li>
              <li>Who posted a call and what it says: X's public embed for that post.</li>
            </ul>
            <p>Market data is third-party and provided as-is. Nothing here is financial advice.</p>
          </section>

          <section id="faq">
            <h2>FAQ</h2>
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        </article>
      </div>
    </main>
  );
}
