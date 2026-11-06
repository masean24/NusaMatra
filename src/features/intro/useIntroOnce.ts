import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

/** The Beranda's address: the opening plays only when the site is loaded there. */
const BERANDA_PATH = '/';

/**
 * Stage of the opening, on <html data-intro>. CSS hides the Beranda's page under it ("playing"),
 * brings the page in through the portal ("leaving"), and keeps its own load entrance from playing
 * behind the opening or after it (any stage, until the Beranda unmounts).
 */
export type IntroStage = 'playing' | 'leaving' | 'done';

export function setIntroStage(stage: IntroStage | null): void {
  const root = document.documentElement;
  if (stage) root.dataset.intro = stage;
  else delete root.dataset.intro;
}

/**
 * Whether this page load still owes the opening: true when the site was opened or refreshed on the
 * Beranda, until it has played. Module state, so a refresh starts it again while moving between pages
 * inside the site does not.
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
 * Whether the opening plays, decided before the first paint so the Beranda never shows and then
 * disappears. While it plays the page under it is inert and does not scroll; `finish` (called when
 * the overlay is gone) returns focus to the content.
 */
export function useIntroOnce(): { readonly playing: boolean; readonly finish: () => void } {
  // Read here, spent in the effect: StrictMode runs this initializer twice.
  const [playing, setPlaying] = useState(() => introPending);
  const [finished, setFinished] = useState(false);

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

  // Leaving the Beranda must not leave the stage behind on the next page.
  useEffect(
    () => () => {
      setIntroStage(null);
    },
    [],
  );

  const finish = useCallback(() => {
    setIntroStage('done');
    setPlaying(false);
    setFinished(true);
  }, []);

  // After the page is no longer inert (the layout effect above has cleaned up).
  useEffect(() => {
    if (finished) document.getElementById('konten-utama')?.focus({ preventScroll: true });
  }, [finished]);

  return { playing, finish };
}
