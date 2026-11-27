import { ComputeBudgetProgram, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { LAUNCHPAD_PROGRAM, claimPlatformFeeFromVault, createPlatformConfig, getPdaPlatformFeeVaultAuth, getPdaPlatformId } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { VercelRequest } from "@vercel/node";
import { ECON } from "../shared/curve";
import { CPMM_CONFIG, HttpError, SITE_URL, connection, handle, pk, platformVaultFor, txToBase64 } from "./_lib/solana";

// SOL a wallet should hold before setup: account deposits plus network fees, with margin.
export const SETUP_MIN_SOL = 0.03;

export async function setupStatus(admin: PublicKey) {
  const platformId = getPdaPlatformId(LAUNCHPAD_PROGRAM, admin).publicKey;
  const vault = platformVaultFor(platformId);
  const conn = connection();
  const [pAcc, vAcc] = await conn.getMultipleAccountsInfo([platformId, vault]);
  const balance = await conn.getBalance(admin).catch(() => null);
  let fees = 0;
  if (vAcc) {
    try {
      fees = (await conn.getTokenAccountBalance(vault)).value.uiAmount || 0;
    } catch {}
  }
  const expected = (process.env.PLATFORM_ADMIN || "").trim();
  return {
    wallet: admin.toBase58(),
    isExpectedWallet: !expected || expected === admin.toBase58(),
    expectedWallet: expected || null,
    balanceSol: balance == null ? null : balance / 1e9,
    minSol: SETUP_MIN_SOL,
    platformId: platformId.toBase58(),
    platformExists: !!pAcc,
    done: !!pAcc,
    unclaimedFeesSol: fees,
  };
}

function platformIx(admin: PublicKey, platformId: PublicKey, b: Record<string, any>) {
  const feeRate = Math.round(Number(b.feeRate ?? ECON.platformFee) * 1e6);
  if (!(feeRate >= 0 && feeRate <= 10_000)) throw new HttpError(400, "Platform fee has to be between 0% and 1%.");
  return createPlatformConfig(
    LAUNCHPAD_PROGRAM,
    admin,
    admin,
    admin,
    admin,
    platformId,
    CPMM_CONFIG,
    admin,
    { platformScale: new BN(0), creatorScale: new BN(0), burnScale: new BN(1_000_000) },
    new BN(feeRate),
    new BN(0),
    "CALLED",
    String(b.web || SITE_URL).slice(0, 80),
    String(b.img || `${SITE_URL}/mark-512.png`).slice(0, 120),
    new BN(0),
  );
}

export async function buildSetupTx(admin: PublicKey, step: string, b: Record<string, any> = {}, opts: { skipBalance?: boolean } = {}) {
  const st = await setupStatus(admin);
  const platformId = new PublicKey(st.platformId);
  const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 30_000 })];

  if (step === "all") {
    // The platform, in one approval: 1% platform fee to this wallet, LP burned at graduation.
    if (st.done) throw new HttpError(400, "CALLED's platform is already set up for this wallet.");
    if (!opts.skipBalance && st.balanceSol != null && st.balanceSol < SETUP_MIN_SOL)
      throw new HttpError(400, `This wallet has ${st.balanceSol.toFixed(3)} SOL. Send at least ${SETUP_MIN_SOL} SOL to it first.`);
    ixs.push(platformIx(admin, platformId, b));
  } else if (step === "claim") {
    if (!st.platformExists) throw new HttpError(400, "Set up the platform first.");
    if (!(st.unclaimedFeesSol > 0)) throw new HttpError(400, "No fees yet.");
    const ata = getAssociatedTokenAddressSync(NATIVE_MINT, admin);
    ixs.push(createAssociatedTokenAccountIdempotentInstruction(admin, ata, admin, NATIVE_MINT));
    ixs.push(
      claimPlatformFeeFromVault(
        LAUNCHPAD_PROGRAM,
        platformId,
        admin,
        getPdaPlatformFeeVaultAuth(LAUNCHPAD_PROGRAM).publicKey,
        platformVaultFor(platformId),
        ata,
        NATIVE_MINT,
        TOKEN_PROGRAM_ID,
      ),
    );
    ixs.push(createCloseAccountInstruction(ata, admin, admin));
  } else {
    throw new HttpError(400, "Unknown step");
  }

  const { blockhash, lastValidBlockHeight } = await connection().getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: admin, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
  const size = tx.serialize().length;
  if (size > 1232) throw new Error(`Setup transaction is too large (${size} bytes).`);
  return { tx, lastValidBlockHeight, platformId: st.platformId, bytes: size, status: st };
}

function input(req: VercelRequest): Record<string, any> {
  if (req.method === "GET") return { ...req.query, step: "status" };
  const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!b || typeof b !== "object") throw new HttpError(400, "Missing body");
  return b;
}

// GET ?owner=… or POST {step:"status"}: what exists for this wallet.
// POST {step:"all"}: one transaction that creates CALLED's LaunchLab platform.
// POST {step:"claim"}: moves the platform fees from LaunchLab's fee vault to the wallet as SOL.
export default handle(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const b = input(req);
  const admin = pk(b.owner, "owner");
  if (b.step === "status") return setupStatus(admin);
  const out = await buildSetupTx(admin, String(b.step), b);
  return { tx: txToBase64(out.tx), lastValidBlockHeight: out.lastValidBlockHeight, platformId: out.platformId };
});
