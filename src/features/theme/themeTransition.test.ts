import { runThemeTransition } from './themeTransition';

describe('runThemeTransition without the View Transitions API', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('paints the new theme under a timed CSS crossfade instead of a hard cut', async () => {
    const apply = vi.fn();
    const root = document.documentElement;

    const done = runThemeTransition({ apply, originX: 10, originY: 10, reducedMotion: false });

    expect(apply).toHaveBeenCalledOnce();
    expect(root).toHaveAttribute('data-theme-transition', 'crossfade');
    expect(root.style.getPropertyValue('--theme-transition-duration')).toBe('0.75s');

    await vi.advanceTimersByTimeAsync(750);
    await done;
    expect(root).not.toHaveAttribute('data-theme-transition');
    expect(root.style.getPropertyValue('--theme-transition-duration')).toBe('');
  });

  it('shortens the crossfade to 200ms for reduced motion', async () => {
    const done = runThemeTransition({ apply: vi.fn(), originX: 0, originY: 0, reducedMotion: true });
    expect(document.documentElement.style.getPropertyValue('--theme-transition-duration')).toBe('0.2s');
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(document.documentElement).not.toHaveAttribute('data-theme-transition');
  });
});
