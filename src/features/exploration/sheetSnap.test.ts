import { snapAfterDrag } from './sheetSnap';

const stops = { collapsed: 130, peek: 420, open: 780 };

describe('snapAfterDrag', () => {
  it('rests at the nearest stop after a slow release', () => {
    expect(snapAfterDrag(200, 0, stops)).toBe('collapsed');
    expect(snapAfterDrag(350, 0, stops)).toBe('peek');
    expect(snapAfterDrag(500, 0.1, stops)).toBe('peek');
    expect(snapAfterDrag(700, -0.1, stops)).toBe('open');
  });

  it('goes on to the next stop in the direction of a flick', () => {
    expect(snapAfterDrag(140, 0.8, stops)).toBe('peek');
    expect(snapAfterDrag(430, 0.8, stops)).toBe('open');
    expect(snapAfterDrag(760, -0.8, stops)).toBe('peek');
    expect(snapAfterDrag(410, -0.8, stops)).toBe('collapsed');
  });

  it('stays at the end when a flick has nowhere further to go', () => {
    expect(snapAfterDrag(780, 2, stops)).toBe('open');
    expect(snapAfterDrag(130, -2, stops)).toBe('collapsed');
  });
});
