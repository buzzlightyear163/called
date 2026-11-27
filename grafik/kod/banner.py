from PIL import Image
from pix import *

W, H, K = 300, 100, 5
im = Image.new("RGB", (W, H), BG)
glow(im, 255, 50, 95, BG2, 1.0)
glow(im, 255, 50, 55, BG3, 0.7)
f8, f8b = silk(8), silk(8, bold=True)

def title_layer(lines):
    lay = Image.new("RGBA", (110, 28), (0, 0, 0, 0))
    ld = draw(lay)
    y = 0
    for parts in lines:
        x = 1
        for s, hl in parts:
            w = text_w(f8b, s)
            if hl:
                ld.rectangle((x - 1, y + 2, x + w, y + 11), fill=LIME)
                ld.text((x, y), s, font=f8b, fill=INK)
            else:
                ld.text((x, y), s, font=f8b, fill=PAPER)
            x += w + 4
        y += 11
    return lay.resize((lay.width * 2, lay.height * 2), Image.NEAREST)

lay = title_layer([[("CALLERS GET PAID", False)], [("WHEN", False), ("YOU", True), ("DO.", False)]])
im.paste(lay, (12, 9), lay)
d = draw(im)
text(d, (14, 54), "PAID ON RESULTS, NOT VOLUME", f8, LIME)

# The weekly pot panel.
px0, py0, px1, py1 = 218, 8, 291, 91
d.rectangle((px0 + 2, py0 + 2, px1 + 2, py1 + 2), fill=SHADOW)
d.rectangle((px0, py0, px1, py1), fill=BG2, outline=BODY_HI)
d.rectangle((px0, py0, px1, py0 + 12), fill=LIME)
text(d, (px0 + 5, py0 + 1), "WEEKLY POT", f8b, INK)
for i, pct in enumerate([35, 25, 18, 12, 10]):
    y = py0 + 18 + i * 12
    d.rectangle((px0 + 5, y, px0 + 13, y + 8), fill=LIME if i == 0 else BG3)
    text(d, (px0 + 7, y - 2), str(i + 1), f8b, INK if i == 0 else PAPER)
    bw = round(27 * pct / 35)
    d.rectangle((px0 + 17, y + 2, px0 + 17 + 27, y + 6), fill=BG3)
    d.rectangle((px0 + 17, y + 2, px0 + 17 + bw, y + 6), fill=LIME)
    text(d, (px1 - 4, y - 2), f"{pct}%", f8, PAPER, anchor="ra")
text(d, (px0 + 5, py1 - 12), "SPLIT BY RESULTS", silk(8), MUTE) if text_w(silk(8), "SPLIT BY RESULTS") < 66 else None

# Bottom right of the title: a receipt-style dotted rule and one line.
for x in range(84, 210, 3):
    d.point((x, 76), fill=BODY_HI)
text(d, (84, 80), "EVERY CALL GETS A RECEIPT", f8, MUTE)

upscale(im, K).save("/home/claude/called/grafik/banner.png")
print("ok")
