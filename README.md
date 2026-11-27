# CALLED

Callers get paid when you do. A launchpad on Raydium LaunchLab where part of the platform fee fills a weekly caller pot, paid by what each caller's followers made, not by the volume a call drags in.

- **Launchpad.** CALLED's own LaunchLab platform: launch, explore, coin pages. Standard LaunchLab curve, 1% platform fee, LP burned at graduation.
- **Callers.** Register with a wallet signature (a message, never a transaction) and an X post carrying a personal code.
- **Calls.** A CA plus the X post, registered within 15 minutes of posting. Time and price are stamped on the spot. Only coins launched on CALLED can be called.
- **Scoring at +24h.** The coin is priced again (live, or the last trade before +24h). Real buyers after the call (first buy, at least 0.05 SOL, not the caller or the creator) are read from the chain. Points = followers' median return × √(buyers ÷ 40), capped at 1. Losses count in full.
- **Sell check.** The caller's registered wallet is watched for the coin during the window. A sale or transfer out flags the call: no points, and a loss still counts.
- **Weekly pot.** 50% of the platform fees in the fee vault, read live. Callers with 3+ settled calls and a positive median are ranked by median points; the top 5 split 35/25/18/12/10%.
- **By hand (and labelled on the site).** Payouts from the treasury, and the multi-wallet review before each payout.

## Built with

- `src/` Vite + React. The hero is a three.js scene (`src/visuals/PrinterScene.tsx`) that prints the week's top call as a receipt.
- `shared/` the curve and the scoring rules, shared by the site and the API.
- `api/` Vercel functions: `config`, `coins`, `launch` (upload, build, register), `tx` (send, status), `setup`, `callers`, `calls`, `board`, `selftest`.
- Storage: Vercel Blob (`callers/`, `handles/`, `calls/`, `launches/`, `img/`, `meta/`).
- A daily cron hits `/api/calls` to settle anything due. Every page load also settles a couple of due calls.

## Environment

| Variable | What |
| --- | --- |
| `RPC_URL` | Helius key or URL (free plan is enough). |
| `BLOB_READ_WRITE_TOKEN` | Set when a Vercel Blob store is connected. |
| `PLATFORM_ADMIN` | Wallet that ran `/setup`. |
| `TREASURY` | Optional. Wallet payouts are sent from (defaults to `PLATFORM_ADMIN`). |
| `TOKEN_CA` | $CALLED contract address, once live. |
| `X_URL` | X profile link. |
| `SITE_URL` | Public site URL, used in token metadata. |

## Checks

- `/api/selftest` simulates two launches on the platform.
- `/api/selftest?setup=<wallet>` simulates the platform setup.
- `/api/selftest?mint=<coin>` dry-runs the scorer on any LaunchLab coin.
- `/api/selftest?post=<x link>` reads an X post the way registration does.
