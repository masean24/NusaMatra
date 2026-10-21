import { useRef } from 'react';
import { Link } from 'react-router';
import { useRefractiveGlass } from '@/lib/glass';
import { Logo } from '@/components/brand/Logo';
import { DisplayModeSwitch } from '@/features/theme';
import { NavLinkList } from './NavLinkList';
import styles from './FloatingNavbar.module.css';

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

  return (
    <header className={styles.header}>
      <div ref={desktopRef} className={`${styles.bar} ${styles.desktop}`}>
        <Link to="/" className={styles.home} aria-label="Nusa Matra — Beranda">
          <Logo size="nav" surface="auto" />
        </Link>
        <span className={styles.divider} aria-hidden="true" />
        <nav aria-label="Navigasi utama">
          <NavLinkList layout="pill" />
        </nav>
        <span className={styles.divider} aria-hidden="true" />
        <DisplayModeSwitch />
      </div>

      <div ref={compactRef} className={`${styles.bar} ${styles.compactTop}`}>
        <Link to="/" className={styles.home} aria-label="Nusa Matra — Beranda">
          <Logo size="nav" surface="auto" />
        </Link>
        <DisplayModeSwitch size="compact" />
      </div>

      <nav ref={tabBarRef} aria-label="Navigasi utama" className={`${styles.bar} ${styles.tabBar}`}>
        <NavLinkList layout="tab" />
      </nav>
    </header>
  );
}
