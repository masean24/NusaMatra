export type SheetState = 'collapsed' | 'peek' | 'open';

/** How much of the sheet shows at each resting place, in pixels from the bottom of the screen. */
export type SheetStops = Readonly<Record<SheetState, number>>;

const ORDER: readonly SheetState[] = ['collapsed', 'peek', 'open'];

/** A flick (pixels per millisecond): the sheet goes on to the next stop however far it travelled. */
const FLICK_SPEED = 0.45;

/**
 * Where a released sheet comes to rest. A flick goes to the next stop in its direction, up being
 * positive; a slow release to the nearest stop.
 */
export function snapAfterDrag(visible: number, velocity: number, stops: SheetStops): SheetState {
  if (Math.abs(velocity) >= FLICK_SPEED) {
    const ahead =
      velocity > 0
        ? ORDER.find((state) => stops[state] > visible)
        : [...ORDER].reverse().find((state) => stops[state] < visible);
    if (ahead) return ahead;
  }
  return ORDER.reduce((nearest, state) =>
    Math.abs(stops[state] - visible) < Math.abs(stops[nearest] - visible) ? state : nearest,
  );
}
