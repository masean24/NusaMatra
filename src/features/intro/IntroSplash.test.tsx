import { act, fireEvent, render, screen } from '@testing-library/react';
import { REDUCED_MOTION_QUERY } from '@/features/motion';
import { setMediaQueryMatches } from '@/test/browserMocks';
import { IntroGate } from './IntroGate';
import { IntroSplash } from './IntroSplash';
import { SPLASH_LETTER_BOXES, SPLASH_LOGO } from './splashLogo';
import { resetIntroForTests } from './useIntroOnce';

const EXIT_MS = 1000;
/** The opening leaves by itself once progress has run: 0.8 s + 1.8 s, plus a frame. */
const AUTO_EXIT_MS = 2620;

const renderCount = vi.fn();

/** The Beranda's part in it: the opening beside a page with its main content. */
function Beranda() {
  renderCount();
  return (
    <>
      <IntroGate />
      <main id="konten-utama" tabIndex={-1}>
        <h1>Beranda</h1>
      </main>
    </>
  );
}

const splash = () => document.querySelector('[data-intro-splash]');
const stage = () => document.documentElement.dataset.intro;

beforeEach(() => {
  vi.useFakeTimers();
  // Each test is a fresh page load on the Beranda; the map's canvas is tested on its own.
  resetIntroForTests('/');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  renderCount.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.intro;
  delete document.documentElement.dataset.displayMode;
});

describe('the opening splash', () => {
  it('plays on the Beranda, over a page that does not scroll, and hides from assistive tech', () => {
    render(<Beranda />);
    expect(splash()).toHaveAttribute('aria-hidden', 'true');
    expect(splash()).toHaveAttribute('data-phase', 'playing');
    expect(stage()).toBe('playing');
    expect(fireEvent.wheel(window)).toBe(false);
    expect(fireEvent.keyDown(window, { key: 'PageDown' })).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('plays again on every refresh of the Beranda, not on coming back within the site', () => {
    const first = render(<Beranda />);
    act(() => {
      vi.advanceTimersByTime(AUTO_EXIT_MS + EXIT_MS);
    });
    expect(splash()).not.toBeInTheDocument();
    first.unmount();

    // Back on the Beranda within the same page load.
    const back = render(<Beranda />);
    expect(splash()).not.toBeInTheDocument();
    expect(stage()).toBeUndefined();
    back.unmount();

    // A refresh is a new page load.
    resetIntroForTests('/');
    render(<Beranda />);
    expect(splash()).toBeInTheDocument();
  });

  it('does not play when the site is loaded on another page', () => {
    resetIntroForTests('/jelajahi');
    render(<Beranda />);
    expect(splash()).not.toBeInTheDocument();
  });

  it('leaves by itself, then gives the page back with the focus and without rendering it again', () => {
    render(<Beranda />);
    act(() => {
      vi.advanceTimersByTime(AUTO_EXIT_MS);
    });
    expect(splash()).toHaveAttribute('data-phase', 'out');

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(splash()).toHaveAttribute('data-phase', 'portal');
    expect(stage()).toBe('leaving');

    act(() => {
      vi.advanceTimersByTime(EXIT_MS);
    });
    expect(splash()).not.toBeInTheDocument();
    expect(stage()).toBe('done');
    expect(fireEvent.wheel(window)).toBe(true);
    expect(screen.getByRole('main')).toHaveFocus();
    expect(renderCount).toHaveBeenCalledTimes(1);
  });

  it('writes progress straight to the page', () => {
    render(<IntroSplash onDone={vi.fn()} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Memetakan nusantara')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    // Halfway through the progress time of 0.8 s to 2.6 s, the second of the three texts.
    expect(screen.getByText(/^(49|50|51)%$/)).toBeInTheDocument();
    expect(screen.getByText('Memuat indikator wilayah')).toBeInTheDocument();
  });

  it.each([
    ['a click anywhere', () => fireEvent.click(splash() as Element)],
    ['Enter', () => fireEvent.keyDown(window, { key: 'Enter' })],
    ['Space', () => fireEvent.keyDown(window, { key: ' ' })],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('%s enters at once, and a second input does not start the exit again', (_, enter) => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    enter();
    expect(splash()).toHaveAttribute('data-phase', 'out');
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
      fireEvent.click(splash() as Element);
      vi.advanceTimersByTime(150);
    });
    expect(splash()).toHaveAttribute('data-phase', 'portal');
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
      vi.advanceTimersByTime(EXIT_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('with reduced motion stands still, complete, for 1.2 s and fades in 0.4 s', () => {
    setMediaQueryMatches(REDUCED_MOTION_QUERY, true);
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    expect(splash()).toHaveAttribute('data-reduced', 'true');
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Menyiapkan ruang kerja')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(splash()).toHaveAttribute('data-phase', 'portal');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('closing early leaves nothing behind: no exit fires later, the page is unlocked', () => {
    const onDone = vi.fn();
    const view = render(<IntroSplash onDone={onDone} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDone).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    render(<Beranda />).unmount();
    expect(fireEvent.wheel(window)).toBe(true);
    expect(stage()).toBeUndefined();
  });

  it.each([
    ['normal', SPLASH_LOGO.normal],
    ['glass', SPLASH_LOGO.glass],
  ])('in %s mode shows that mode’s logo, letter by letter', (mode, logo) => {
    document.documentElement.dataset.displayMode = mode;
    render(<IntroSplash onDone={vi.fn()} />);
    const sources = [...(splash()?.querySelectorAll('img') ?? [])].map((image) => image.getAttribute('src'));
    expect(sources).toEqual([logo.body, logo.sun, ...logo.letters]);
    expect(logo.letters).toHaveLength(SPLASH_LETTER_BOXES.length);
  });
});
