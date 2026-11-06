import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * How long the Beranda entrance runs after the overlay has gone: the last step (the buttons) starts
 * 0.55 s + 0.4 s after the curtain begins and lasts 1.1 s, and the overlay leaves at 1.18 s.
 */
const ENTRANCE_TAIL_MS = 550 + 400 + 1100 - 1180;

/** The Beranda's address: the opening plays only when the site is loaded there. */
const BERANDA_PATH = '/';

/**
 * Stage of the opening, on <html data-intro>, where CSS holds back the Beranda elements marked
 * `data-intro-step` ("playing"), lets them in one after another ("leaving"), and then keeps their
 * own load entrance from playing a second time ("done", until the Beranda unmounts).
 */
export type IntroStage = 'playing' | 'leaving' | 'done';

export function setIntroStage(stage: IntroStage | null): void {
  const root = document.documentElement;
  if (stage) root.dataset.intro = stage;
  else delete root.dataset.intro;
}

/**
 * Whether this page load still owes the opening: true when the site was opened or reloaded on the
 * Beranda, until the opening has played. Module state, so a reload starts it again while moving
 * between pages inside the site does not.
 */
let introPending = window.location.pathname === BERANDA_PATH;

/** For tests: start a fresh page load at `path`. */
export function resetIntroForTests(path = BERANDA_PATH): void {
  introPending = path === BERANDA_PATH;
}

/** Keys that scroll the page (Space too, though the opening also takes it as "enter"). */
const SCROLL_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

/**
 * Keeps the page from scrolling under the overlay by refusing the scroll itself (wheel, touch,
 * keys, and a dragged scrollbar is put back), not with `overflow: hidden`: hiding the scrollbar and
 * bringing it back when the overlay leaves would make every fixed layer (the background, the
 * navbar) jump sideways by the scrollbar's width just as the Beranda comes in.
 */
function lockScroll(): () => void {
  const x = window.scrollX;
  const y = window.scrollY;
  const refuse = (event: Event) => {
    event.preventDefault();
  };
  const refuseKeys = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) event.preventDefault();
  };
  const hold = () => {
    window.scrollTo(x, y);
  };
  window.addEventListener('wheel', refuse, { passive: false });
  window.addEventListener('touchmove', refuse, { passive: false });
  window.addEventListener('keydown', refuseKeys);
  window.addEventListener('scroll', hold);
  return () => {
    window.removeEventListener('wheel', refuse);
    window.removeEventListener('touchmove', refuse);
    window.removeEventListener('keydown', refuseKeys);
    window.removeEventListener('scroll', hold);
  };
}

/**
 * Whether the Garis Pantai opening plays: every time the site is loaded or reloaded on the Beranda,
 * decided before the first paint so the Beranda never shows and then disappears; not when the
 * Beranda is reached from another page of the site. While it plays the page under it is inert and
 * does not scroll; `finish` (called when the overlay is gone) returns focus to the content.
 */
export function useIntroOnce(): { readonly playing: boolean; readonly finish: () => void } {
  // Read here, spent in the effect: StrictMode runs this initializer twice.
  const [playing, setPlaying] = useState(() => introPending);
  const tailTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!playing) return;
    introPending = false;
    setIntroStage('playing');
    const app = document.getElementById('root');
    if (app) app.inert = true;
    const unlock = lockScroll();
    return () => {
      unlock();
      if (app) app.inert = false;
    };
  }, [playing]);

  // Leaving the Beranda mid-entrance must not leave its elements held back on the next visit.
  useEffect(
    () => () => {
      window.clearTimeout(tailTimer.current);
      setIntroStage(null);
    },
    [],
  );

  const finish = useCallback(() => {
    setPlaying(false);
    tailTimer.current = window.setTimeout(() => {
      setIntroStage('done');
    }, ENTRANCE_TAIL_MS);
  }, []);

  // After the page is no longer inert (the layout effect above has cleaned up).
  useEffect(() => {
    if (playing || tailTimer.current === undefined) return;
    document.getElementById('konten-utama')?.focus({ preventScroll: true });
  }, [playing]);

  return { playing, finish };
}
