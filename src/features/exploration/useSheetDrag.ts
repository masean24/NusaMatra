import { useEffect, useRef, type RefObject } from 'react';
import { snapAfterDrag, type SheetState, type SheetStops } from './sheetSnap';

/** Below this travel a mouse press on the handle is a click, not a drag. */
const MOUSE_DRAG_SLOP_PX = 4;
/** No move for this long before the release: the finger had stopped, so it is no flick. */
const REST_AFTER_MS = 90;

/** What a stop's custom property comes to in pixels; it mixes dvh, safe areas and the tab bar. */
function resolveLength(host: HTMLElement, name: string): number {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;height:var(${name})`;
  host.append(probe);
  const height = probe.offsetHeight;
  probe.remove();
  return height;
}

const isNestedScrolled = (from: Element, body: Element): boolean => {
  for (let node: Element | null = from; node && node !== body.parentElement; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
  }
  return false;
};

interface SheetDragOptions {
  /** Only the bottom sheet follows the finger; the desktop sidebar does not. */
  readonly enabled: boolean;
  readonly hostRef: RefObject<HTMLElement | null>;
  readonly onSnap: (state: SheetState) => void;
}

/**
 * The bottom sheet follows the finger, as a map app's does, and on release settles at the nearest
 * stop or goes on in the direction of a flick. The handle always drags. The content drags too until
 * the sheet is fully open; then it scrolls, and only a pull down from its very top takes the sheet
 * with it. Written straight to the elements' style during a drag, so no frame renders React.
 */
export function useSheetDrag({ enabled, hostRef, onSnap }: SheetDragOptions): void {
  const onSnapRef = useRef(onSnap);
  useEffect(() => {
    onSnapRef.current = onSnap;
  }, [onSnap]);

  useEffect(() => {
    const host = hostRef.current;
    const panel = host?.querySelector<HTMLElement>('[data-explore-panel]');
    const handle = panel?.querySelector<HTMLElement>('[data-sheet-handle]');
    const body = panel?.querySelector<HTMLElement>('[data-sheet-body]');
    if (!enabled || !host || !panel || !handle || !body) return;
    const followers = host.querySelectorAll<HTMLElement>('[data-sheet-follower]');

    interface Drag {
      readonly stops: SheetStops;
      readonly startY: number;
      readonly startVisible: number;
      visible: number;
      lastY: number;
      lastTime: number;
      velocity: number;
    }
    let drag: Drag | null = null;

    const show = (visible: number) => {
      const value = `${String(visible)}px`;
      panel.style.setProperty('--sheet-visible', value);
      for (const follower of followers) follower.style.setProperty('--sheet-visible', value);
    };

    const begin = (y: number, time: number): void => {
      const open = panel.offsetHeight;
      const stops = {
        collapsed: resolveLength(host, '--sheet-collapsed'),
        peek: resolveLength(host, '--sheet-peek'),
        open,
      };
      // Where it is right now, also when it is still gliding to a stop.
      const shifted = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42;
      const startVisible = open - shifted;
      drag = { stops, startY: y, startVisible, visible: startVisible, lastY: y, lastTime: time, velocity: 0 };
      panel.dataset['dragging'] = 'true';
      show(startVisible);
    };

    const move = (y: number, time: number): void => {
      if (!drag) return;
      const elapsed = time - drag.lastTime;
      if (elapsed > 0) {
        // Smoothed a little, so one late event does not read as a flick; up is positive.
        drag.velocity = 0.7 * ((drag.lastY - y) / elapsed) + 0.3 * drag.velocity;
        drag.lastY = y;
        drag.lastTime = time;
      }
      const next = drag.startVisible + drag.startY - y;
      drag.visible = Math.min(drag.stops.open, Math.max(drag.stops.collapsed, next));
      show(drag.visible);
    };

    const finish = (time: number): void => {
      if (!drag) return;
      // A finger that stopped before lifting has no speed left, whatever it had on the way.
      const velocity = time - drag.lastTime > REST_AFTER_MS ? 0 : drag.velocity;
      const target = snapAfterDrag(drag.visible, velocity, drag.stops);
      drag = null;
      panel.style.removeProperty('--sheet-visible');
      for (const follower of followers) follower.style.removeProperty('--sheet-visible');
      delete panel.dataset['dragging'];
      if (target !== 'open') body.scrollTop = 0;
      onSnapRef.current(target);
    };

    // Touch: decided on the first move, the only moment a page can still keep the browser from
    // scrolling. Touch events rather than pointer events, because those end as soon as it scrolls.
    let gesture: { startX: number; startY: number; target: Element; mode: 'drag' | 'native' | null } | null =
      null;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      gesture = null;
      if (event.touches.length !== 1 || !touch || !(event.target instanceof Element)) return;
      if (event.target.closest('input, textarea, select, [role="listbox"]')) return;
      gesture = { startX: touch.clientX, startY: touch.clientY, target: event.target, mode: null };
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!gesture || !touch) return;
      if (gesture.mode === null) {
        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;
        if (Math.abs(dx) > Math.abs(dy)) {
          gesture.mode = 'native'; // a wide table inside the sheet scrolls sideways
        } else {
          const fromHandle = handle.contains(gesture.target);
          const fullyOpen = panel.dataset['state'] === 'open';
          const pullFromTop = dy > 0 && !isNestedScrolled(gesture.target, body);
          gesture.mode = fromHandle || !fullyOpen || pullFromTop ? 'drag' : 'native';
          if (gesture.mode === 'drag') begin(gesture.startY, event.timeStamp);
        }
      }
      if (gesture.mode !== 'drag') return;
      if (event.cancelable) event.preventDefault();
      move(touch.clientY, event.timeStamp);
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (gesture?.mode === 'drag') finish(event.timeStamp);
      gesture = null;
    };

    // Mouse and pen, on the handle only: their wheel and scrollbar scroll the content.
    let mouse: { pointerId: number; startY: number; dragged: boolean } | null = null;
    let swallowClick = false;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      mouse = { pointerId: event.pointerId, startY: event.clientY, dragged: false };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!mouse || event.pointerId !== mouse.pointerId) return;
      if (!mouse.dragged) {
        if (Math.abs(event.clientY - mouse.startY) < MOUSE_DRAG_SLOP_PX) return;
        mouse.dragged = true;
        handle.setPointerCapture(event.pointerId);
        begin(mouse.startY, event.timeStamp);
      }
      move(event.clientY, event.timeStamp);
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (!mouse || event.pointerId !== mouse.pointerId) return;
      if (mouse.dragged) {
        swallowClick = event.type === 'pointerup';
        finish(event.timeStamp);
      }
      mouse = null;
    };

    // The click that ends a mouse drag must not toggle the sheet as well.
    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    // A dropdown needs more room than the middle stop has: its options would run off the screen.
    const onBodyClick = (event: MouseEvent) => {
      if (
        panel.dataset['state'] === 'peek' &&
        event.target instanceof Element &&
        event.target.closest('[role="combobox"]')
      ) {
        onSnapRef.current('open');
      }
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd);
    panel.addEventListener('touchcancel', onTouchEnd);
    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);
    handle.addEventListener('click', onClickCapture, { capture: true });
    body.addEventListener('click', onBodyClick);
    return () => {
      body.removeEventListener('click', onBodyClick);
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
      panel.removeEventListener('touchcancel', onTouchEnd);
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerEnd);
      handle.removeEventListener('pointercancel', onPointerEnd);
      handle.removeEventListener('click', onClickCapture, { capture: true });
      panel.style.removeProperty('--sheet-visible');
      for (const follower of followers) follower.style.removeProperty('--sheet-visible');
      delete panel.dataset['dragging'];
    };
  }, [enabled, hostRef]);
}
