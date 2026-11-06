#!/usr/bin/env python3
"""
Cuts the official Nusa Matra logo into the layers the opening splash animates, and writes the result
to src/assets/splash/*.webp and src/features/intro/splashLogo.ts. Run once; the output is committed.

    pip install pillow scipy potracer
    python scripts/splash/build-logo.py
    npx prettier --write src/features/intro/splashLogo.ts

Source (scripts/splash/source): the logo files from the approved splash mockup, the only versions in
the project large enough for the splash. The wordmark exists in its dark version only, so the light
one is the same letter shapes in the logotype's colours on dark surfaces (Logo.module.css).
"""
from pathlib import Path

import numpy as np
import potrace
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'scripts' / 'splash' / 'source'
ASSETS = ROOT / 'src' / 'assets' / 'splash'
OUTPUT = ROOT / 'src' / 'features' / 'intro' / 'splashLogo.ts'

# Twice the sizes on screen (the symbol is 124 px wide, the wordmark 34 px tall).
SYMBOL_WIDTH = 248
WORDMARK_HEIGHT = 68
WEBP_QUALITY = 92

EIGHT_WAY = np.ones((3, 3), dtype=bool)
LETTER_COUNT = 9
NUSA_LETTERS = 4
LIGHT_NUSA = (255, 255, 255)
LIGHT_MATRA = (255, 217, 191)  # --nm-peach, "Matra" in the logotype on dark surfaces


def load(name):
    return np.array(Image.open(SOURCE / name).convert('RGBA'))


def largest_component(mask):
    labels, count = ndimage.label(mask, structure=EIGHT_WAY)
    if count == 0:
        raise SystemExit('No component found')
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    return labels == int(np.argmax(sizes)) + 1


def split_symbol(symbol):
    """The sun is the largest connected patch of orange, widened to take its antialiased edge."""
    r, g, b, a = (symbol[..., i].astype(int) for i in range(4))
    core = largest_component((r > 180) & (r - b > 90) & (g < 200) & (a > 20))
    mask = ndimage.binary_dilation(core, structure=EIGHT_WAY, iterations=3)
    sun = symbol.copy()
    sun[~mask] = 0
    body = symbol.copy()
    body[mask] = 0

    height, width = core.shape
    ys, xs = np.nonzero(core)
    centre_x = (xs.min() + xs.max() + 1) / 2
    centre_y = (ys.min() + ys.max() + 1) / 2
    radius = (xs.max() - xs.min() + ys.max() - ys.min() + 2) / 4
    return body, sun, {
        'x': round(centre_x / width * 100, 2),
        'y': round(centre_y / height * 100, 2),
        # Of the symbol's width, as the rings are sized.
        'r': round(radius / width * 100, 2),
    }


def save_webp(pixels, name, size):
    """Resized with premultiplied alpha, so no dark fringe, and RGB zeroed where nothing shows."""
    image = Image.fromarray(pixels, 'RGBA').convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
    out = np.array(image)
    out[out[..., 3] == 0] = 0
    Image.fromarray(out, 'RGBA').save(ASSETS / name, 'WEBP', quality=WEBP_QUALITY, method=6)


def trace_outline(body):
    """The body's silhouette as one SVG path, in the source image's own coordinates."""
    silhouette = ndimage.binary_opening(body[..., 3] > 128, structure=EIGHT_WAY, iterations=2)
    # potracer traces the dark side of an array, so the N goes in as 0.
    curves = potrace.Bitmap((~silhouette).astype(np.uint8) * 255).trace(turdsize=50, opttolerance=0.4)
    number = lambda value: f'{value:.1f}'.removesuffix('.0')
    point = lambda p: f'{number(p.x)} {number(p.y)}'
    parts = []
    for curve in curves:
        parts.append(f'M{point(curve.start_point)}')
        for segment in curve.segments:
            if segment.is_corner:
                parts.append(f'L{point(segment.c)}L{point(segment.end_point)}')
            else:
                parts.append(f'C{point(segment.c1)} {point(segment.c2)} {point(segment.end_point)}')
        parts.append('Z')

    # Tracing the wrong side of the mask gives the canvas's frame, all straight lines, around the N.
    if any(all(segment.is_corner for segment in curve.segments) for curve in curves):
        raise SystemExit('The outline traced the canvas frame; invert the mask.')
    return ''.join(parts), len(curves)


def build_symbol(symbol, variant):
    body, sun, sun_box = split_symbol(symbol)
    height, width = body.shape[:2]
    size = (SYMBOL_WIDTH, round(SYMBOL_WIDTH * height / width))
    save_webp(body, f'body-{variant}.webp', size)
    save_webp(sun, f'sun-{variant}.webp', size)
    outline, curve_count = trace_outline(body)
    print(f'{variant}: {width}x{height}, sun {sun_box}, outline {len(outline)} chars, {curve_count} curves')
    return {'width': width, 'height': height, 'sun': sun_box, 'outline': outline}


