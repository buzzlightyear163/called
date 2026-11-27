import { randomUUID } from "crypto";
import { ComputeBudgetProgram, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { LAUNCHPAD_PROGRAM, TxVersion, getMainLookupTableCache, getPdaLaunchpadPoolId } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import { CURVE, MAX_DEV_BUY_SOL } from "../shared/curve";
import { HttpError, SITE_URL, SOL_CONFIG, activePlatform, body, connection, getConfigInfo, handle, pk, raydiumFor, txToBase64 } from "./_lib/solana";
import { putFile } from "./_lib/store";
import { loadCoins } from "./_lib/coins";

// POST {action:"upload"}   stores the coin image and token metadata, returns the metadata URI.
// POST {action:"build"}    builds the launch on CALLED's platform: coin, pool and optional dev buy in one transaction.
// POST {action:"register"} lists a launch once it is on chain on CALLED's platform.

const PRIORITY_MICROLAMPORTS = Number(process.env.PRIORITY_MICROLAMPORTS || 30_000);
const CU_LIMIT = 500_000;
const TYPES: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

function cleanUrl(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (!/^https:\/\/[^\s]{3,200}$/.test(s)) throw new HttpError(400, "Links have to start with https://");
  return s;
}

async function upload(b: Record<string, any>) {
  const name = String(b.name ?? "").trim().slice(0, 32);
  const symbol = String(b.symbol ?? "").trim().replace(/^\$/, "").toUpperCase().slice(0, 10);
  const description = String(b.description ?? "").trim().slice(0, 600);
  if (!name || !symbol) throw new HttpError(400, "Add a name and a ticker first.");
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image ?? ""));
  if (!m) throw new HttpError(400, "Add an image (PNG, JPG, WEBP or GIF).");
  const img = Buffer.from(m[2], "base64");
  if (img.length > 1_500_000) throw new HttpError(400, "Image has to be under 1.5 MB.");
  const website = cleanUrl(b.website);
  const twitter = cleanUrl(b.twitter);
  const telegram = cleanUrl(b.telegram);
  const id = randomUUID();
  const ext = m[1] === "jpg" ? "jpeg" : m[1];
  const image = await putFile(`img/${id}.${ext}`, img, TYPES[ext]);
  const meta = {
    name,
    symbol,
    description,
    image,
    showName: true,
    createdOn: SITE_URL,
    ...(website ? { website } : {}),
    ...(twitter ? { twitter } : {}),
    ...(telegram ? { telegram } : {}),
  };
  const uri = await putFile(`meta/${id}.json`, JSON.stringify(meta), "application/json");
  return { uri, image };
}

export function validateLaunch(b: Record<string, any>) {
  const name = String(b.name ?? "").trim();
  const symbol = String(b.symbol ?? "").trim().replace(/^\$/, "").toUpperCase();
  const uri = String(b.uri ?? "").trim();
  if (!name || name.length > 32) throw new HttpError(400, "Name has to be 1 to 32 characters.");
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) throw new HttpError(400, "Ticker has to be 1 to 10 letters or digits.");
  if (!/^https:\/\//.test(uri) || uri.length > 200) throw new HttpError(400, "Upload the coin image first.");
  const devBuySol = Math.max(0, Number(b.devBuySol || 0));
  if (!(devBuySol <= MAX_DEV_BUY_SOL)) throw new HttpError(400, `The dev buy can be at most ${MAX_DEV_BUY_SOL} SOL (10% of supply).`);
  return { name, symbol, uri, devBuySol };
}

export async function buildLaunch(b: Record<string, any>, opts: { mint?: Keypair } = {}) {
  const owner = pk(b.owner, "owner");
  const v = validateLaunch(b);
  const conn = connection();
  const [platform, configInfo, raydium] = await Promise.all([activePlatform(), getConfigInfo(), raydiumFor(owner)]);
  if (process.env.PLATFORM_ADMIN && !platform.own) throw new HttpError(503, "CALLED's platform is not live yet. Try again shortly.");

  const mint = opts.mint ?? Keypair.generate();
  const { publicKey: poolId } = getPdaLaunchpadPoolId(LAUNCHPAD_PROGRAM, mint.publicKey, NATIVE_MINT);
  const c = CURVE.raw;

  const res = await raydium.launchpad.createLaunchpad({
    programId: LAUNCHPAD_PROGRAM,
    mintA: mint.publicKey,
    name: v.name,
    symbol: v.symbol,
    uri: v.uri,
    decimals: 6,
    migrateType: "cpmm",
    configId: SOL_CONFIG,
    configInfo,
    platformId: new PublicKey(platform.id),
    txVersion: TxVersion.V0,
    slippage: new BN(300),
    buyAmount: new BN(Math.floor(v.devBuySol * 1e9)),
    createOnly: v.devBuySol <= 0,
    extraSigners: [mint],
    supply: new BN(c.supply),
    totalSellA: new BN(c.totalSellA),
    totalFundRaisingB: new BN(c.totalFundRaisingB),
    totalLockedAmount: new BN(0),
    cliffPeriod: new BN(0),
    unlockPeriod: new BN(0),
  });

  const sdkIx: TransactionInstruction[] = res.builder.allInstructions.filter((ix) => !ix.programId.equals(ComputeBudgetProgram.programId));
  const instructions = [ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }), ...sdkIx];
  const [luts, { blockhash, lastValidBlockHeight }] = await Promise.all([getMainLookupTableCache(conn), conn.getLatestBlockhash("confirmed")]);
  const msg = new TransactionMessage({ payerKey: owner, recentBlockhash: blockhash, instructions }).compileToV0Message(Object.values(luts));
  const tx = new VersionedTransaction(msg);
  tx.sign([mint]);
  const size = tx.serialize().length;
  if (size > 1232) throw new Error(`Launch transaction is too large (${size} bytes). Set the dev buy to 0 and try again.`);
  return { tx, mint: mint.publicKey.toBase58(), poolId: poolId.toBase58(), platformId: platform.id, lastValidBlockHeight };
}

async function register(b: Record<string, any>) {
  const mint = pk(b.mint, "mint").toBase58();
  let row = null;
  for (let i = 0; i < 4 && !row; i++) {
    [row] = await loadCoins([mint], { meta: false });
    if (!row) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!row) throw new HttpError(404, "The launch is not on chain yet. Try again in a few seconds.");
  if (!row.isCalled) throw new HttpError(400, "This coin was not launched on CALLED's platform.");
  await putFile(`launches/${mint}.json`, JSON.stringify({ mint, at: Date.now() }), "application/json");
  return { ok: true, mint };
}

export default handle(async (req) => {
  const b = body(req);
  if (b.action === "upload") return upload(b);
  if (b.action === "register") return register(b);
  if (b.action === "build") {
    const out = await buildLaunch(b);
    return { tx: txToBase64(out.tx), mint: out.mint, poolId: out.poolId, platformId: out.platformId, lastValidBlockHeight: out.lastValidBlockHeight };
  }
  throw new HttpError(400, "Unknown action");
});
