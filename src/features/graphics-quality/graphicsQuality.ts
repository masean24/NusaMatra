import { useSyncExternalStore } from 'react';

/** What the visitor chose; `auto` lets the device decide (a static check, not live measurement). */
export type QualityChoice = 'auto' | 'high' | 'balanced' | 'lite';
export type QualityLevel = Exclude<QualityChoice, 'auto'>;

export interface QualityProfile {
  /** Cap on the WebGL drawing-buffer pixel ratio; each renderer also keeps its own lower cap. */
  readonly maxPixelRatio: number;
  /** Looping decoration on the 3D map (sea ripple, pulsing markers). Never carries information. */
  readonly decorativeMotion: boolean;
  /** Refracting glass edges (Chromium, Kaca) and the full backdrop blur. */
  readonly richGlass: boolean;
}

/*
 * HIGH is the site as it was before profiles existed (each renderer's own pixel-ratio cap applies).
 * BALANCED draws about half the pixels on HiDPI screens; LITE draws one pixel per CSS pixel, stops
 * the decorative loops and uses a lighter blur. Colours, data and interaction are the same in all.
 */
export const QUALITY_PROFILES: Readonly<Record<QualityLevel, QualityProfile>> = {
  high: { maxPixelRatio: 2, decorativeMotion: true, richGlass: true },
  balanced: { maxPixelRatio: 1.25, decorativeMotion: true, richGlass: true },
  lite: { maxPixelRatio: 1, decorativeMotion: false, richGlass: false },
};

export const QUALITY_STORAGE_KEY = 'nusa-matra:graphics-quality';

const CHOICES: readonly QualityChoice[] = ['auto', 'high', 'balanced', 'lite'];

/** Touch-first or few-core devices start on BALANCED; everything else on HIGH. */
const MODEST_DEVICE_MAX_CORES = 4;

export function resolveAutoLevel(device: {
  readonly coarsePointer: boolean;
  readonly cores: number | undefined;
}): QualityLevel {
  const fewCores = device.cores !== undefined && device.cores <= MODEST_DEVICE_MAX_CORES;
  return device.coarsePointer || fewCores ? 'balanced' : 'high';
}

function readChoice(): QualityChoice {
  try {
    const value = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    return CHOICES.find((choice) => choice === value) ?? 'auto';
  } catch {
    return 'auto';
  }
}

function deviceAutoLevel(): QualityLevel {
  return resolveAutoLevel({
    coarsePointer: typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
    cores: typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency,
  });
}

let choice: QualityChoice | null = null;
const listeners = new Set<() => void>();

function currentChoice(): QualityChoice {
  choice ??= readChoice();
  return choice;
}

export function getQualityLevel(): QualityLevel {
  const chosen = currentChoice();
  return chosen === 'auto' ? deviceAutoLevel() : chosen;
}

export function getQualityProfile(): QualityProfile {
  return QUALITY_PROFILES[getQualityLevel()];
}

/** Puts the level on <html data-quality>, where the glass styles read it. */
export function applyQualityToDocument(): void {
  document.documentElement.setAttribute('data-quality', getQualityLevel());
}

export function setQualityChoice(next: QualityChoice): void {
  choice = next;
  try {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice holds for this visit only.
  }
  applyQualityToDocument();
  for (const listener of listeners) listener();
}

export function subscribeQuality(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useQualityChoice(): QualityChoice {
  return useSyncExternalStore(subscribeQuality, currentChoice, () => 'auto');
}

export function useQualityProfile(): QualityProfile {
  return useSyncExternalStore(subscribeQuality, getQualityProfile, () => QUALITY_PROFILES.high);
}

/** For tests: forget the cached choice so the next read comes from storage. */
export function resetQualityForTests(): void {
  choice = null;
  listeners.clear();
}
