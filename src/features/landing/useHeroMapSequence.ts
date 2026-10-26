import { useCallback, useEffect, useState } from 'react';
import type { HeroMapOutcome } from '@/features/geo3d';

/** The hero's entrance (G2) is still rising for this long after load; pins wait for it to finish. */
const HERO_RISE_DONE_MS = 1300;
/** Cards follow the pins and lines by this long. */
const CARDS_AFTER_PINS_MS = 700;
/** Cards never stay hidden longer than this, whatever the map does. */
const CARDS_SAFETY_MS = 7000;

/**
 * Orders the hero's second act: hexagons settle → pins drop and lines draw → the three cards fade in.
 * When the hexagon map cannot render, the cards simply appear (there are no pins to wait for).
 */
export function useHeroMapSequence() {
  const [outcome, setOutcome] = useState<HeroMapOutcome | null>(null);
  const [pinsVisible, setPinsVisible] = useState(false);
  const [cardsAfterPins, setCardsAfterPins] = useState(false);
  const [cardsTimedOut, setCardsTimedOut] = useState(false);

  const handleOutcome = useCallback((next: HeroMapOutcome) => {
    setOutcome((current) => current ?? next);
  }, []);

  useEffect(() => {
    if (outcome !== 'settled') return;
    const wait = Math.max(0, HERO_RISE_DONE_MS - performance.now());
    const pinTimer = window.setTimeout(() => {
      setPinsVisible(true);
    }, wait);
    const cardTimer = window.setTimeout(() => {
      setCardsAfterPins(true);
    }, wait + CARDS_AFTER_PINS_MS);
    return () => {
      window.clearTimeout(pinTimer);
      window.clearTimeout(cardTimer);
    };
  }, [outcome]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCardsTimedOut(true);
    }, CARDS_SAFETY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const cardsVisible = outcome === 'unavailable' || cardsAfterPins || cardsTimedOut;
  return { outcome, pinsVisible, cardsVisible, handleOutcome };
}
