import { motion } from 'motion/react';
import { useRef, useState, type PointerEvent } from 'react';
import { matchPath, useLocation } from 'react-router';
import { FloatingNavItem } from './FloatingNavItem';
import { PRIMARY_NAV_ITEMS } from './navItems';
import { useSlidingIndicator } from './useSlidingIndicator';
import styles from './NavLinkList.module.css';

interface NavLinkListProps {
  /** `pill` = desktop floating navbar (49:304); `tab` = mobile bottom tab bar. */
  readonly layout: 'pill' | 'tab';
}

function isFinePointer(event: PointerEvent): boolean {
  // Touch fires pointerenter on tap; only mouse and pen preview before they commit.
  return event.pointerType === 'mouse' || event.pointerType === 'pen';
}

/**
 * The navigation links with ONE selection pill behind them. The pill rests on the current route,
 * glides to the hovered or keyboard-focused item as a preview (hover never navigates), and returns
 * when the pointer leaves. Clicking only changes the route; the pill is already there.
 */
export function NavLinkList({ layout }: NavLinkListProps) {
  const { pathname } = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const [previewTo, setPreviewTo] = useState<string | null>(null);

  const activeTo =
    PRIMARY_NAV_ITEMS.find((item) => matchPath({ path: item.to, end: false }, pathname))?.to ?? null;
  const targetTo = previewTo ?? activeTo;
  const isPreview = previewTo !== null && previewTo !== activeTo;

  const { x, width, opacity } = useSlidingIndicator(rootRef, pillRef, targetTo);

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${styles[layout]}`}
      role="presentation" /* hover/blur bookkeeping only; the links inside are the interactive elements */
      data-preview={isPreview ? 'true' : undefined}
      onPointerLeave={(event) => {
        if (isFinePointer(event)) setPreviewTo(null);
      }}
      onBlur={(event) => {
        // Focus leaving the list altogether, not moving between its links.
        if (!event.currentTarget.contains(event.relatedTarget)) setPreviewTo(null);
      }}
    >
      <motion.span
        ref={pillRef}
        aria-hidden="true"
        data-nav-indicator=""
        className={styles.indicator}
        style={{ x, width, opacity }}
      />
      <ul role="list" className={styles.list}>
        {PRIMARY_NAV_ITEMS.map((item) => (
          <li key={item.to} className={styles.cell}>
            <FloatingNavItem
              item={item}
              layout={layout}
              targeted={item.to === targetTo}
              onFocusPreview={() => {
                setPreviewTo(item.to);
              }}
              onPointerPreview={(event) => {
                if (isFinePointer(event)) setPreviewTo(item.to);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
