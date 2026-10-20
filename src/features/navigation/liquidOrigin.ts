/**
 * Where the liquid starts inside a nav item, stored as CSS custom properties on the item so
 * the effect runs entirely in CSS: no React state changes on pointer movement.
 */
export function setLiquidOrigin(element: HTMLElement, x: number, y: number): void {
  element.style.setProperty('--liquid-x', `${Math.round(x)}px`);
  element.style.setProperty('--liquid-y', `${Math.round(y)}px`);
}

export function setLiquidOriginFromPointer(element: HTMLElement, clientX: number, clientY: number): void {
  const box = element.getBoundingClientRect();
  setLiquidOrigin(element, clientX - box.left, clientY - box.top);
}

/** Keyboard focus has no pointer: the liquid grows from the icon, as the brief specifies. */
export function setLiquidOriginFromIcon(element: HTMLElement): void {
  const icon = element.querySelector('[data-liquid-anchor]');
  const box = element.getBoundingClientRect();
  if (!icon) {
    setLiquidOrigin(element, box.width / 2, box.height / 2);
    return;
  }
  const iconBox = icon.getBoundingClientRect();
  setLiquidOrigin(
    element,
    iconBox.left - box.left + iconBox.width / 2,
    iconBox.top - box.top + iconBox.height / 2,
  );
}
