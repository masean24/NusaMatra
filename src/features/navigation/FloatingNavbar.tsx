import { useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useRefractiveGlass } from '@/lib/glass';
import { Logo } from '@/components/brand/Logo';
import { prefersReducedMotion } from '@/features/motion';
import { DisplayModeSwitch } from '@/features/theme';
import { NavLinkList } from './NavLinkList';
import { useCompactOnScroll } from './useCompactOnScroll';
import styles from './FloatingNavbar.module.css';

/**
 * The brand, linking home. Already on the home page, it glides back to the very top (owner
 * decision 2026-10-28) instead of doing nothing; reduced motion jumps.
 */
function HomeLink() {
  const { pathname } = useLocation();
  return (
    <Link
      to="/"
      className={styles.home}
      aria-label="Nusa Matra — Beranda"
      onClick={(event) => {
        if (pathname !== '/') return;
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        if (window.location.hash) window.history.replaceState(window.history.state, '', '/');
      }}
    >
      <Logo size="nav" surface="auto" />
    </Link>
  );
}

/**
 * Figma 49:447: floating, fixed 16px from the top, centred. On narrow screens Figma turns it
 * into a bottom tab bar; the brand and mode switch stay in a compact top bar.
 * Both layouts are rendered and swapped in CSS, so the hidden one leaves the accessibility tree.
 * Each link list owns one sliding selection pill (see NavLinkList).
 */
export function FloatingNavbar() {
  const desktopRef = useRef<HTMLDivElement>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLElement>(null);
  useRefractiveGlass(desktopRef);
  useRefractiveGlass(compactRef);
  useRefractiveGlass(tabBarRef);
  useCompactOnScroll(desktopRef);

  return (
    <header className={styles.header}>
      <div ref={desktopRef} className={`${styles.bar} ${styles.desktop}`}>
        <HomeLink />
        <span className={styles.divider} aria-hidden="true" />
        <nav aria-label="Navigasi utama">
          <NavLinkList layout="pill" />
        </nav>
        <span className={styles.divider} aria-hidden="true" />
        <DisplayModeSwitch />
      </div>

      <div ref={compactRef} className={`${styles.bar} ${styles.compactTop}`}>
        <HomeLink />
        <DisplayModeSwitch size="compact" />
      </div>

      <nav ref={tabBarRef} aria-label="Navigasi utama" className={`${styles.bar} ${styles.tabBar}`}>
        <NavLinkList layout="tab" />
      </nav>
    </header>
  );
}
