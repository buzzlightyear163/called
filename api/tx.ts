import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { HttpError, body, connection, handle } from "./_lib/solana";

// POST {tx}: sends a transaction the user's wallet already signed, through our RPC.
// GET ?sig=: whether it confirmed.
export default handle(async (req, res) => {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    const sig = String(req.query.sig || "");
    if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) throw new HttpError(400, "Bad signature");
    const st = await connection().getSignatureStatuses([sig], { searchTransactionHistory: false });
    const s = st.value[0];
    return {
      confirmed: !!s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") && !s.err,
      failed: !!s?.err,
      err: s?.err ?? null,
    };
  }
  const b = body(req);
  if (typeof b.tx !== "string" || b.tx.length > 3000) throw new HttpError(400, "Missing signed transaction");
  const raw = Buffer.from(b.tx, "base64");
  const tx = VersionedTransaction.deserialize(raw);
  const sig = bs58.encode(tx.signatures[0]);
  const conn = connection();
  const sim = await conn.simulateTransaction(tx, { sigVerify: false, commitment: "processed" });
  if (sim.value.err) {
    const logs = (sim.value.logs || []).filter((l) => /Error|error|failed|insufficient/i.test(l)).slice(-4);
    throw new HttpError(400, `The network rejected this transaction: ${JSON.stringify(sim.value.err)} ${logs.join(" | ")}`.slice(0, 380));
  }
  await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 3 });
  return { sig };
});
