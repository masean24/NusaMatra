import { useSyncExternalStore } from 'react';

/** HIGH is the full 3D site; LOW swaps the heavy 3D scenes for 2D pictures and a flat map. */
export type GraphicsMode = 'high' | 'low';

export interface QualityProfile {
  /** Landing hexagon hero and the 3D scenes; off = their still 2D pictures. */
  readonly scenes3d: boolean;
  /** Jelajahi map seen from straight above, flat, without shadows or tilting. */
  readonly flatMap: boolean;
  /** Cap on the WebGL drawing-buffer pixel ratio; each renderer also keeps its own lower cap. */
  readonly maxPixelRatio: number;
  /** Looping decoration on the 3D map (sea ripple, pulsing markers). Never carries information. */
  readonly decorativeMotion: boolean;
}

/** Colours, data and every interaction are the same in both modes; only the drawing changes. */
export const QUALITY_PROFILES: Readonly<Record<GraphicsMode, QualityProfile>> = {
  high: { scenes3d: true, flatMap: false, maxPixelRatio: 2, decorativeMotion: true },
  low: { scenes3d: false, flatMap: true, maxPixelRatio: 1, decorativeMotion: false },
};

export const GRAPHICS_MODE_STORAGE_KEY = 'nusa-matra:graphics-mode';

/** WebGL renderers that draw on the CPU (no graphics acceleration). */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function isSoftwareRenderer(rendererName: string): boolean {
  return SOFTWARE_RENDERER.test(rendererName);
}

/**
 * True when the browser can draw WebGL only on the CPU: hardware acceleration is off or missing
 * (Chrome's SwiftShader, Mesa's llvmpipe). There the 3D map runs at a few frames per second, so the
 * site starts in 2D. A browser without WebGL at all is not counted: its own fallbacks apply.
 */
function detectSoftwareRendering(): boolean {
  try {
    const strict = document
      .createElement('canvas')
      .getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (strict) {
      const info = strict.getExtension('WEBGL_debug_renderer_info');
      const name = info ? String(strict.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      strict.getExtension('WEBGL_lose_context')?.loseContext();
      return isSoftwareRenderer(name);
    }
    // Refused only because it would be slow: WebGL works, but in software.
    const plain = document.createElement('canvas').getContext('webgl');
    plain?.getExtension('WEBGL_lose_context')?.loseContext();
    return plain !== null;
  } catch {
    return false;
  }
}

/** The visitor's own choice wins; without one, devices that draw in software start in 2D. */
function readMode(): GraphicsMode {
  try {
    const stored = window.localStorage.getItem(GRAPHICS_MODE_STORAGE_KEY);
    if (stored === 'low' || stored === 'high') return stored;
  } catch {
    // Storage blocked: fall back to the device check.
  }
  return detectSoftwareRendering() ? 'low' : 'high';
}

let mode: GraphicsMode | null = null;
const listeners = new Set<() => void>();

export function getGraphicsMode(): GraphicsMode {
  mode ??= readMode();
  return mode;
}

export function getQualityProfile(): QualityProfile {
  return QUALITY_PROFILES[getGraphicsMode()];
}

/** Puts the mode on <html data-graphics>, where the glass styles read it. */
export function applyGraphicsModeToDocument(): void {
  document.documentElement.setAttribute('data-graphics', getGraphicsMode());
}

export function setGraphicsMode(next: GraphicsMode): void {
  mode = next;
  try {
    window.localStorage.setItem(GRAPHICS_MODE_STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice holds for this visit only.
  }
  applyGraphicsModeToDocument();
  for (const listener of listeners) listener();
}

export function subscribeQuality(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGraphicsMode(): GraphicsMode {
  return useSyncExternalStore(subscribeQuality, getGraphicsMode, () => 'high');
}

export function useQualityProfile(): QualityProfile {
  return useSyncExternalStore(subscribeQuality, getQualityProfile, () => QUALITY_PROFILES.high);
}

/** For tests: forget the cached mode so the next read comes from storage. */
export function resetGraphicsModeForTests(): void {
  mode = null;
  listeners.clear();
}
