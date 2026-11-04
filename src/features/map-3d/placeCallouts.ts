/** One card that wants a place on the map, in priority order; sizes and positions in CSS pixels. */
export interface CalloutRequest {
  readonly id: string;
  /** The anchor on screen; null when it is behind the camera. */
  readonly x: number | null;
  readonly y: number | null;
  /** How far the anchor's own symbol reaches, so the card starts clear of it. */
  readonly anchorRadius: number;
  /** The one the user chose: shown even over other symbols. */
  readonly pinned: boolean;
  readonly width: number;
  readonly height: number;
}

export interface PlacedCallout {
  readonly left: number;
  readonly top: number;
}

export interface CalloutFrame {
  readonly width: number;
  readonly height: number;
  /** At most this many cards show at once. */
  readonly max: number;
  /** False where a panel floats over the map, so a card is never half hidden behind it. */
  readonly isFree: (left: number, top: number, width: number, height: number) => boolean;
}

const EDGE_GAP = 8;
const ANCHOR_GAP = 6;
const CARD_GAP = 8;

/**
 * Gives each card, highest priority first, a spot under its anchor, or over it when that is taken.
 * A spot must stay on the map, clear of cards already placed, of panels and of other symbols, which
 * must stay clickable. A card without one waits; its anchor is still on the map, and every event
 * stays reachable through the list.
 */
export function placeCallouts(
  requests: readonly CalloutRequest[],
  frame: CalloutFrame,
): ReadonlyMap<string, PlacedCallout> {
  const placed = new Map<string, PlacedCallout>();
  const boxes: { left: number; top: number; right: number; bottom: number }[] = [];

  for (const request of requests) {
    if (placed.size >= frame.max) break;
    const { x, y, anchorRadius, width, height } = request;
    if (x === null || y === null || x < 0 || y < 0 || x > frame.width || y > frame.height) continue;

    const left = Math.min(Math.max(x - width / 2, EDGE_GAP), frame.width - width - EDGE_GAP);
    const right = left + width;
    const tops = [y + anchorRadius + ANCHOR_GAP, y - anchorRadius - ANCHOR_GAP - height];
    const top = tops.find((candidate) => {
      const bottom = candidate + height;
      if (candidate < EDGE_GAP || bottom > frame.height - EDGE_GAP) return false;
      const overlapsCard = boxes.some(
        (box) =>
          left < box.right + CARD_GAP &&
          right + CARD_GAP > box.left &&
          candidate < box.bottom + CARD_GAP &&
          bottom + CARD_GAP > box.top,
      );
      if (overlapsCard) return false;
      const coversSymbol =
        !request.pinned &&
        requests.some(
          (other) =>
            other !== request &&
            other.x !== null &&
            other.y !== null &&
            other.x + other.anchorRadius > left &&
            other.x - other.anchorRadius < right &&
            other.y + other.anchorRadius > candidate &&
            other.y - other.anchorRadius < bottom,
        );
      return !coversSymbol && frame.isFree(left, candidate, width, height);
    });
    if (top === undefined) continue;

    boxes.push({ left, top, right, bottom: top + height });
    placed.set(request.id, { left, top });
  }
  return placed;
}
