import { buildDisplacementField, displacementScale, type DisplacementFieldSpec } from './displacementMap';

/**
 * Registry of the SVG filters behind `backdrop-filter: url(#…)`. One hidden <svg> holds every
 * filter; elements point at theirs through the `--glass-refraction` custom property, so nothing
 * re-renders in React when a glass surface is resized.
 */
export interface RefractionSpec extends DisplacementFieldSpec {
  /** Largest offset in px, reached at the very edge. */
  readonly maxDisplacement: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFS_ID = 'nm-glass-filters';

/**
 * `backdrop-filter: url()` is only rendered by Chromium; Safari and Firefox accept the syntax but
 * paint nothing for it, so they keep the CSS-only glass.
 */
export function supportsBackdropRefraction(): boolean {
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData
    ?.brands;
  const isChromium = brands
    ? brands.some((entry) => entry.brand === 'Chromium')
    : /\bChrome\//.test(navigator.userAgent);
  return isChromium && CSS.supports('backdrop-filter', 'url(#x)');
}

function defsRoot(): SVGDefsElement {
  const existing = document.getElementById(DEFS_ID);
  if (existing) return existing.querySelector('defs') as SVGDefsElement;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = DEFS_ID;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.append(defs);
  document.body.append(svg);
  return defs;
}

function mapToDataUrl(spec: DisplacementFieldSpec): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.putImageData(new ImageData(buildDisplacementField(spec), spec.width, spec.height), 0, 0);
  return canvas.toDataURL('image/png');
}

function specKey(spec: RefractionSpec): string {
  return `${spec.width}x${spec.height}r${spec.radius}b${spec.bezel}m${spec.maxDisplacement}`;
}

const builtKeys = new Map<string, string>();

/** Creates or updates the filter `id` for `spec`. Returns false when no map could be drawn. */
export function setRefractionFilter(id: string, spec: RefractionSpec): boolean {
  const key = specKey(spec);
  if (builtKeys.get(id) === key) return true;
  const href = mapToDataUrl(spec);
  if (!href) return false;

  const defs = defsRoot();
  defs.querySelector(`[id="${id}"]`)?.remove();

  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = id;
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', String(spec.width));
  filter.setAttribute('height', String(spec.height));
  // The map is data, not colour: any gamma conversion would shift every offset.
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const image = document.createElementNS(SVG_NS, 'feImage');
  image.setAttribute('href', href);
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', String(spec.width));
  image.setAttribute('height', String(spec.height));
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'map');

  const displacement = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displacement.setAttribute('in', 'SourceGraphic');
  displacement.setAttribute('in2', 'map');
  displacement.setAttribute('scale', String(displacementScale(spec.maxDisplacement)));
  displacement.setAttribute('xChannelSelector', 'R');
  displacement.setAttribute('yChannelSelector', 'G');

  filter.append(image, displacement);
  defs.append(filter);
  builtKeys.set(id, key);
  return true;
}

const CUSTOM_PROPERTY = '--glass-refraction';

/** Points `element`'s `--glass-refraction` at the filter `id`, built for the given size. */
export function refractElement(
  element: HTMLElement,
  id: string,
  width: number,
  height: number,
  radius: number,
): void {
  if (setRefractionFilter(id, lensFor(width, height, radius))) {
    element.style.setProperty(CUSTOM_PROPERTY, `url(#${id})`);
  }
}

export function clearRefraction(element: HTMLElement): void {
  element.style.removeProperty(CUSTOM_PROPERTY);
}

export function removeRefractionFilter(id: string): void {
  builtKeys.delete(id);
  document.getElementById(DEFS_ID)?.querySelector(`[id="${id}"]`)?.remove();
}

/** The band and strength used for a surface of this size: gentle, and never wider than the shape. */
export function lensFor(width: number, height: number, radius: number): RefractionSpec {
  const shorter = Math.min(width, height);
  const bezel = Math.max(5, Math.min(shorter * 0.24, 16));
  return {
    width,
    height,
    radius: Math.min(radius, shorter / 2),
    bezel: Math.round(bezel),
    maxDisplacement: Math.round(bezel * 0.5 * 10) / 10,
  };
}
