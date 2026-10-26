import type { PointerEvent } from 'react';
import { NavLink } from 'react-router';
import type { NavItem } from './navItems';
import styles from './FloatingNavItem.module.css';

interface FloatingNavItemProps {
  readonly item: NavItem;
  /** `pill` = desktop floating navbar (49:304); `tab` = mobile bottom tab bar. */
  readonly layout: 'pill' | 'tab';
  /** The shared selection pill is on this item (hovered, focused or current), so it reads on it. */
  readonly targeted: boolean;
  readonly onFocusPreview: () => void;
  readonly onPointerPreview: (event: PointerEvent<HTMLAnchorElement>) => void;
}

/** One navbar destination. The selection pill is owned by `NavLinkList`, not by the item. */
export function FloatingNavItem({
  item,
  layout,
  targeted,
  onFocusPreview,
  onPointerPreview,
}: FloatingNavItemProps) {
  return (
    <NavLink
      to={item.to}
      className={`${styles.item} ${styles[layout]}`}
      data-nav-key={item.to}
      data-targeted={targeted ? 'true' : undefined}
      onPointerEnter={onPointerPreview}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) onFocusPreview();
      }}
    >
      <span className={styles.content}>{item.label}</span>
    </NavLink>
  );
}
