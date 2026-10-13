"""Draws the two sample pictures of the Spark effects thumbnails (Transitions and Animations drawers).

The pictures are drawn here from shapes and gradients only (no photo, no font, no third-party artwork), so they carry no
licence but this repository's: `public/spark/fx/sample-a.webp` is a warm landscape at sunset with a title bar (the
outgoing scene A of a transition card), `public/spark/fx/sample-b.webp` a cool night city above water (the incoming
scene B, and the picture an animation card animates). 320 x 180 (16:9), drawn at 4x and reduced, WebP of at most ~15 KB each.

    python youtorch-ui/scripts/generate-fx-samples.py          (needs Pillow with WebP)

The output is deterministic for a given Pillow version (seeded randomness only); the files are committed, the script is
their provenance.
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT = 320, 180
SCALE = 4
OUT = Path(__file__).resolve().parents[1] / "public" / "spark" / "fx"


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))  # type: ignore[return-value]


def vertical_gradient(size: tuple[int, int], stops: list[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / (height - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                draw.line([(0, y), (width, y)], fill=lerp(c0, c1, (t - t0) / (t1 - t0) if t1 > t0 else 0))
                break
    return image


def ridge(width: int, base: float, amplitude: float, seed: int, step: int) -> list[tuple[float, float]]:
    """A mountain or hill outline: a seeded random walk, smoothed."""
    rng = random.Random(seed)
    points = []
    y = base
    for x in range(0, width + step, step):
        y += rng.uniform(-amplitude, amplitude)
        y = min(max(y, base - amplitude * 3), base + amplitude * 3)
        points.append((x, y))
    smooth = []
    for index, (x, y) in enumerate(points):
        neighbours = [points[max(0, index - 1)][1], y, points[min(len(points) - 1, index + 1)][1]]
        smooth.append((x, sum(neighbours) / 3))
    return smooth


def landscape() -> Image.Image:
    w, h = WIDTH * SCALE, HEIGHT * SCALE
    image = vertical_gradient((w, h), [(0.0, (255, 122, 69)), (0.45, (255, 186, 110)), (0.62, (255, 214, 150)), (1.0, (255, 214, 150))])
    # The sun with a soft glow.
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    cx, cy = int(w * 0.68), int(h * 0.52)
    for radius, alpha in ((int(h * 0.30), 40), (int(h * 0.22), 70), (int(h * 0.15), 110)):
        gdraw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(255, 240, 200, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=SCALE * 6))
    image.paste(glow, (0, 0), glow)
    draw = ImageDraw.Draw(image)
    sun = int(h * 0.10)
    draw.ellipse([cx - sun, cy - sun, cx + sun, cy + sun], fill=(255, 247, 220))
    # Three layers of hills, far (hazy) to near (dark).
    for base, amplitude, seed, colour in (
        (0.58, 0.020, 7, (214, 112, 92)),
        (0.68, 0.025, 11, (150, 66, 74)),
        (0.80, 0.030, 23, (84, 34, 58)),
    ):
        outline = ridge(w, h * base, h * amplitude, seed, SCALE * 8)
        draw.polygon(outline + [(w, h), (0, h)], fill=colour)
    # The title bar: a dark band at the lower left with two lines of "text" (blocks, never words).
    bar = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(bar)
    x0, y0, x1, y1 = int(w * 0.06), int(h * 0.70), int(w * 0.58), int(h * 0.90)
    bdraw.rounded_rectangle([x0, y0, x1, y1], radius=SCALE * 5, fill=(24, 14, 30, 170))
    bdraw.rounded_rectangle([x0 + SCALE * 8, y0 + SCALE * 7, x0 + int((x1 - x0) * 0.78), y0 + SCALE * 15], radius=SCALE * 3, fill=(255, 255, 255, 235))
    bdraw.rounded_rectangle([x0 + SCALE * 8, y0 + SCALE * 21, x0 + int((x1 - x0) * 0.52), y0 + SCALE * 26], radius=SCALE * 2, fill=(255, 196, 140, 220))
    bdraw.rectangle([x0, y0, x0 + SCALE * 3, y1], fill=(255, 122, 69, 255))
    image.paste(bar, (0, 0), bar)
    return image.resize((WIDTH, HEIGHT), Image.LANCZOS)


def city() -> Image.Image:
    w, h = WIDTH * SCALE, HEIGHT * SCALE
    horizon = int(h * 0.70)
    image = vertical_gradient((w, h), [(0.0, (14, 22, 58)), (0.5, (38, 74, 140)), (0.70, (72, 150, 196)), (1.0, (10, 30, 60))])
    draw = ImageDraw.Draw(image)
    rng = random.Random(42)
    # Stars and a crescent moon.
    for _ in range(70):
        x, y = rng.uniform(0, w), rng.uniform(0, h * 0.42)
        r = rng.choice((1, 1, 2)) * SCALE / 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(220, 232, 255))
    mx, my, mr = int(w * 0.18), int(h * 0.20), int(h * 0.075)
    draw.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(236, 242, 255))
    draw.ellipse([mx - mr + int(mr * 0.45), my - mr - int(mr * 0.15), mx + mr + int(mr * 0.45), my + mr - int(mr * 0.15)], fill=(24, 40, 90))
    # Two rows of buildings with lit windows.
    for row, (colour, height_range, width_range, lit) in enumerate(
        (((30, 48, 92), (0.18, 0.40), (0.05, 0.09), 0.25), ((12, 20, 44), (0.10, 0.32), (0.06, 0.11), 0.45))
    ):
        x = -rng.uniform(0, w * 0.04)
        while x < w:
            bw = rng.uniform(*width_range) * w
            bh = rng.uniform(*height_range) * h
            top = horizon - bh
            draw.rectangle([x, top, x + bw, horizon], fill=colour)
            if row == 1 and rng.random() < 0.3:
                draw.rectangle([x + bw * 0.45, top - h * 0.04, x + bw * 0.55, top], fill=colour)
            for wy in range(int(top + SCALE * 4), horizon - SCALE * 4, SCALE * 5):
                for wx in range(int(x + SCALE * 3), int(x + bw - SCALE * 3), SCALE * 5):
                    if rng.random() < lit:
                        draw.rectangle([wx, wy, wx + SCALE * 2, wy + SCALE * 2], fill=(255, 214, 120) if rng.random() < 0.8 else (180, 220, 255))
            x += bw + rng.uniform(0, w * 0.01)
    # The water: the skyline mirrored, darker and broken into ripples.
    above = image.crop((0, horizon - (h - horizon), w, horizon)).transpose(Image.FLIP_TOP_BOTTOM)
    water = Image.blend(above, Image.new("RGB", above.size, (8, 26, 52)), 0.62)
    ripples = ImageDraw.Draw(water)
    for y in range(0, water.size[1], SCALE * 3):
        ripples.line([(0, y), (w, y)], fill=(8, 26, 52), width=SCALE)
    image.paste(water.filter(ImageFilter.GaussianBlur(radius=SCALE * 0.8)), (0, horizon))
    return image.resize((WIDTH, HEIGHT), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, picture in (("sample-a.webp", landscape()), ("sample-b.webp", city())):
        path = OUT / name
        picture.save(path, "WEBP", quality=90, method=6)
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
