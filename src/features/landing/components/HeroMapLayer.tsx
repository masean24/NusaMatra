import { animate, stagger, type AnimationPlaybackControls } from 'motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HERO_PINS, pinPositionInZone, type HeroCardId } from '../heroMapPins';
import styles from './HeroMapLayer.module.css';

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface Measured {
  readonly width: number;
  readonly height: number;
  readonly cards: Partial<Record<HeroCardId, Box>>;
}

interface HeroMapLayerProps {
  /** Pins drop and lines draw once this is true (the hexagons have settled). */
  readonly visible: boolean;
  readonly activeId: HeroCardId | null;
  readonly onToggle: (id: HeroCardId) => void;
  readonly reducedMotion: boolean;
}

/** Pins drop one after another; their lines draw once the first has landed. */
const PIN_STAGGER_S = 0.12;
const LINE_START_S = 0.5;
const PIN_DROP_PX = 44;
const EASE_CALM = [0.16, 1, 0.3, 1] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pins and their connector lines, over the hero zone. The cards live in the same container, so the
 * layer measures them and draws each line from its pin to the nearest point of the card it belongs
 * to (`HERO_PINS` is the one mapping). The pins are real buttons: clicking one highlights its card.
 * Everything is hidden by CSS until `visible`, then motion runs the sequence once.
 */
export function HeroMapLayer({ visible, activeId, onToggle, reducedMotion }: HeroMapLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    // The cards sit beside the map stage inside the hero visual, so measure against that container.
    const container = layer?.closest('[data-hero-visual]') ?? layer?.parentElement;
    if (!layer || !container) return;

    const measure = () => {
      const origin = layer.getBoundingClientRect();
      const cards: Partial<Record<HeroCardId, Box>> = {};
      for (const pin of HERO_PINS) {
        const card = container.querySelector(`[data-card="${pin.id}"]`);
        if (!card) continue;
        const rect = card.getBoundingClientRect();
        cards[pin.id] = {
          left: rect.left - origin.left,
          top: rect.top - origin.top,
          right: rect.right - origin.left,
          bottom: rect.bottom - origin.top,
        };
      }
      setMeasured({ width: origin.width, height: origin.height, cards });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const linesReady = measured !== null;
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !visible) return;
    const pins = layer.querySelectorAll<HTMLElement>('[data-pin]');
    const lines = layer.querySelectorAll<SVGElement>('[data-link-line]');
    const dots = layer.querySelectorAll<SVGElement>('[data-link-dot]');

    // motion rejects an empty list (there are no lines until the cards have been measured).
    const play = (items: NodeListOf<Element>, start: () => AnimationPlaybackControls) =>
      items.length > 0 ? [start()] : [];
    const playbacks = reducedMotion
      ? [
          ...play(pins, () => animate(pins, { opacity: [0, 1] }, { duration: 0.3 })),
          ...play(lines, () => animate(lines, { opacity: [0, 1], strokeDashoffset: 0 }, { duration: 0.3 })),
          ...play(dots, () => animate(dots, { opacity: [0, 1] }, { duration: 0.3 })),
        ]
      : [
          ...play(pins, () =>
            animate(
              pins,
              { opacity: [0, 1], y: [-PIN_DROP_PX, 0] },
              { type: 'spring', stiffness: 380, damping: 13, mass: 0.9, delay: stagger(PIN_STAGGER_S) },
            ),
          ),
          ...play(lines, () =>
            animate(
              lines,
              { opacity: [0, 1], strokeDashoffset: [1, 0] },
              {
                duration: 0.55,
                ease: EASE_CALM,
                delay: stagger(PIN_STAGGER_S, { startDelay: LINE_START_S }),
              },
            ),
          ),
          ...play(dots, () =>
            animate(
              dots,
              { opacity: [0, 1] },
              { duration: 0.2, delay: stagger(PIN_STAGGER_S, { startDelay: LINE_START_S + 0.4 }) },
            ),
          ),
        ];
    return () => {
      for (const playback of playbacks) playback.stop();
    };
  }, [visible, linesReady, reducedMotion]);

  return (
    <div ref={layerRef} className={styles.layer}>
      {measured && (
        <svg
          className={styles.lines}
          viewBox={`0 0 ${String(measured.width)} ${String(measured.height)}`}
          aria-hidden="true"
          focusable="false"
        >
          {HERO_PINS.map((pin) => {
            const card = measured.cards[pin.id];
            if (!card) return null;
            const { u, v } = pinPositionInZone(pin);
            const x = u * measured.width;
            const y = v * measured.height;
            const toX = clamp(x, card.left, card.right);
            const toY = clamp(y, card.top, card.bottom);
            if (toX === x && toY === y) return null; // the pin is under its card
            return (
              <g key={pin.id} className={styles.link} data-active={activeId === pin.id || undefined}>
                <line data-link-line x1={x} y1={y} x2={toX} y2={toY} pathLength={1} />
                <circle data-link-dot cx={toX} cy={toY} r={3} />
              </g>
            );
          })}
        </svg>
      )}
      {HERO_PINS.map((pin) => {
        const { u, v } = pinPositionInZone(pin);
        const active = activeId === pin.id;
        return (
          <button
            key={pin.id}
            type="button"
            data-pin
            className={styles.pin}
            style={{ left: `${String(u * 100)}%`, top: `${String(v * 100)}%` }}
            aria-pressed={active}
            aria-label={`Sorot kartu Wilayah ${pin.id.toUpperCase()} (titik ilustratif: ${pin.place})`}
            data-active={active || undefined}
            tabIndex={visible ? 0 : -1}
            onClick={() => {
              onToggle(pin.id);
            }}
          >
            <span className={styles.dot} />
          </button>
        );
      })}
    </div>
  );
}
