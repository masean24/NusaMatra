import { useId } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { DisplayModeSwitch } from '@/features/theme';
import { FloatingNavItem } from './FloatingNavItem';
import { PRIMARY_NAV_ITEMS } from './navItems';
import styles from './FloatingNavbar.module.css';

/**
 * Figma 49:447: floating, fixed 16px from the top, centred. On narrow screens Figma turns it
 * into a bottom tab bar; the brand and mode switch stay in a compact top bar.
 * Both layouts are rendered and swapped in CSS, so the hidden one leaves the accessibility tree.
 */
export function FloatingNavbar() {
  const filterId = useId();

  return (
    <header className={styles.header}>
      {/* One shared "gooey" filter for every liquid nav item: blur, then a hard alpha threshold. */}
      <svg className={styles.filterDefs} aria-hidden="true" focusable="false">
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
        </filter>
      </svg>

      <div className={`${styles.bar} ${styles.desktop}`}>
        <Link to="/" className={styles.home} aria-label="Nusa Matra — Beranda">
          <Logo size="nav" surface="auto" />
        </Link>
        <span className={styles.divider} aria-hidden="true" />
        <nav aria-label="Navigasi utama">
          <ul role="list" className={styles.items}>
            {PRIMARY_NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <FloatingNavItem item={item} filterId={filterId} layout="pill" />
              </li>
            ))}
          </ul>
        </nav>
        <span className={styles.divider} aria-hidden="true" />
        <DisplayModeSwitch />
      </div>

      <div className={`${styles.bar} ${styles.compactTop}`}>
        <Link to="/" className={styles.home} aria-label="Nusa Matra — Beranda">
          <Logo size="nav" surface="auto" />
        </Link>
        <DisplayModeSwitch size="compact" />
      </div>

      <nav aria-label="Navigasi utama" className={`${styles.bar} ${styles.tabBar}`}>
        <ul role="list" className={styles.tabItems}>
          {PRIMARY_NAV_ITEMS.map((item) => (
            <li key={item.to} className={styles.tabCell}>
              <FloatingNavItem item={item} filterId={filterId} layout="tab" />
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
