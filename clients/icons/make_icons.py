"""Builds the app icons and link preview images for the client tracker and trainer dashboard."""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "clients", "icons")
os.makedirs(OUT, exist_ok=True)

BG = (18, 20, 23)
PANEL = (27, 30, 35)
LINE = (44, 48, 56)
FG = (236, 238, 241)
MUTED = (154, 161, 171)
THEMES = {"client": (79, 209, 165), "trainer": (110, 168, 255)}


def mark(draw, box, color, s):
    """Rising line with a dot at the end, drawn inside box = (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    pts = [(0.00, 0.78), (0.30, 0.52), (0.52, 0.66), (1.00, 0.18)]
    xy = [(x0 + px * w, y0 + py * h) for px, py in pts]
    lw = int(0.11 * w)
    draw.line(xy, fill=color, width=lw, joint="curve")
    for x, y in xy[:-1]:
        r = lw / 2
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)
    ex, ey = xy[-1]
    r = 0.13 * w
    draw.ellipse((ex - r, ey - r, ex + r, ey + r), fill=color)
    r2 = 0.055 * w
    draw.ellipse((ex - r2, ey - r2, ex + r2, ey + r2), fill=BG)
    # baseline
    by = y0 + 0.98 * h
    draw.line([(x0, by), (x1, by)], fill=LINE, width=max(2, int(0.035 * w)))


def icon(kind, size, safe):
    """safe: share of the canvas the mark may use (smaller for maskable icons)."""
    k = 4
    S = size * k
    im = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(im)
    m = S * (1 - safe) / 2
    mark(d, (m, m + S * 0.02, S - m, S - m + S * 0.02), THEMES[kind], k)
    return im.resize((size, size), Image.LANCZOS)


def og(kind, title, sub):
    W, H, k = 1200, 630, 2
    im = Image.new("RGB", (W * k, H * k), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((60 * k, 60 * k, (W - 60) * k, (H - 60) * k), radius=28 * k, fill=PANEL, outline=LINE, width=2 * k)
    mark(d, (130 * k, 190 * k, 380 * k, 440 * k), THEMES[kind], k)
    serif = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", 62 * k)
    sans = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30 * k)
    d.text((450 * k, 232 * k), title, font=serif, fill=FG)
    y = 335 * k
    for line in sub:
        d.text((452 * k, y), line, font=sans, fill=MUTED)
        y += 46 * k
    return im.resize((W, H), Image.LANCZOS)


for kind in THEMES:
    icon(kind, 192, 0.72).save(os.path.join(OUT, f"{kind}-192.png"), optimize=True)
    icon(kind, 512, 0.72).save(os.path.join(OUT, f"{kind}-512.png"), optimize=True)
    icon(kind, 512, 0.56).save(os.path.join(OUT, f"{kind}-maskable-512.png"), optimize=True)
    icon(kind, 180, 0.66).save(os.path.join(OUT, f"{kind}-apple-180.png"), optimize=True)
    icon(kind, 32, 0.80).save(os.path.join(OUT, f"{kind}-32.png"), optimize=True)

og("client", "Fitness Tracker", ["Weight, food, workouts, sleep and", "measurements, tracked over time."]).save(os.path.join(OUT, "og-client.png"), optimize=True)
og("trainer", "Trainer Dashboard", ["Every client's progress, goals and", "training logs in one place."]).save(os.path.join(OUT, "og-trainer.png"), optimize=True)
print(sorted(os.listdir(OUT)))
