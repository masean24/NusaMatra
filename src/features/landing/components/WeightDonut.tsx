import { useLayoutEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from '@/features/motion';
import {
  DONUT_DURATION_MS,
  MAX_SLICES,
  cubicOut,
  largest,
  mixSlot,
  rgbText,
  slicePath,
  targetSlots,
  type DonutSlice,
  type SlotState,
} from './donutArcs';
import styles from './WeightDonut.module.css';

/** The ring in a 220 × 220 view box: inner and outer radius, and how far the slice in focus rises. */
const CENTRE = 110;
const INNER = 64;
const OUTER = 96;
const LIFT = 7;

/**
 * The weights of a Lab focus as a ring: one slice per indicator, sized by its weight, in the series
 * colours its legend uses too. A mouse chooses a slice by pointing at it, a finger by tapping it.
 * Changing focus or choosing a weight never rebuilds the ring: five
 * fixed paths glide from where they are to where they belong (angles, the lifted radius of the slice
 * in focus and each colour channel, cubicOut over 750 ms), slices a focus does not have close at the
 * end of the turn, and the centre figure counts to its new value. With reduced motion every change
 * is drawn at once.
 */
export function WeightDonut({
  slices,
  activeId,
  onActive,
  centreLabel,
  formatShare,
  palette,
}: {
  readonly slices: readonly DonutSlice[];
  /** The weight the visitor points at or focuses; `null` = none (the largest is then the one shown). */
  readonly activeId: string | null;
  readonly onActive: (id: string | null) => void;
  readonly centreLabel: string;
  readonly formatShare: (bps: number) => string;
  readonly palette: readonly (readonly [number, number, number])[];
}) {
  const reducedMotion = useReducedMotion();
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const shareRef = useRef<HTMLSpanElement>(null);
  /** What is on screen now, so a new change starts from there, even mid-glide. */
  const shown = useRef<{ slots: SlotState[]; share: number } | null>(null);

  const focus = slices.find((slice) => slice.id === activeId) ?? largest(slices);
  const targetShare = focus?.bps ?? 0;
  const targets = useMemo(
    () => targetSlots(slices, activeId, palette, OUTER, LIFT),
    [slices, activeId, palette],
  );
  const count = slices.length;

  useLayoutEffect(() => {
    const draw = (slots: readonly SlotState[], share: number) => {
      slots.forEach((slot, index) => {
        const path = pathRefs.current[index];
        if (!path) return;
        path.setAttribute('d', slicePath(CENTRE, CENTRE, INNER, slot, count));
        path.setAttribute('fill', rgbText(slot.rgb));
      });
      if (shareRef.current) shareRef.current.textContent = formatShare(share);
    };
    const from = shown.current;
    if (!from || reducedMotion) {
      shown.current = { slots: targets, share: targetShare };
      draw(targets, targetShare);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // A frame's timestamp can precede `began` (it is when the frame started): never run backwards.
      const progress = Math.min(1, Math.max(0, (now - began) / DONUT_DURATION_MS));
      const eased = cubicOut(progress);
      const slots = targets.map((to, index) => mixSlot(from.slots[index] ?? to, to, eased));
      const share = from.share + (targetShare - from.share) * eased;
      shown.current = { slots, share };
      draw(slots, share);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [targets, targetShare, count, reducedMotion, formatShare]);

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.ring}
        viewBox="0 0 220 220"
        aria-hidden="true"
        focusable="false"
        // Mouse only: a finger "leaves" the ring the moment it lifts, which would drop the slice
        // a tap has just chosen.
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') onActive(null);
        }}
      >
        {Array.from({ length: MAX_SLICES }, (_, index) => {
          const slice = slices[index];
          return (
            <path
              key={index}
              ref={(node) => {
                pathRefs.current[index] = node;
              }}
              className={styles.slice}
              data-active={(slice && slice.id === activeId) || undefined}
              onPointerEnter={(event) => {
                if (slice && event.pointerType === 'mouse') onActive(slice.id);
              }}
              // A tap (or click) chooses the slice, and it stays chosen after the finger lifts.
              onClick={() => {
                if (slice) onActive(slice.id);
              }}
            />
          );
        })}
      </svg>
      <figcaption className={styles.centre} aria-live="polite">
        {focus && (
          <>
            {/* Written by the glide (it counts to the new figure), not by React, so a re-render never jumps it. */}
            <span ref={shareRef} className={`kk-number ${styles.share}`} />
            <span className={styles.name}>{focus.name}</span>
          </>
        )}
        <span className="visually-hidden">{centreLabel}</span>
      </figcaption>
    </figure>
  );
}
