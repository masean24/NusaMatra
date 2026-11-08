"""Builds src/components/layout/footerArt.ts, the footer backdrop's fixed shapes. Run once, by hand:

    pip install potracer pillow numpy
    python scripts/footer/build-footer-art.py

- The giant wordmark: the official "NUSA MATRA" wordmark (scripts/splash/source/wordmark-normal.png)
  traced into one SVG path with potrace (alpha > 110, turdsize 20, alphamax 1.0, opttolerance 0.3).
  The letters are traced, never retyped in a font.
- The five hill layers: y(x) = base - sum(h * exp(-((x - c) / sigma)^2)), sampled from x = -20 to
  1460 every 8 units, closed along the bottom of the 1440x420 landscape.
- The Kaca stars: 70 points from mulberry32 seeded with 7, so they never move between renders.

footerArt.test.ts recomputes the hills and stars from the same formulas and checks the constants.
"""

from pathlib import Path

import numpy as np
import potrace
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'scripts' / 'splash' / 'source' / 'wordmark-normal.png'
OUT = ROOT / 'src' / 'components' / 'layout' / 'footerArt.ts'

# (base, [(c, h, sigma), ...]) from the farthest layer to the nearest.
HILLS = [
    (200, [(-120, 43.3, 133), (232, 53.3, 180), (531, 67.5, 187), (843, 67.8, 136), (1105, 66.3, 196), (1453, 59.4, 114)]),
    (246, [(-120, 37.0, 122), (141, 69.7, 154), (501, 65.8, 198), (750, 49.6, 133), (1111, 36.5, 159), (1439, 51.4, 197)]),
    (292, [(-120, 56.8, 176), (259, 44.1, 177), (512, 64.8, 139), (863, 42.1, 186), (1220, 54.8, 155), (1454, 41.4, 123)]),
    (336, [(-120, 53.6, 130), (153, 67.0, 186), (492, 41.3, 145), (790, 59.7, 192), (1026, 62.2, 167), (1340, 45.5, 179), (1586, 71.7, 165)]),
    (380, [(-120, 43.7, 118), (249, 31.6, 170), (489, 32.5, 197), (849, 39.2, 163), (1124, 46.7, 135), (1475, 57.4, 197)]),
]
STAR_COUNT = 70
STAR_SEED = 7
STAR_RADII = (0.8, 1, 1.3)


def num(value: float) -> str:
    """One decimal, without a trailing .0 or a negative zero."""
    text = f'{value:.1f}'.rstrip('0').rstrip('.')
    return '0' if text == '-0' else text


def hill_path(base: float, domes) -> str:
    points = []
    for x in range(-20, 1461, 8):
        y = base - sum(h * np.exp(-(((x - c) / s) ** 2)) for c, h, s in domes)
        points.append(f'L{num(x)} {num(y)}')
    return 'M-20 420 ' + ' '.join(points) + ' L1460 420 Z'


def mulberry32(seed: int):
    state = seed & 0xFFFFFFFF

    def imul(a: int, b: int) -> int:
        return (a * b) & 0xFFFFFFFF

    def next_value() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_value


def stars():
    random = mulberry32(STAR_SEED)
    result = []
    for _ in range(STAR_COUNT):
        x = round(random() * 1440, 1)
        y = round(random() * 170, 1)
        r = STAR_RADII[min(2, int(random() * 3))]
        opacity = round(0.25 + random() * 0.45, 2)
        result.append((x, y, r, opacity))
    return result


def trace_wordmark():
    image = np.asarray(Image.open(SOURCE).convert('RGBA'))
    mask = image[..., 3] > 110
    height, width = mask.shape
    # The letters, not a box: well under the whole image is filled.
    if mask.mean() > 0.7:
        raise SystemExit('mask covers most of the image: invert it before tracing')
    # potracer inverts the bitmap it is given (white is ink), so it gets the inverted mask.
    bitmap = potrace.Bitmap(~mask)
    traced = list(bitmap.trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.3))
    parts = []
    for curve in traced:
        xs = [curve.start_point.x] + [s.end_point.x for s in curve.segments]
        ys = [curve.start_point.y] + [s.end_point.y for s in curve.segments]
        if max(xs) - min(xs) > width * 0.9 and max(ys) - min(ys) > height * 0.9:
            raise SystemExit('an outline spans the whole image: the frame was traced, not the letters')
        start = curve.start_point
        parts.append(f'M{num(start.x)} {num(start.y)}')
        for segment in curve.segments:
            end = segment.end_point
            if segment.is_corner:
                parts.append(f'L{num(segment.c.x)} {num(segment.c.y)}L{num(end.x)} {num(end.y)}')
            else:
                parts.append(
                    f'C{num(segment.c1.x)} {num(segment.c1.y)} {num(segment.c2.x)} {num(segment.c2.y)} '
                    f'{num(end.x)} {num(end.y)}'
                )
        parts.append('Z')
    curves = len(traced)
    # Nine letters, plus the counters of A, A and R (and A's), so well over nine outlines.
    if curves < 9:
        raise SystemExit(f'only {curves} outlines traced: expected the letters')
    return width, height, ''.join(parts), curves


def main():
    width, height, wordmark, curves = trace_wordmark()
    hills = [hill_path(base, domes) for base, domes in HILLS]
    star_rows = ',\n'.join(f'  [{num(x)}, {num(y)}, {r}, {o}]' for x, y, r, o in stars())
    hill_rows = ',\n'.join(f"  '{path}'" for path in hills)
    OUT.write_text(
        '// Generated by scripts/footer/build-footer-art.py. Do not edit by hand.\n\n'
        '/** The official NUSA MATRA wordmark, traced from its PNG; fill-rule evenodd keeps the counters. */\n'
        f'export const WORDMARK = {{ width: {width}, height: {height}, path: \'{wordmark}\' }} as const;\n\n'
        '/** Hill layers 0 (farthest) to 4 (nearest), in the 1440x420 landscape. */\n'
        f'export const HILL_PATHS = [\n{hill_rows},\n] as const;\n\n'
        '/** Kaca stars: x, y, radius, opacity (mulberry32, seed 7). */\n'
        f'export const STARS: readonly (readonly [number, number, number, number])[] = [\n{star_rows},\n];\n',
        encoding='utf-8',
        newline='\n',
    )
    print(f'wrote {OUT.relative_to(ROOT)}: wordmark {width}x{height}, {curves} outlines, {len(hills)} hills, {len(stars())} stars')


if __name__ == '__main__':
    main()
