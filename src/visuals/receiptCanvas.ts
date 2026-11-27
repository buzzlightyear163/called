import type { Call } from "../lib/api";
import { points, priceSol, ret, short, usd, utc, sol } from "../lib/format";
import { receiptState } from "../components/Receipt";

// Draws a call receipt onto a canvas, for the 3D scene. Same content as the HTML receipt.

export const RC_W = 1100;
const PAD = 70;
const INK = "#16150f";
const MUTE = "#46433b";
const PAPER = "#fbf9f3";
const GAIN = "#0d8a42";
const LOSS = "#d23f2a";
const MARKER = "#d4ff3a";
const MONO = '"Martian Mono Variable", "Martian Mono", ui-monospace, monospace';
const DISPLAY = '"Archivo Variable", "Archivo", system-ui, sans-serif';

export async function loadReceiptFonts() {
  try {
    await Promise.all([
      document.fonts.load(`800 40px ${MONO}`),
      document.fonts.load(`400 40px ${MONO}`),
      document.fonts.load(`900 40px ${DISPLAY}`),
    ]);
  } catch {}
}

function font(ctx: CanvasRenderingContext2D, weight: number, size: number, family: "mono" | "display") {
  ctx.font = `${weight} ${size}px ${family === "mono" ? MONO : DISPLAY}`;
  (ctx as any).fontStretch = family === "mono" ? "semi-condensed" : "extra-condensed";
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
    return ((s ^= s >>> 16) >>> 0) / 4294967296;
  };
}

function mark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const k = s / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(2, 2, 60, 60, 15);
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(17, 11);
  ctx.lineTo(47, 11);
  ctx.lineTo(47, 49);
  for (let i = 0; i < 8; i++) ctx.lineTo(47 - 3.75 * (i + 1), i % 2 === 0 ? 46 : 49);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(22, 18, 16, 3.4);
  ctx.globalAlpha = 0.45;
  ctx.fillRect(22, 25, 10, 3.4);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(44.5, 43.5, 12, 0, Math.PI * 2);
  ctx.fillStyle = MARKER;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(38.6, 43.8);
  ctx.lineTo(42.7, 47.8);
  ctx.lineTo(50.3, 39.4);
  ctx.lineWidth = 3.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

type Layout = { height: number; stampY: number };

// The paper outline: torn zigzag at the top and the bottom.
export function paperPath(ctx: CanvasRenderingContext2D, w: number, h: number, tooth = 22) {
  ctx.beginPath();
  ctx.moveTo(0, tooth);
  for (let x = 0, i = 0; x < w; x += tooth, i++) ctx.lineTo(Math.min(w, x + tooth), i % 2 === 0 ? 0 : tooth);
  ctx.lineTo(w, h - tooth);
  for (let x = w, i = 0; x > 0; x -= tooth, i++) ctx.lineTo(Math.max(0, x - tooth), i % 2 === 0 ? h : h - tooth);
  ctx.closePath();
}

