"""Pixel-art kit for CALLED: palette, pixel fonts, the receipt, the check badge, the printer."""
from PIL import Image, ImageDraw, ImageFont

BG = (17, 16, 12)
BG2 = (26, 25, 20)
BG3 = (34, 33, 26)
PAPER = (251, 249, 243)
PAPER_SH = (226, 221, 207)
INK = (22, 21, 15)
MUTE = (125, 121, 108)
LIME = (212, 255, 58)
LIME_SH = (150, 190, 20)
GAIN = (13, 138, 66)
GAIN_HI = (54, 196, 111)
LOSS = (210, 63, 42)
SHADOW = (8, 8, 6)
METAL = (150, 148, 138)
BODY = (32, 31, 25)
BODY_HI = (58, 56, 46)
BODY_LO = (20, 19, 15)

F = "/home/claude/pix/node_modules/@fontsource"
def silk(size=8, bold=False):
    return ImageFont.truetype(f"{F}/silkscreen/files/silkscreen-latin-{'700' if bold else '400'}-normal.woff", size)
def press(size=8):
    return ImageFont.truetype(f"{F}/press-start-2p/files/press-start-2p-latin-400-normal.woff", size)

def draw(im):
    d = ImageDraw.Draw(im)
    d.fontmode = "1"  # no antialiasing: hard pixels
    return d

def text_w(font, s):
    b = font.getbbox(s)
    return b[2] - b[0]

def text(d, xy, s, font, fill, anchor="la"):
    d.text(xy, s, font=font, fill=fill, anchor=anchor)

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def glow(im, cx, cy, r, color, strength=1.0):
    """Ordered-dither radial glow."""
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            dx, dy = (x - cx) / r, (y - cy) / (r * 0.8)
            t = max(0.0, 1 - (dx * dx + dy * dy) ** 0.5) * strength
            if t * 16 > BAYER[y % 4][x % 4] + 0.5:
                px[x, y] = color

def upscale(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)

def zigzag_paper(d, x0, y0, x1, y1, color=PAPER, tooth=2, top=True, bottom=True):
    d.rectangle((x0, y0, x1, y1), fill=color)
    w = x1 - x0 + 1
    for i in range(w):
        x = x0 + i
        k = i % (tooth * 2)
        depth = k if k < tooth else tooth * 2 - k
        depth = tooth - depth
        if top:
            for j in range(depth):
                d.point((x, y0 + j), fill=None)
        if bottom:
            pass

def paper_shape(im, x0, y0, x1, y1, color=PAPER, shade=PAPER_SH, tooth=2, top=True, bottom=True, bg=None):
    """Paper rectangle with zigzag edges cut into the surrounding colour."""
    d = draw(im)
    d.rectangle((x0, y0, x1, y1), fill=color)
    d.line((x1, y0, x1, y1), fill=shade)
    px = im.load()
    for i in range(x1 - x0 + 1):
        x = x0 + i
        k = i % (tooth * 2)
        cut = tooth - (k if k <= tooth else tooth * 2 - k)
        for j in range(cut):
            if top:
                px[x, y0 + j] = bg if bg else px[x, y0 - 1]
            if bottom:
                px[x, y1 - j] = bg if bg else px[x, y1 + 1]

def check_badge(im, cx, cy, r):
    d = draw(im)
    d.ellipse((cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1), fill=INK)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=LIME)
    # shading on the lower right edge
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            dx, dy = x - cx, y - cy
            if r * r - 2 * r < dx * dx + dy * dy <= r * r and dx + dy > r * 0.3:
                im.putpixel((x, y), LIME_SH)
    # the check, two pixels thick
    s = r / 9
    pts = [(-4.5, 0), (-1.5, 3), (4.5, -3.5)]
    pts = [(cx + p[0] * s, cy + p[1] * s) for p in pts]
    w = max(2, round(2.2 * s))
    d.line(pts, fill=INK, width=w, joint=None)

# 3x5 digits and signs for tiny big-numbers.
GLYPH = {
    "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"], "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"], "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"], "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"], "+": ["000", "010", "111", "010", "000"], "-": ["000", "000", "111", "000", "000"],
    ".": ["000", "000", "000", "000", "010"], "%": ["101", "001", "010", "100", "101"],
}
def tiny(im, x, y, s, color, scale=1, gap=1):
    for ch in s:
        g = GLYPH[ch]
        for gy, row in enumerate(g):
            for gx, c in enumerate(row):
                if c == "1":
                    for a in range(scale):
                        for b in range(scale):
                            im.putpixel((x + gx * scale + a, y + gy * scale + b), color)
        x += (3 + gap) * scale if ch != "." else (1 + gap) * scale + scale
    return x

def barcode(d, x0, y0, x1, h, seed=7, color=INK):
    s = seed
    x = x0
    while x < x1:
        s = (s * 1103515245 + 12345) & 0x7FFFFFFF
        w = 1 + (s >> 8) % 2
        if x + w > x1:
            break
        d.rectangle((x, y0, x + w - 1, y0 + h - 1), fill=color)
        x += w + 1 + (s >> 12) % 2
