import { SPLASH_DOTS, SPLASH_MAP_HEIGHT, SPLASH_MAP_WIDTH } from './splashDots';
import { startSplashDots } from './splashDotsCanvas';

const arc = vi.fn();

function canvasWithContext(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const context = {
    arc,
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
  };
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as RenderingContext);
  return canvas;
}

beforeEach(() => {
  vi.useFakeTimers();
  arc.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the splash map data', () => {
  it('is about a thousand dots inside the map', () => {
    expect(SPLASH_DOTS.length).toBeGreaterThan(900);
    expect(SPLASH_DOTS.length).toBeLessThan(1200);
    for (const [x, y, coast] of SPLASH_DOTS) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(SPLASH_MAP_WIDTH);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(SPLASH_MAP_HEIGHT);
      expect([0, 1]).toContain(coast);
    }
  });
});

describe('startSplashDots', () => {
  it('still: draws every dot once and runs nothing after', () => {
    startSplashDots(canvasWithContext(), true);
    expect(arc).toHaveBeenCalledTimes(SPLASH_DOTS.length);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts from nothing, reaches every dot, and stops its frames when all have settled', () => {
    startSplashDots(canvasWithContext(), false);
    vi.advanceTimersByTime(50);
    expect(arc).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3200);
    expect(vi.getTimerCount()).toBe(0);
    arc.mockClear();
    vi.advanceTimersByTime(1000);
    expect(arc).not.toHaveBeenCalled();
  });

  it('stops at once when asked', () => {
    const stop = startSplashDots(canvasWithContext(), false);
    vi.advanceTimersByTime(500);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing where the canvas has no 2D context', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    startSplashDots(canvas, false)();
    expect(vi.getTimerCount()).toBe(0);
  });
});