// Draws the receipt. Returns where the stamp sits so it can be animated on top.
export function drawReceipt(ctx: CanvasRenderingContext2D, c: Call, opts: { example: boolean; solUsd: number; stamp: number; height?: number }): Layout {
  const W = RC_W;
  const H = opts.height ?? ctx.canvas.height;
  const st = receiptState(c);
  const r = c.result;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  paperPath(ctx, W, H);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.clip();
  // Faint thermal banding.
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(0,0,0,0.035)");
  g.addColorStop(0.12, "rgba(0,0,0,0)");
  g.addColorStop(0.88, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.035)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const mc = (s: { mcUsd: number | null; mcSol: number | null } | null) =>
    !s ? "–" : s.mcUsd != null ? usd(s.mcUsd) : s.mcSol != null ? (opts.solUsd > 0 ? usd(s.mcSol * opts.solUsd) : sol(s.mcSol, 0)) : "–";
  const toneOf = (v: number | null | undefined) => (v == null ? INK : v >= 0 ? GAIN : LOSS);

  let y = 78;
  const L = PAD;
  const R = W - PAD;
  const text = (t: string, x: number, yy: number, align: CanvasTextAlign = "left", color = INK) => {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(t, x, yy);
  };
  const hr = () => {
    y += 30;
    ctx.save();
    ctx.strokeStyle = "rgba(22,21,15,0.36)";
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 11]);
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(R, y);
    ctx.stroke();
    ctx.restore();
    y += 34;
  };
  const row = (k: string, v: string, color = INK, big = false) => {
    y += big ? 62 : 50;
    font(ctx, big ? 800 : 600, 32, "mono");
    text(k, L, y, "left", big ? INK : MUTE);
    font(ctx, 800, big ? 54 : 32, "mono");
    text(v, R, y, "right", color);
  };
  const sub = (t: string) => {
    y += 36;
    font(ctx, 500, 25, "mono");
    text(t, R, y, "right", "#5e5a4f");
  };

  // Header
  ctx.textBaseline = "alphabetic";
  mark(ctx, L, y - 14, 64);
  font(ctx, 900, 58, "display");
  text("CALLED", L + 82, y + 38);
  font(ctx, 800, 30, "mono");
  text("CALL RECEIPT", R, y + 32, "right");
  y += 92;
  font(ctx, 400, 26, "mono");
  text(`No. ${String(c.seq || 0).padStart(6, "0")}`, L, y, "left", MUTE);
  text(utc(c.at), R, y, "right", MUTE);
  if (opts.example) {
    y += 26;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(L, y, R - L, 50, 6);
    ctx.fill();
    font(ctx, 700, 24, "mono");
    text("EXAMPLE · HOW EVERY CALL IS SCORED", W / 2, y + 34, "center", PAPER);
    y += 50;
  }
  hr();
  y -= 20;
  row("CALLER", `@${c.handle}${c.xVerified ? " ✓" : ""}`);
  row("WALLET", `${short(c.wallet, 4)} · signed`);
  row("COIN", `$${c.symbol} · ${short(c.mint, 4)}`);
  hr();
  y -= 20;
  row("AT THE CALL", mc(c.entry));
  sub(priceSol(c.entry.priceSol));
  if (r) {
    row("+24H", mc(r.price));
    sub(priceSol(r.price.priceSol));
    row("THE CALL", ret(r.callReturn), toneOf(r.callReturn));
  } else {
    const live = c.live?.priceSol && c.entry.priceSol ? c.live.priceSol / c.entry.priceSol - 1 : null;
    row("NOW", mc(c.live));
    row("SO FAR", ret(live), toneOf(live));
  }
  hr();
  y -= 20;
  if (r) {
    row("REAL BUYERS AFTER", `${r.buyers}${r.buyersExact ? "" : "+"}`);
    row("FOLLOWERS MADE", ret(r.followerMedian), toneOf(r.followerMedian), true);
    sub("median of buyers after the call, at +24h");
  } else {
    row("FOLLOWERS MADE", "AT +24H");
  }
  row("CALLER SOLD IN WINDOW", st === "dump" ? "YES" : "NO", st === "dump" ? LOSS : INK);
  hr();
  y += 64;
  font(ctx, 800, 34, "mono");
  text("POINTS", L, y - 8, "left");
  font(ctx, 900, 150, "display");
  text(r ? points(r.points) : "OPEN", R, y + 24, "right", st === "dump" ? LOSS : r ? toneOf(r.points) : INK);
  y += 70;
  const stampY = y + 40;

  // Barcode and caption on the right, the stamp lands on the left.
  const rand = rng(hash(c.id));
  let bx = R - 470;
  ctx.fillStyle = INK;
  while (bx < R) {
    const w = 3 + Math.floor(rand() * 4) * 3;
    if (bx + w > R) break;
    ctx.fillRect(bx, y + 20, w, 86);
    bx += w + 3 + Math.floor(rand() * 3) * 3;
  }
  font(ctx, 400, 23, "mono");
  text(opts.example ? "CALLEDPOT · EXAMPLE" : `${c.week} · ${c.id.slice(0, 10)}`.toUpperCase(), R, y + 146, "right", "#5e5a4f");

  if (opts.stamp > 0) drawStamp(ctx, c, st, L + 230, stampY, opts.stamp);
  ctx.restore();
  return { height: y + 200, stampY };
}

function drawStamp(ctx: CanvasRenderingContext2D, c: Call, st: ReturnType<typeof receiptState>, cx: number, cy: number, t: number) {
  const r = c.result;
  const label =
    st === "up"
      ? ["FOLLOWERS UP", "PAID FROM THE POT"]
      : st === "down"
        ? ["FOLLOWERS DOWN", "NO PAY"]
        : st === "dump"
          ? ["SOLD INTO OWN CALL", r && r.points < -0.05 ? "NO PAY · LOSS COUNTS" : "0 POINTS"]
          : ["OPEN", "24H WINDOW"];
  const color = st === "up" ? GAIN : st === "dump" ? LOSS : "#4d4a40";
  const e = 1 - Math.pow(1 - Math.min(1, t), 3);
  const scale = 1.55 - 0.55 * e;
  // Draw the stamp on its own canvas, then knock out ink speckles so it looks pressed.
  const s = document.createElement("canvas");
  s.width = 560;
  s.height = 220;
  const x = s.getContext("2d")!;
  x.strokeStyle = color;
  x.fillStyle = color;
  x.lineWidth = 9;
  x.beginPath();
  x.roundRect(14, 14, 532, 192, 20);
  x.stroke();
  x.lineWidth = 3.5;
  x.beginPath();
  x.roundRect(28, 28, 504, 164, 12);
  x.stroke();
  font(x, 900, st === "dump" ? 60 : 72, "display");
  x.textAlign = "center";
  x.fillText(label[0], 280, 118);
  font(x, 800, 25, "mono");
  x.fillText(label[1], 280, 164);
  x.globalCompositeOperation = "destination-out";
  const rand = rng(hash(c.id + "stamp"));
  for (let i = 0; i < 900; i++) {
    x.globalAlpha = 0.25 + rand() * 0.75;
    x.beginPath();
    x.arc(rand() * 560, rand() * 220, 0.6 + rand() * 2.6, 0, Math.PI * 2);
    x.fill();
  }
  ctx.save();
  ctx.globalAlpha = 0.9 * e;
  ctx.translate(cx, cy);
  ctx.rotate(-0.19);
  ctx.scale(scale * 0.86, scale * 0.86);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(s, -280, -110);
  ctx.restore();
}

// The receipt outline only (white on black), for the back of the paper.
export function drawShape(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  paperPath(ctx, w, h);
  ctx.fillStyle = "#fff";
  ctx.fill();
}
