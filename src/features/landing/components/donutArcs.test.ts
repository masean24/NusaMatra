import {
  MAX_SLICES,
  cubicOut,
  hexToRgb,
  mixSlot,
  rgbText,
  slicePath,
  targetSlots,
  type SlotState,
} from './donutArcs';
import { SERIES_HEX, seriesRgb } from './seriesPalette';

const palette = seriesRgb('normal');
const slices = [
  { id: 'a', name: 'A', bps: 5000 },
  { id: 'b', name: 'B', bps: 3000 },
  { id: 'c', name: 'C', bps: 2000 },
];

describe('weight ring geometry', () => {
  it('lays the slices end to end from twelve o’clock and closes the unused slots at the end of the turn', () => {
    const slots = targetSlots(slices, null, palette, 96, 7);
    expect(slots).toHaveLength(MAX_SLICES);
    expect(slots[0]?.start).toBe(0);
    expect(slots[0]?.end).toBeCloseTo(Math.PI); // half the ring
    expect(slots[1]?.start).toBeCloseTo(Math.PI);
    expect(slots[2]?.end).toBeCloseTo(2 * Math.PI);
    for (const closed of slots.slice(3)) {
      expect(closed.start).toBeCloseTo(2 * Math.PI);
      expect(closed.end).toBeCloseTo(2 * Math.PI);
    }
  });

  it('lifts the slice in focus by 7, or the largest when none is', () => {
    expect(targetSlots(slices, null, palette, 96, 7).map((slot) => slot.outer)).toEqual([
      103, 96, 96, 96, 96,
    ]);
    expect(targetSlots(slices, 'c', palette, 96, 7).map((slot) => slot.outer)).toEqual([96, 96, 103, 96, 96]);
  });

  it('glides angles, radius and each colour channel together', () => {
    const from: SlotState = { start: 0, end: 1, outer: 96, rgb: [0, 0, 0] };
    const to: SlotState = { start: 1, end: 3, outer: 103, rgb: [200, 100, 50] };
    expect(mixSlot(from, to, 0.5)).toEqual({ start: 0.5, end: 2, outer: 99.5, rgb: [100, 50, 25] });
    expect(cubicOut(0)).toBe(0);
    expect(cubicOut(1)).toBe(1);
    expect(cubicOut(0.5)).toBeCloseTo(0.875);
  });

  it('draws a closed slot as nothing and a whole-ring slice without ending where it starts', () => {
    expect(
      slicePath(110, 110, 64, { start: 2 * Math.PI, end: 2 * Math.PI, outer: 96, rgb: [0, 0, 0] }, 3),
    ).toBe('');
    const whole = slicePath(110, 110, 64, { start: 0, end: 2 * Math.PI, outer: 96, rgb: [0, 0, 0] }, 1);
    expect(whole.startsWith('M110.000 14.000')).toBe(true); // top of the outer ring
    expect(whole).toContain(' 0 1 1 ');
  });

  it('keeps the series in the site’s colour line', () => {
    expect(SERIES_HEX.normal.slice(0, 2)).toEqual(['#ff8a3d', '#2f5bff']); // accent, sea
    expect(hexToRgb('#ff8a3d')).toEqual([255, 138, 61]);
    expect(rgbText([255, 138.4, 61])).toBe('rgb(255 138 61)');
  });
});
