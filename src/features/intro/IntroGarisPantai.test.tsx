import { act, fireEvent, render, screen } from '@testing-library/react';
import { REDUCED_MOTION_QUERY } from '@/features/motion';
import { setMediaQueryMatches } from '@/test/browserMocks';
import { IntroGarisPantai } from './IntroGarisPantai';
import { COASTLINE_ISLANDS, COASTLINE_VIEWBOX } from './introCoastline';
import { resetIntroForTests, useIntroOnce } from './useIntroOnce';

const DIALOG_NAME = 'Pembuka Nusa Matra. Tekan Enter untuk masuk.';

/** The Beranda's part in it: the opening over a page with its main content. */
function Beranda() {
  const intro = useIntroOnce();
  return (
    <>
      {intro.playing && <IntroGarisPantai onDone={intro.finish} />}
      <main id="konten-utama" tabIndex={-1}>
        <h1>Beranda</h1>
      </main>
    </>
  );
}

const dialog = () => screen.queryByRole('dialog', { name: DIALOG_NAME });

beforeEach(() => {
  vi.useFakeTimers();
  // Each test is a fresh page load on the Beranda.
  resetIntroForTests('/');
});

afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.intro;
});

describe('Garis Pantai opening', () => {
  it('plays when the site is loaded on the Beranda, not again on coming back within the site', () => {
    const first = render(<Beranda />);
    expect(dialog()).toBeInTheDocument();
    expect(dialog()).toHaveFocus();
    expect(document.documentElement.dataset.intro).toBe('playing');
    // The page does not scroll under it, and the scrollbar is left in place (no sideways jump later).
    expect(fireEvent.wheel(window)).toBe(false);
    expect(fireEvent.keyDown(window, { key: 'PageDown' })).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
    first.unmount();

    render(<Beranda />);
    expect(dialog()).not.toBeInTheDocument();
  });

  it('plays again on a reload of the Beranda', () => {
    render(<Beranda />).unmount();
    resetIntroForTests('/');
    render(<Beranda />);
    expect(dialog()).toBeInTheDocument();
  });

  it('does not play when the site is loaded on another page', () => {
    resetIntroForTests('/jelajahi');
    render(<Beranda />);
    expect(dialog()).not.toBeInTheDocument();
  });

  it('leaves by itself at 4.7 s, lifts in 1.18 s, then gives the page back', () => {
    render(<Beranda />);
    act(() => {
      vi.advanceTimersByTime(4700);
    });
    expect(dialog()).toHaveAttribute('data-phase', 'leaving');
    expect(document.documentElement.dataset.intro).toBe('leaving');

    act(() => {
      vi.advanceTimersByTime(1180);
    });
    expect(dialog()).not.toBeInTheDocument();
    expect(fireEvent.wheel(window)).toBe(true);
    expect(screen.getByRole('main')).toHaveFocus();

    // The Beranda entrance finishes, and its own load entrance is kept from replaying.
    act(() => {
      vi.advanceTimersByTime(870);
    });
    expect(document.documentElement.dataset.intro).toBe('done');
  });

  it.each([
    ['a click anywhere', () => fireEvent.click(screen.getByRole('dialog'))],
    ['Enter', () => fireEvent.keyDown(window, { key: 'Enter' })],
    ['Space', () => fireEvent.keyDown(window, { key: ' ' })],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('%s enters at once, and a second input does not start the exit again', (_, enter) => {
    const onDone = vi.fn();
    render(<IntroGarisPantai onDone={onDone} />);
    enter();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-phase', 'leaving');
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
      fireEvent.click(screen.getByRole('dialog'));
      vi.advanceTimersByTime(1180);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('with reduced motion shows the still opening for 1.2 s and fades it in 0.4 s', () => {
    setMediaQueryMatches(REDUCED_MOTION_QUERY, true);
    const onDone = vi.fn();
    render(<IntroGarisPantai onDone={onDone} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-reduced', 'true');

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole('dialog')).toHaveAttribute('data-phase', 'leaving');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('closing early leaves nothing behind: no exit fires later, the page is unlocked', () => {
    const onDone = vi.fn();
    const view = render(<IntroGarisPantai onDone={onDone} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onDone).not.toHaveBeenCalled();

    render(<Beranda />).unmount();
    expect(fireEvent.wheel(window)).toBe(true);
    expect(document.documentElement.dataset.intro).toBeUndefined();
  });

  it('draws every island, west to east', () => {
    render(<IntroGarisPantai onDone={vi.fn()} />);
    const svg = screen.getByRole('dialog').querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', COASTLINE_VIEWBOX);
    const islands = [...screen.getByRole('dialog').querySelectorAll('path[pathLength="1"]')];
    expect(islands).toHaveLength(COASTLINE_ISLANDS.length);

    // Rendered in the order of COASTLINE_ISLANDS, each delayed by its western edge.
    const delays = islands.map((path) => parseFloat((path as SVGPathElement).style.animationDelay));
    const westmost = COASTLINE_ISLANDS.reduce((a, b) => (b.x < a.x ? b : a));
    const eastmost = COASTLINE_ISLANDS.reduce((a, b) => (b.x > a.x ? b : a));
    const westDelay = delays[COASTLINE_ISLANDS.indexOf(westmost)];
    const eastDelay = delays[COASTLINE_ISLANDS.indexOf(eastmost)];
    expect(westDelay).toBeCloseTo(0.35 + (westmost.x / 960) * 0.9, 3);
    expect(eastDelay).toBeGreaterThan(westDelay ?? Infinity);
    expect(eastDelay).toBeLessThanOrEqual(1.25);
  });
});