def cut_wordmark():
    """Per connected letter, never per column: the A and T overlap horizontally."""
    wordmark = load('wordmark-normal.png')
    ys, xs = np.nonzero(wordmark[..., 3] > 0)
    wordmark = wordmark[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    alpha = wordmark[..., 3]
    labels, count = ndimage.label(alpha > 40, structure=EIGHT_WAY)
    sizes = ndimage.sum(alpha > 40, labels, range(1, count + 1))
    letters = [i + 1 for i, size in enumerate(sizes) if size >= sizes.max() * 0.05]
    if len(letters) != LETTER_COUNT:
        raise SystemExit(f'Expected {LETTER_COUNT} letters, found {len(letters)}')

    # Specks and the faint antialiased edge join the nearest letter.
    is_letter = np.isin(labels, letters)
    nearest = ndimage.distance_transform_edt(~is_letter, return_distances=False, return_indices=True)
    owner = labels[nearest[0], nearest[1]]
    owner[alpha == 0] = 0

    height, width = alpha.shape
    scale = WORDMARK_HEIGHT / height
    cut = []
    for label in letters:
        ys, xs = np.nonzero(owner == label)
        cut.append((int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1, label))
    cut.sort()

    boxes = []
    for index, (x0, x1, y0, y1, label) in enumerate(cut):
        piece_alpha = np.where(owner == label, alpha, 0)[y0:y1, x0:x1]
        solid = wordmark[y0:y1, x0:x1][piece_alpha > 200][:, :3]
        normal = tuple(int(v) for v in np.median(solid, axis=0))
        light = LIGHT_NUSA if index < NUSA_LETTERS else LIGHT_MATRA
        size = (max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale)))
        mask = Image.fromarray(piece_alpha.astype(np.uint8), 'L').resize(size, Image.LANCZOS)
        for variant, colour in (('normal', normal), ('kaca', light)):
            flat = Image.new('RGBA', size, (*colour, 255))
            flat.putalpha(mask)
            out = np.array(flat)
            out[out[..., 3] == 0] = 0
            Image.fromarray(out, 'RGBA').save(
                ASSETS / f'letter-{variant}-{index}.webp', 'WEBP', quality=WEBP_QUALITY, method=6
            )
        boxes.append(
            {
                'left': round(x0 / width * 100, 3),
                'top': round(y0 / height * 100, 3),
                'width': round((x1 - x0) / width * 100, 3),
                'height': round((y1 - y0) / height * 100, 3),
            }
        )
    print(f'wordmark: {width}x{height}, {len(boxes)} letters')
    return width, height, boxes


def variant_source(key, name, data):
    letters = ', '.join(f'{key}Letter{i}' for i in range(LETTER_COUNT))
    return f"""  {key}: {{
    body: {key}Body,
    sun: {key}Sun,
    letters: [{letters}],
    width: {data['width']},
    height: {data['height']},
    sun_x: {data['sun']['x']},
    sun_y: {data['sun']['y']},
    sun_r: {data['sun']['r']},
    outline: '{data['outline']}',
  }},"""


def write_module(variants, word_width, word_height, boxes):
    imports = []
    for key, name in (('normal', 'normal'), ('glass', 'kaca')):
        imports.append(f"import {key}Body from '@/assets/splash/body-{name}.webp?no-inline';")
        imports.append(f"import {key}Sun from '@/assets/splash/sun-{name}.webp?no-inline';")
        for i in range(LETTER_COUNT):
            imports.append(f"import {key}Letter{i} from '@/assets/splash/letter-{name}-{i}.webp?no-inline';")
    box_lines = '\n'.join(
        f"  {{ left: {b['left']}, top: {b['top']}, width: {b['width']}, height: {b['height']} }}," for b in boxes
    )
    source = f"""// Generated by scripts/splash/build-logo.py from the official logo. Do not edit by hand.
{chr(10).join(imports)}

/** Each mode's logo. Sun position and radius are percent of the symbol; outline is in its pixels. */
export const SPLASH_LOGO = {{
{variant_source('normal', 'normal', variants['normal'])}
{variant_source('glass', 'kaca', variants['glass'])}
}};

/** The wordmark box's aspect ratio. */
export const SPLASH_WORDMARK_RATIO = '{word_width} / {word_height}';

/** Each letter's place, in percent of the wordmark box. */
export const SPLASH_LETTER_BOXES = [
{box_lines}
];
"""
    OUTPUT.write_text(source, encoding='utf-8', newline='\n')


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    normal = load('symbol-normal-body.png')
    sun = Image.fromarray(load('symbol-normal-sun.png'), 'RGBA')
    composed = Image.fromarray(normal, 'RGBA')
    composed.alpha_composite(sun)
    variants = {
        'normal': build_symbol(np.array(composed), 'normal'),
        'glass': build_symbol(load('symbol-kaca.png'), 'kaca'),
    }
    word_width, word_height, boxes = cut_wordmark()
    write_module(variants, word_width, word_height, boxes)
    total = sum(path.stat().st_size for path in ASSETS.glob('*.webp'))
    print(f'{len(list(ASSETS.glob("*.webp")))} webp, {total / 1024:.1f} KB')


if __name__ == '__main__':
    main()
