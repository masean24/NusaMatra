import { runRouteZoomTransition, zoomStartTransform } from './routeZoomTransition';

type StartViewTransition = (update: () => Promise<void>) => { ready: Promise<void>; finished: Promise<void> };

const card = { left: 100, top: 300, width: 600, height: 80 };

describe('zoomStartTransform', () => {
  it('centres the scaled page on the card, keeping the page proportions', () => {
    expect(zoomStartTransform(card, { width: 1200, height: 800 })).toBe(
      'translate(-200px, -60px) scale(0.5)',
    );
  });

  it('never starts smaller than 30% for tiny sources', () => {
    expect(
      zoomStartTransform({ left: 0, top: 0, width: 20, height: 20 }, { width: 1000, height: 800 }),
    ).toMatch(/scale\(0\.3\)$/);
  });
});

describe('runRouteZoomTransition', () => {
  const root = document.documentElement;

  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    Reflect.deleteProperty(root, 'animate');
  });

  it('navigates directly when the View Transitions API is missing', async () => {
    const navigate = vi.fn();
    await runRouteZoomTransition({ navigate, source: card, reducedMotion: false });
    expect(navigate).toHaveBeenCalledOnce();
    expect(root).not.toHaveAttribute('data-route-transition');
  });

  function installViewTransitions() {
    const modes: (string | null)[] = [];
    const start = vi.fn<StartViewTransition>((update) => {
      modes.push(root.getAttribute('data-route-transition'));
      const done = update();
      return { ready: done, finished: done };
    });
    Object.assign(document, { startViewTransition: start });
    const animate = vi.fn();
    Object.assign(root, { animate });
    return { modes, animate };
  }

  it('zooms the new page out of the card and lets the old page recede', async () => {
    const { modes, animate } = installViewTransitions();
    const navigate = vi.fn();

    await runRouteZoomTransition({ navigate, source: card, reducedMotion: false });

    expect(modes).toEqual(['zoom']);
    expect(navigate).toHaveBeenCalledOnce();
    const targets = animate.mock.calls.map(
      ([, options]) => (options as { pseudoElement: string }).pseudoElement,
    );
    expect(targets).toEqual(['::view-transition-new(root)', '::view-transition-old(root)']);
    const [newPageFrames] = animate.mock.calls[0] as [Keyframe[]];
    expect(newPageFrames[0]).toMatchObject({ opacity: 0 });
    expect(String(newPageFrames[0]?.transform)).toMatch(/^translate\(.+\) scale\(0\.\d+\)$/);
    expect(newPageFrames.at(-1)).toMatchObject({ opacity: 1, transform: 'none' });
    expect(root).not.toHaveAttribute('data-route-transition');
  });

  it('only crossfades for reduced motion: nothing scales', async () => {
    const { modes, animate } = installViewTransitions();

    await runRouteZoomTransition({ navigate: vi.fn(), source: card, reducedMotion: true });

    expect(modes).toEqual(['fade']);
    expect(animate).not.toHaveBeenCalled();
  });
});
