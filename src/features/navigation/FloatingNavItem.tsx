import type { FocusEvent, PointerEvent } from 'react';
import { NavLink } from 'react-router';
import { Icon } from '@/components/ui/Icon/Icon';
import { LiquidFill } from './LiquidFill';
import { setLiquidOriginFromIcon, setLiquidOriginFromPointer } from './liquidOrigin';
import type { NavItem } from './navItems';
import styles from './FloatingNavItem.module.css';

interface FloatingNavItemProps {
  readonly item: NavItem;
  readonly filterId: string;
  /** `pill` = desktop floating navbar (49:304); `tab` = mobile bottom tab bar. */
  readonly layout: 'pill' | 'tab';
}

function isFinePointer(event: PointerEvent): boolean {
  // Touch fires pointerenter on tap; only mouse and pen should start the hover liquid.
  return event.pointerType === 'mouse' || event.pointerType === 'pen';
}

/** One navbar destination with the liquid hover/focus/press/active treatment (Figma 49:304). */
export function FloatingNavItem({ item, filterId, layout }: FloatingNavItemProps) {
  const handlePointerEnter = (event: PointerEvent<HTMLAnchorElement>) => {
    if (!isFinePointer(event)) return;
    setLiquidOriginFromPointer(event.currentTarget, event.clientX, event.clientY);
    event.currentTarget.dataset.liquid = 'on';
  };

  const handlePointerLeave = (event: PointerEvent<HTMLAnchorElement>) => {
    const element = event.currentTarget;
    // Drain toward the exit point: the shrinking blob follows the cursor out of the pill.
    setLiquidOriginFromPointer(element, event.clientX, event.clientY);
    delete element.dataset.liquid;
    delete element.dataset.pressed;
  };

  const handlePointerDown = (event: PointerEvent<HTMLAnchorElement>) => {
    // The active fill grows from where the item was pressed, including taps on touch screens.
    setLiquidOriginFromPointer(event.currentTarget, event.clientX, event.clientY);
    event.currentTarget.dataset.pressed = 'true';
  };

  const handlePointerUp = (event: PointerEvent<HTMLAnchorElement>) => {
    delete event.currentTarget.dataset.pressed;
  };

  const handleFocus = (event: FocusEvent<HTMLAnchorElement>) => {
    if (event.currentTarget.matches(':focus-visible')) setLiquidOriginFromIcon(event.currentTarget);
  };

  const content = (
    <>
      <span className={styles.iconAnchor} data-liquid-anchor>
        <Icon name={item.icon} size={18} />
      </span>
      <span className={styles.label}>{item.label}</span>
    </>
  );

  return (
    <NavLink
      to={item.to}
      className={`${styles.item} ${styles[layout]}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onFocus={handleFocus}
    >
      <LiquidFill kind="hover" filterId={filterId} />
      <LiquidFill kind="active" filterId={filterId} />
      <span className={styles.content}>{content}</span>
      {/* The same content in the "on liquid" colour, revealed by a circle that tracks the active
          blob, so the label stays readable on both sides of the liquid edge at every frame. */}
      <span className={`${styles.content} ${styles.onLiquid}`} aria-hidden="true">
        {content}
      </span>
    </NavLink>
  );
}
