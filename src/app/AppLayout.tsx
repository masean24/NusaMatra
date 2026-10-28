import { Suspense, useEffect, useRef, ViewTransition, type RefObject } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { AppBackground } from '@/components/layout/AppBackground';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { FloatingNavbar } from '@/features/navigation';
import { useScrollbarCompensation } from '@/hooks/useScrollbarCompensation';
import { useSmoothHashLinks } from '@/hooks/useSmoothHashLinks';
import styles from './AppLayout.module.css';

/**
 * After a client-side navigation: jump to a `#hash` target if there is one, otherwise move focus
 * to <main> so screen-reader and keyboard users start at the new page's content.
 */
function useRouteFocus(mainRef: RefObject<HTMLElement | null>) {
  const { pathname, hash } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!hash) return;
    }
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, hash, mainRef]);
}

/** View-transition classes of a page change; the animations live in global.css. */
const PAGE_ENTER = 'nm-page-enter';
const PAGE_EXIT = 'nm-page-exit';

/** Pages that fill the viewport as an application surface and have no footer under them. */
const FULL_SCREEN_ROUTES: ReadonlySet<string> = new Set(['/jelajahi']);

export function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useRouteFocus(mainRef);
  useScrollbarCompensation(pathname);
  useSmoothHashLinks();

  return (
    <>
      <AppBackground />
      <a href="#konten-utama" className={styles.skipLink}>
        Lewati ke konten utama
      </a>
      {/* navSlot: the navbar gets its own layer during a page change (AppLayout.module.css). */}
      <div className={`${styles.screenOnly} ${styles.navSlot}`}>
        <FloatingNavbar />
      </div>
      <main id="konten-utama" ref={mainRef} tabIndex={-1} className={styles.main}>
        {/*
         * Page change (see global.css): the old page fades out lifting slightly, the new one rises in.
         * Keyed by path, so query changes inside a page (a selected region, a filter) never animate.
         * Browsers without View Transitions keep the short CSS fade.
         */}
        <ViewTransition key={pathname} enter={PAGE_ENTER} exit={PAGE_EXIT} default="none">
          <div className={styles.routeEnter}>
            {/* Feature pages load per route (router.tsx); main keeps one screen of height meanwhile. */}
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </ViewTransition>
      </main>
      {/* Full-screen application pages (the Jelajahi map) end at the viewport, without the footer. */}
      {!FULL_SCREEN_ROUTES.has(pathname) && (
        <div className={styles.screenOnly}>
          <ViewTransition key={pathname} enter={PAGE_ENTER} exit={PAGE_EXIT} default="none">
            <SiteFooter />
          </ViewTransition>
        </div>
      )}
      <ScrollRestoration getKey={(location) => location.pathname} />
    </>
  );
}
