import { useEffect, useRef, type RefObject } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { FloatingNavbar } from '@/features/navigation';
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

export function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  useRouteFocus(mainRef);

  return (
    <>
      <a href="#konten-utama" className={styles.skipLink}>
        Lewati ke konten utama
      </a>
      <FloatingNavbar />
      <main id="konten-utama" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollRestoration getKey={(location) => location.pathname} />
    </>
  );
}
