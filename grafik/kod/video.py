"""CALLED launch video, pixel style. 320x180 grid, scaled 6x to 1920x1080, 30 fps."""
import subprocess, random
import numpy as np
from PIL import Image
from pix import *

W, H, K, FPS = 320, 180, 6, 30
DUR = 19.6
f8, f8b, ps = silk(8), silk(8, bold=True), press(8)
BAY = np.array(BAYER)

def layer2x(s, font, color, hl=None):
    """Text drawn at 1x, then doubled: big pixel type."""
    w = text_w(font, s) + 4
    lay = Image.new("RGBA", (w, 14), (0, 0, 0, 0))
    d = draw(lay)
    if hl:
        d.rectangle((0, 2, w - 3, 11), fill=hl)
    d.text((1, 0), s, font=font, fill=color)
    return lay.resize((lay.width * 2, lay.height * 2), Image.NEAREST)

def paste_center(im, lay, cy):
    im.paste(lay, ((W - lay.width) // 2, cy), lay)

def bg_desk():
    im = Image.new("RGB", (W, H), BG)
    glow(im, 160, 80, 150, BG2, 1.0)
    glow(im, 160, 80, 85, BG3, 0.8)
    return im

DESK = bg_desk()
def bg_right():
    im = Image.new("RGB", (W, H), BG)
    glow(im, 242, 80, 140, BG2, 1.0)
    glow(im, 242, 80, 80, BG3, 0.8)
    return im
DESK_R = bg_right()
DARK = Image.new("RGB", (W, H), BG)

# ——— Receipts ———
RW, RH = 112, 140

def receipt(rows, points, pcolor):
    im = Image.new("RGBA", (RW, RH), (0, 0, 0, 0))
    d = draw(im)
    d.rectangle((0, 0, RW - 1, RH - 1), fill=PAPER)
    d.line((RW - 1, 0, RW - 1, RH - 1), fill=PAPER_SH)
    px = im.load()
    for i in range(RW):  # zigzag top and bottom
        k = i % 4
        cut = 2 - (k if k <= 2 else 4 - k)
        for j in range(cut):
            px[i, j] = (0, 0, 0, 0)
            px[i, RH - 1 - j] = (0, 0, 0, 0)
    d.rectangle((5, 6, 9, 10), fill=INK)
    d.text((12, 2), "CALLED", font=f8b, fill=INK)
    d.text((RW - 5, 2), "RECEIPT", font=f8, fill=INK, anchor="ra")
    d.text((5, 12), "#000412", font=f8, fill=MUTE)
    d.text((RW - 5, 12), "EXAMPLE", font=f8, fill=MUTE, anchor="ra")
    def dash(y):
        for x in range(5, RW - 5, 2):
            d.point((x, y), fill=MUTE)
    y = 23
    dash(y)
    y += 2
    for item in rows:
        if item == "-":
            y += 3
            dash(y)
            y += 2
            continue
        k, v, c = item
        d.text((5, y), k, font=f8, fill=MUTE)
        d.text((RW - 5, y), v, font=f8b if c != INK else f8, fill=c, anchor="ra")
        y += 9
    y += 3
    dash(y)
    y += 4
    d.text((5, y + 1), "POINTS", font=f8b, fill=INK)
    wnum = sum(((3 + 1) * 2 if ch != "." else 2 * 2 + 1) for ch in points)
    tiny(im, RW - 5 - wnum, y + 4, points, pcolor + (255,), scale=2, gap=1)
    return im, y + 16  # where the stamp zone starts

UP, UP_Z = receipt(
    [("CALLER", "@YOU", INK), "-",
     ("AT THE CALL", "$41.2K", INK), ("+24H", "$98.0K", INK), ("REAL BUYERS", "63", INK),
     ("FOLLOWERS", "+88.4%", GAIN), ("SOLD?", "NO", INK)],
    "+88.4", GAIN)
DUMP, DUMP_Z = receipt(
    [("CALLER", "@CALLER", INK), "-",
     ("AT THE CALL", "$18.0K", INK), ("+24H", "$25.6K", INK), ("REAL BUYERS", "31", INK),
     ("FOLLOWERS", "+11.8%", GAIN), ("SOLD?", "YES", LOSS)],
    "0.0", LOSS)

def stamp(lines, color, seed=1):
    w = max(text_w(f8b, s) for s in lines) + 14
    h = 7 + 9 * len(lines)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = draw(im)
    c = color + (255,)
    d.rectangle((0, 0, w - 1, h - 1), outline=c)
    d.rectangle((1, 1, w - 2, h - 2), outline=c)
    d.rectangle((3, 3, w - 4, h - 4), outline=c)
    y = 1
    for i, s in enumerate(lines):
        d.text((w // 2, y), s, font=f8b, fill=c, anchor="ma")
        y += 9
    r = random.Random(seed)
    px = im.load()
    for _ in range(int(w * h * 0.12)):
        x, yy = r.randrange(w), r.randrange(h)
        px[x, yy] = (0, 0, 0, 0)
    return im

ST_UP = stamp(["FOLLOWERS UP", "PAID FROM POT"], GAIN, 2)
ST_DUMP = stamp(["SOLD INTO", "OWN CALL", "0 POINTS"], LOSS, 5)

def put_stamp(im, st, rx, ry, zone, k):
    s = st if k >= 1 else st.resize((max(1, int(st.width * k)), max(1, int(st.height * k))), Image.NEAREST)
    cx = rx + RW // 2 - 4
    cy = ry + zone + (RH - zone) // 2 - 1
    im.paste(s, (cx - s.width // 2, cy - s.height // 2), s)

# ——— Printer ———
PX = 180
def printer(im, led_on=True):
    d = draw(im)
    x0, x1, y0, y1 = PX, PX + 124, 140, 168
    # shadow
    for y in range(y1 - 2, y1 + 5):
        for x in range(x0 - 4, x1 + 8):
            if (x + y) % 2 == 0:
                im.putpixel((x, y), SHADOW)
    d.rectangle((x0, y0, x1, y1), fill=BODY)
    d.rectangle((x0 + 1, y0, x1 - 1, y0 + 3), fill=BODY_HI)
    d.line((x0, y1, x1, y1), fill=BODY_LO)
    d.line((x0, y0 + 1, x0, y1 - 1), fill=BODY_LO)
    d.rectangle((x0, y0, x0, y0), fill=BG)
    d.rectangle((x1, y0, x1, y0), fill=BG)
    # slot and tear bar
    d.rectangle((x0 + 4, y0 + 1, x1 - 4, y0 + 2), fill=SHADOW)
    d.line((x0 + 2, y0 - 1, x1 - 2, y0 - 1), fill=METAL)
    # front label
    d.text((x0 + 8, 151), "CALLED", font=ps, fill=PAPER)
    d.text((x0 + 60, 152), "RECEIPTS", font=f8, fill=MUTE)
    # button and led
    d.ellipse((x1 - 26, 152, x1 - 20, 158), fill=BODY_HI)
    if led_on:
        d.rectangle((x1 - 14, 153, x1 - 11, 156), fill=LIME)
        for (x, y) in [(x1 - 15, 154), (x1 - 10, 155), (x1 - 13, 152), (x1 - 12, 157)]:
            im.putpixel((x, y), LIME_SH)
    else:
        d.rectangle((x1 - 14, 153, x1 - 11, 156), fill=(80, 96, 30))
    # feet
    d.rectangle((x0 + 6, y1 + 1, x0 + 14, y1 + 2), fill=SHADOW)
    d.rectangle((x1 - 14, y1 + 1, x1 - 6, y1 + 2), fill=SHADOW)

SLOT_Y = 141
RX = PX + 62 - RW // 2

def frame_desk(t, fed, stamp_k=None, led=True, shake=0):
    im = DESK_R.copy()
    if fed > 0:
        top = SLOT_Y - fed
        part = UP.crop((0, 0, RW, min(fed, UP.height)))
        # shadow of the paper
        sh = Image.new("RGBA", part.size, SHADOW + (255,))
        im.paste(sh, (RX + 2, top + 2), part)
        im.paste(part, (RX, top), part)
        if stamp_k is not None:
            put_stamp(im, ST_UP, RX, top, UP_Z, stamp_k)
    printer(im, led)
    if shake:
        im = Image.fromarray(np.roll(np.array(im), shake, axis=0))
    return im

# ——— Scenes ———
def caption(im, s, color=LIME, y=10, chars=None):
    s2 = s if chars is None else s[:chars]
    if not s2:
        return
    lay = layer2x(s2, f8b, color)
    full = layer2x(s, f8b, color)
    im.paste(lay, ((W - full.width) // 2, y), lay)

def side_lines(im, lines, t, x=16, y=40, cps=40, color=PAPER, hl_last=True):
    """Big type on the left, typed out line by line."""
    n = int(t * cps)
    for i, s in enumerate(lines):
        k = min(len(s), max(0, n))
        n -= len(s)
        if k <= 0:
            break
        c = LIME if (hl_last and i == len(lines) - 1) else color
        lay = layer2x(s[:k], f8b, c)
        im.paste(lay, (x, y + i * 24), lay)

HOOK = [("PUMP.FUN PAID CALLERS", PAPER), ("$29.6M SINCE AUGUST.", PAPER), ("MEDIAN PAYOUT: $13.", PAPER), ("ALL OF IT ON VOLUME.", LOSS)]

def scene_hook(t):
    im = DARK.copy()
    d = draw(im)
    cps = 38
    y = 30
    elapsed = t - 0.2
    shown_total = 0
    for i, (s, c) in enumerate(HOOK):
        start = sum(len(x[0]) for x in HOOK[:i]) / cps + i * 0.35
        n = int(max(0, (elapsed - start) * cps))
        n = min(n, len(s))
        if n > 0:
            lay = layer2x(s[:n], f8b, c)
            im.paste(lay, (22, y), lay)
            shown_total += n
            if n < len(s) or (i == len(HOOK) - 1):
                cx = 22 + text_w(f8b, s[:n]) * 2 + 6
                if n < len(s) or int(t * 3) % 2 == 0:
                    d.rectangle((cx, y + 4, cx + 7, y + 21), fill=LIME)
        y += 26
    if t > 2.6:
        d.text((24, 156), "SOURCE: SPARSITY, NOV 2026", font=f8, fill=MUTE)
    return im

def scene_print(t):
    # t from 0
    feed_start, feed_dur = 0.5, 3.4
    p = min(1, max(0, (t - feed_start) / feed_dur))
    fed = int(UP.height * p) // 3 * 3
    led = p >= 1 or int(t * 8) % 2 == 0
    st = None
    shake = 0
    ts = t - (feed_start + feed_dur + 0.35)
    if ts >= 0:
        st = 1 if ts >= 0.13 else 2.2 - ts / 0.13 * 1.2
        if 0.13 <= ts < 0.25:
            shake = 2 if int(ts * 60) % 2 == 0 else -2
    im = frame_desk(t, fed, st, led, shake)
    if t < 3.2:
        side_lines(im, ["EVERY CALL", "GETS A", "RECEIPT."], t, y=50)
    else:
        side_lines(im, ["SCORED ON", "WHAT", "FOLLOWERS", "MADE AT", "+24H."], t - 3.2, y=34)
    return im

def scene_two(t):
    im = DESK.copy()
    lx, rx, y = 38, 170, 36
    for (r, x) in [(UP, lx), (DUMP, rx)]:
        sh = Image.new("RGBA", r.size, SHADOW + (255,))
        im.paste(sh, (x + 2, y + 2), r)
        im.paste(r, (x, y), r)
    put_stamp(im, ST_UP, lx, y, UP_Z, 1)
    ts = t - 0.9
    if ts >= 0:
        k = 1 if ts >= 0.13 else 2.2 - ts / 0.13 * 1.2
        put_stamp(im, ST_DUMP, rx, y, DUMP_Z, k)
        if 0.13 <= ts < 0.25:
            im = Image.fromarray(np.roll(np.array(im), 2 if int(ts * 60) % 2 == 0 else -2, axis=1))
    caption(im, "SELL INTO YOUR CALL: ZERO", LIME, 6, chars=int(t * 40))
    return im

def scene_pot(t):
    im = DESK.copy()
    d = draw(im)
    px0, py0, px1, py1 = 100, 46, 220, 160
    d.rectangle((px0 + 3, py0 + 3, px1 + 3, py1 + 3), fill=SHADOW)
    d.rectangle((px0, py0, px1, py1), fill=BG2, outline=BODY_HI)
    d.rectangle((px0, py0, px1, py0 + 14), fill=LIME)
    d.text((px0 + 6, py0 + 2), "WEEKLY CALLER POT", font=f8b, fill=INK)
    for i, pct in enumerate([35, 25, 18, 12, 10]):
        yy = py0 + 22 + i * 17
        grow = min(1, max(0, (t - 0.3 - i * 0.12) / 0.6))
        d.rectangle((px0 + 6, yy, px0 + 16, yy + 10), fill=LIME if i == 0 else BG3)
        d.text((px0 + 9, yy - 1), str(i + 1), font=f8b, fill=INK if i == 0 else PAPER)
        bw = round(62 * pct / 35 * grow)
        d.rectangle((px0 + 22, yy + 3, px0 + 22 + 62, yy + 7), fill=BG3)
        if bw > 0:
            d.rectangle((px0 + 22, yy + 3, px0 + 22 + bw, yy + 7), fill=LIME)
        if grow >= 1:
            d.text((px1 - 6, yy + 1), f"{pct}%", font=f8, fill=PAPER, anchor="ra")
    caption(im, "FEES FILL A WEEKLY POT", LIME, 10, chars=int(t * 40))
    if t > 1.2:
        d.text((W // 2, 166), "TOP 5 CALLERS SPLIT IT. PAID BY HAND, EVERY WEEK.", font=f8, fill=MUTE, anchor="ma")
    return im

PFP = Image.open("/tmp/pfp-pixel-64.png").convert("RGB")

def scene_end(t):
    im = DESK.copy()
    d = draw(im)
    pf = PFP.resize((64, 64), Image.NEAREST)
    im.paste(pf, (26, 50))
    title = layer2x("CALLED", f8b, PAPER)
    title = title.resize((title.width * 2, title.height * 2), Image.NEAREST)
    im.paste(title, (104, 28), title)
    l1 = layer2x("CALLERS GET PAID", f8b, PAPER)
    im.paste(l1, (106, 88), l1)
    x = 106
    for s, hl in [("WHEN", None), ("YOU", LIME), ("DO.", None)]:
        lay = layer2x(s, f8b, INK if hl else PAPER, hl)
        im.paste(lay, (x, 112), lay)
        x += lay.width + 6
    if int(t * 2) % 2 == 0:
        d.rectangle((107, 146, 112, 151), fill=LIME)
    d.text((118, 142), "LIVE ON RAYDIUM LAUNCHLAB", font=f8b, fill=LIME)
    return im

def dissolve(a, b, p):
    A, B = np.array(a), np.array(b)
    yy, xx = np.mgrid[0:H, 0:W]
    m = BAY[yy % 4, xx % 4] < p * 16
    A[m] = B[m]
    return Image.fromarray(A)

SCENES = [
    (0.0, 4.6, scene_hook),
    (4.6, 10.6, scene_print),
    (10.6, 13.6, scene_two),
    (13.6, 16.2, scene_pot),
    (16.2, DUR, scene_end),
]

def render(t):
    for i, (a, b, fn) in enumerate(SCENES):
        if a <= t < b:
            im = fn(t - a)
            # dissolve into the next scene over the last 0.3 s
            if i + 1 < len(SCENES) and t > b - 0.3:
                nxt = SCENES[i + 1][2](t - b + 0.0001 if t >= b else 0.0)
                im = dissolve(im, nxt, (t - (b - 0.3)) / 0.3)
            return im
    return scene_end(t - 16.2)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "stills":
        for t in [4.2, 9.4]:
            upscale(render(t), 3).save(f"/tmp/vid_{t}.png")
        sys.exit()
    out = "/home/claude/called/grafik/launch-video.mp4"
    p = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W*K}x{H*K}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
        stdin=subprocess.PIPE)
    n = int(DUR * FPS)
    for i in range(n):
        p.stdin.write(upscale(render(i / FPS), K).tobytes())
    p.stdin.close()
    p.wait()
    print("wrote", out)
