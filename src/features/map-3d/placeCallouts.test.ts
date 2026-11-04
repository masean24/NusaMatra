import { placeCallouts, type CalloutFrame, type CalloutRequest } from './placeCallouts';

const frame = (overrides: Partial<CalloutFrame> = {}): CalloutFrame => ({
  width: 1000,
  height: 600,
  max: 3,
  isFree: () => true,
  ...overrides,
});

const request = (id: string, x: number | null, y: number | null): CalloutRequest => ({
  id,
  x,
  y,
  anchorRadius: 20,
  pinned: false,
  width: 180,
  height: 100,
});

describe('placeCallouts', () => {
  it('centres a card under its anchor, clear of the symbol', () => {
    expect(placeCallouts([request('a', 500, 200)], frame()).get('a')).toEqual({ left: 410, top: 226 });
  });

  it('flips above the anchor when there is no room below, and stays inside the sides', () => {
    expect(placeCallouts([request('a', 20, 560)], frame()).get('a')).toEqual({ left: 8, top: 434 });
  });

  it('skips an anchor behind the camera or off the map', () => {
    const placed = placeCallouts([request('behind', null, null), request('off', 1200, 100)], frame());
    expect(placed.size).toBe(0);
  });

  it('lets the higher priority card go first, and fills the rest up to the limit', () => {
    const placed = placeCallouts(
      [
        request('first', 500, 300),
        request('second', 100, 100),
        request('third', 800, 100),
        request('fourth', 300, 100),
      ],
      frame(),
    );
    expect([...placed.keys()]).toEqual(['first', 'second', 'third']);
  });

  it('keeps other symbols uncovered by moving above its anchor, or waiting', () => {
    const underneath = request('underneath', 500, 300);
    const moved = placeCallouts([request('a', 500, 200), underneath], frame()).get('a');
    expect(moved?.top).toBe(74);

    const hemmed = [request('a', 500, 200), underneath, request('over', 500, 100)];
    expect(placeCallouts(hemmed, frame()).has('a')).toBe(false);
    expect(
      placeCallouts([{ ...request('a', 500, 200), pinned: true }, underneath], frame()).get('a')?.top,
    ).toBe(226);
  });

  it('leaves out a card that a floating panel would cover', () => {
    const placed = placeCallouts(
      [request('under-panel', 100, 100), request('open', 700, 100)],
      frame({ isFree: (left) => left > 400 }),
    );
    expect([...placed.keys()]).toEqual(['open']);
  });
});
