from PIL import Image
from pix import *

N = 64
im = Image.new("RGB", (N, N), BG)
glow(im, 32, 30, 34, BG2, 1.0)
glow(im, 32, 30, 20, BG3, 0.8)
d = draw(im)
# receipt geometry
x0, y0, x1, y1 = 16, 8, 45, 55
# drop shadow
d.rectangle((x0 + 2, y0 + 3, x1 + 2, y1 + 2), fill=SHADOW)
paper_shape(im, x0, y0, x1, y1, tooth=2)
d = draw(im)
# header: mini mark + title bar
d.rectangle((x0 + 3, y0 + 4, x0 + 6, y0 + 7), fill=INK)
d.rectangle((x0 + 8, y0 + 5, x0 + 18, y0 + 6), fill=INK)
d.rectangle((x1 - 6, y0 + 5, x1 - 3, y0 + 6), fill=MUTE)
# dashed line
for x in range(x0 + 3, x1 - 2, 2):
    d.point((x, y0 + 10), fill=MUTE)
# rows: label (grey) and value (ink)
for i, (lw, vw) in enumerate([(9, 6), (7, 8)]):
    y = y0 + 13 + i * 3
    d.line((x0 + 3, y, x0 + 3 + lw, y), fill=MUTE)
    d.line((x1 - 3 - vw, y, x1 - 3, y), fill=INK)
for x in range(x0 + 3, x1 - 2, 2):
    d.point((x, y0 + 20), fill=MUTE)
# the result: a big green +88
tiny(im, x0 + 3, y0 + 23, "+88", GAIN, scale=2, gap=1)
# small row under it
d.line((x0 + 3, y0 + 36, x0 + 12, y0 + 36), fill=MUTE)
# barcode: thin bars
bx = x0 + 3
for w in [1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1]:
    d.rectangle((bx, y0 + 40, bx + w - 1, y0 + 44), fill=INK)
    bx += w + 1
# the check badge, over the lower right corner
check_badge(im, 44, 49, 9)
im.save("/tmp/pfp-pixel-64.png")
upscale(im, 16).save("/home/claude/called/grafik/pfp.png")
print("ok")
