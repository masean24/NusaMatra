import { useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useRefractiveGlass } from '@/lib/glass';
import { Logo } from '@/components/brand/Logo';
import { prefersReducedMotion } from '@/features/motion';
import { DisplayModeSwitch } from '@/features/theme';
import { LanguageSwitch } from './LanguageSwitch';
import { NavLinkList } from './NavLinkList';
import { useCompactOnScroll } from './useCompactOnScroll';
import styles from './FloatingNavbar.module.css';
import { t } from '@/lib/i18n';

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
      aria-label={t('Nusa Matra — Beranda')}
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
      {/* data-intro-step: each bar rises into place as the Beranda's opening lifts (features/intro). */}
      <div ref={desktopRef} className={`${styles.bar} ${styles.desktop}`} data-intro-step="rise">
        <HomeLink />
        <span className={styles.divider} aria-hidden="true" />
        <nav aria-label={t('Navigasi utama')}>
          <NavLinkList layout="pill" />
        </nav>
        <span className={styles.divider} aria-hidden="true" />
        <LanguageSwitch />
        <DisplayModeSwitch />
      </div>

      <div ref={compactRef} className={`${styles.bar} ${styles.compactTop}`} data-intro-step="rise">
        <HomeLink />
        <span className={styles.compactControls}>
          <LanguageSwitch />
          <DisplayModeSwitch size="compact" />
        </span>
      </div>

      <nav
        ref={tabBarRef}
        aria-label={t('Navigasi utama')}
        className={`${styles.bar} ${styles.tabBar}`}
        data-intro-step="rise"
      >
        <NavLinkList layout="tab" />
      </nav>
    </header>
  );
}
