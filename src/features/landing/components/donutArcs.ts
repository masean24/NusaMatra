export interface DonutSlice {
  readonly id: string;
  readonly name: string;
  /** Basis points; the slices of one donut add up to 10 000. */
  readonly bps: number;
}

/** Fixed slots: one `<path>` each, never added or removed, so a focus with fewer slices closes the rest. */
export const MAX_SLICES = 5;

/** One glide for the ring's shapes, colours and centre figure, and for the legend bars beside it. */
export const DONUT_DURATION_MS = 750;

const FULL_TURN = 2 * Math.PI;
/** A thin gap between neighbouring slices, in radians, so their colours never touch. */
const PAD = 0.014;

/** One slot's shape and colour at a moment: angles from twelve o'clock clockwise, radius in view units. */
export interface SlotState {
  readonly start: number;
  readonly end: number;
  readonly outer: number;
  readonly rgb: readonly [number, number, number];
}

/**
 * Where every slot should end up: the slices end to end around the ring, sized by weight; slots
 * beyond the focus's slices closed at the end of the turn (start = end = 2π), so they shrink away
 * there. The active slice (the one in focus, or else the largest) sits `lift` further out.
 */
export function targetSlots(
  slices: readonly DonutSlice[],
  activeId: string | null,
  palette: readonly (readonly [number, number, number])[],
  outer: number,
  lift: number,
): SlotState[] {
  const total = slices.reduce((sum, slice) => sum + slice.bps, 0);
  const focusId = activeId ?? largest(slices)?.id ?? null;
  const last = palette[palette.length - 1] ?? [0, 0, 0];
  let angle = 0;
  return Array.from({ length: MAX_SLICES }, (_, index) => {
    const slice = slices[index];
    const rgb = palette[index] ?? last;
    if (!slice || total <= 0) return { start: FULL_TURN, end: FULL_TURN, outer, rgb };
    const start = angle;
    angle += (slice.bps / total) * FULL_TURN;
    return { start, end: angle, outer: slice.id === focusId ? outer + lift : outer, rgb };
  });
}

export function largest(slices: readonly DonutSlice[]): DonutSlice | null {
  return slices.reduce<DonutSlice | null>(
    (best, slice) => (!best || slice.bps > best.bps ? slice : best),
    null,
  );
}

/** cubicOut: fast at first, settling softly. */
export const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A slot partway from one state to the next (angles, radius and each colour channel). */
export function mixSlot(from: SlotState, to: SlotState, t: number): SlotState {
  return {
    start: mix(from.start, to.start, t),
    end: mix(from.end, to.end, t),
    outer: mix(from.outer, to.outer, t),
    rgb: [mix(from.rgb[0], to.rgb[0], t), mix(from.rgb[1], to.rgb[1], t), mix(from.rgb[2], to.rgb[2], t)],
  };
}

/**
 * The SVG path of one ring slice: the outer arc clockwise from `start` to `end`, then the inner arc
 * back, around (cx, cy). Empty for a closed slot. A slice of the whole turn stops a hair short, since
 * an SVG arc cannot end where it starts.
 */
export function slicePath(cx: number, cy: number, inner: number, slot: SlotState, slices: number): string {
  const pad = slices > 1 ? PAD : 0;
  let start = slot.start + pad / 2;
  let end = slot.end - pad / 2;
  if (end - start <= 0.0005) return '';
  if (end - start >= FULL_TURN - 0.0005) end = start + FULL_TURN - 0.0005;
  const point = (radius: number, angle: number) =>
    `${(cx + radius * Math.sin(angle)).toFixed(3)} ${(cy - radius * Math.cos(angle)).toFixed(3)}`;
  const large = end - start > Math.PI ? 1 : 0;
  start = Math.max(0, start);
  return [
    `M${point(slot.outer, start)}`,
    `A${slot.outer.toFixed(3)} ${slot.outer.toFixed(3)} 0 ${String(large)} 1 ${point(slot.outer, end)}`,
    `L${point(inner, end)}`,
    `A${inner.toFixed(3)} ${inner.toFixed(3)} 0 ${String(large)} 0 ${point(inner, start)}`,
    'Z',
  ].join(' ');
}

export const rgbText = ([r, g, b]: readonly [number, number, number]) =>
  `rgb(${String(Math.round(r))} ${String(Math.round(g))} ${String(Math.round(b))})`;

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
