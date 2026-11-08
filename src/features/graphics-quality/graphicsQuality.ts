import { useSyncExternalStore } from 'react';

/**
 * What this device can comfortably draw, decided once per visit from the device itself. HIGH runs
 * the full 3D site; LOW swaps the heavy 3D scenes for 2D pictures and starts the map flat.
 */
export type DeviceTier = 'high' | 'low';

/** How the Jelajahi map is drawn: tilting 3D, or flat from straight above. The visitor's choice. */
export type MapView = '3d' | '2d';

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

/** Colours, data and every interaction are the same on every device; only the drawing changes. */
export const QUALITY_PROFILES: Readonly<Record<DeviceTier, QualityProfile>> = {
  high: { scenes3d: true, flatMap: false, maxPixelRatio: 2, decorativeMotion: true },
  low: { scenes3d: false, flatMap: true, maxPixelRatio: 1, decorativeMotion: false },
};

export const MAP_VIEW_STORAGE_KEY = 'nusa-matra:map-view';
/** The earlier site-wide 3D/2D switch; its stored choice is dropped (the device decides now). */
const LEGACY_MODE_STORAGE_KEY = 'nusa-matra:graphics-mode';

/** WebGL renderers that draw on the CPU (no graphics acceleration). */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * Memory (GB, as the browser rounds it) at or below which a device counts as low-end. 4 GB covers
 * the mid-low phones measured (Galaxy S9), where the 3D map loaded in about 17 s and drew at a
 * fraction of the 2D frame rate; laptops and current phones report 8.
 */
const LOW_DEVICE_MEMORY_GB = 4;
/** Logical processors at or below which the map build and 3D scenes starve the page. */
const LOW_CPU_CORES = 2;

export function isSoftwareRenderer(rendererName: string): boolean {
  return SOFTWARE_RENDERER.test(rendererName);
}

/**
 * True when the browser can draw WebGL only on the CPU: hardware acceleration is off or missing
 * (Chrome's SwiftShader, Mesa's llvmpipe). There the 3D map runs at a few frames per second. A
 * browser without WebGL at all is not counted: its own fallbacks apply.
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

/** The device facts the tier is decided from; each is absent where the browser does not report it. */
export interface DeviceSignals {
  readonly softwareRendering: boolean;
  /** navigator.deviceMemory (Chromium only). */
  readonly memoryGb?: number | undefined;
  /** navigator.hardwareConcurrency. */
  readonly cpuCores?: number | undefined;
  /** The visitor asked the browser to save data (navigator.connection.saveData). */
  readonly saveData?: boolean | undefined;
}

/** LOW for a device that draws in software, is short of memory or cores, or asks to save data. */
export function deviceTierFrom(signals: DeviceSignals): DeviceTier {
  const short =
    signals.softwareRendering ||
    signals.saveData === true ||
    (signals.memoryGb !== undefined && signals.memoryGb <= LOW_DEVICE_MEMORY_GB) ||
    (signals.cpuCores !== undefined && signals.cpuCores <= LOW_CPU_CORES);
  return short ? 'low' : 'high';
}

interface NavigatorDeviceHints {
  readonly deviceMemory?: number;
  readonly connection?: { readonly saveData?: boolean };
}

function readDeviceSignals(): DeviceSignals {
  const hints = navigator as Navigator & NavigatorDeviceHints;
  return {
    softwareRendering: detectSoftwareRendering(),
    memoryGb: hints.deviceMemory,
    cpuCores: navigator.hardwareConcurrency || undefined,
    saveData: hints.connection?.saveData,
  };
}

/** The map view the visitor chose on an earlier visit, or null when they never chose. */
function readStoredMapView(): MapView | null {
  try {
    window.localStorage.removeItem(LEGACY_MODE_STORAGE_KEY);
    const stored = window.localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (stored === '2d' || stored === '3d') return stored;
  } catch {
    // Storage blocked: fall back to the device's default.
  }
  return null;
}

/** The visitor's own map choice wins; without one, the map starts flat on a low-end device. */
function readMapView(deviceTier: DeviceTier): MapView {
  return readStoredMapView() ?? (deviceTier === 'low' ? '2d' : '3d');
}

interface QualityState {
  readonly tier: DeviceTier;
  readonly mapView: MapView;
  readonly profile: QualityProfile;
  /** True when this visit's map went flat by itself because the 3D map stuttered (not stored). */
  readonly autoFlat: boolean;
}

/** The device sets the scenes and pixel ratio; the map view only flattens the map and its decoration. */
function stateOf(tier: DeviceTier, mapView: MapView, autoFlat = false): QualityState {
  const base = QUALITY_PROFILES[tier];
  const flat = mapView === '2d';
  return {
    tier,
    mapView,
    profile: { ...base, flatMap: flat, decorativeMotion: base.decorativeMotion && !flat },
    autoFlat,
  };
}

/*
 * The device facts above miss weak devices that do not report memory (Safari, Firefox). So the
 * 3D map also judges itself: it reports the time between the frames it draws while moving, and if
 * the median of the first few dozen is slower than about 20 frames a second, the map turns flat for
 * the rest of the visit. Never when the visitor chose a view themselves, and never stored, so the
 * next visit measures again.
 */
export const FRAME_PROBE = {
  /** Drawn frames to collect before deciding. */
  samples: 45,
  /** A median frame slower than this (about 20 frames a second) counts as stuttering. */
  slowMedianMs: 50,
  /** Longer gaps are pauses between bursts of drawing, not slow frames, and are left out. */
  maxGapMs: 250,
} as const;

export type FrameVerdict = 'pending' | 'slow' | 'ok';

export function judgeFrames(deltas: readonly number[]): FrameVerdict {
  const drawn = deltas.filter((delta) => delta > 0 && delta <= FRAME_PROBE.maxGapMs);
  if (drawn.length < FRAME_PROBE.samples) return 'pending';
  const sorted = drawn.slice(0, FRAME_PROBE.samples).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return median > FRAME_PROBE.slowMedianMs ? 'slow' : 'ok';
}

let probe: { deltas: number[]; done: boolean } = { deltas: [], done: false };

let state: QualityState | null = null;
const listeners = new Set<() => void>();

function currentState(): QualityState {
  if (!state) {
    const tier = deviceTierFrom(readDeviceSignals());
    state = stateOf(tier, readMapView(tier));
  }
  return state;
}

export function getDeviceTier(): DeviceTier {
  return currentState().tier;
}

export function getMapView(): MapView {
  return currentState().mapView;
}

export function getQualityProfile(): QualityProfile {
  return currentState().profile;
}

export function getAutoFlat(): boolean {
  return currentState().autoFlat;
}

/**
 * Called by the 3D map for every frame it draws while moving, with the time since the frame
 * before. Once enough frames are in, decides once per visit whether to turn the map flat.
 */
export function reportMapFrame(deltaMs: number): void {
  if (probe.done) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const current = currentState();
  if (current.mapView !== '3d' || readStoredMapView() !== null) {
    probe.done = true;
    return;
  }
  probe.deltas.push(deltaMs);
  const verdict = judgeFrames(probe.deltas);
  if (verdict === 'pending') return;
  probe.done = true;
  if (verdict === 'slow') {
    state = stateOf(current.tier, '2d', true);
    for (const listener of listeners) listener();
  }
}

/** Puts the device tier on <html data-graphics>, where the glass styles read it. */
export function applyGraphicsModeToDocument(): void {
  document.documentElement.setAttribute('data-graphics', getDeviceTier());
}

export function setMapView(next: MapView): void {
  state = stateOf(getDeviceTier(), next);
  probe.done = true; // the visitor has chosen: the map no longer decides for them
  try {
    window.localStorage.setItem(MAP_VIEW_STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice holds for this visit only.
  }
  for (const listener of listeners) listener();
}

export function subscribeQuality(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMapView(): MapView {
  return useSyncExternalStore(subscribeQuality, getMapView, () => '3d');
}

export function useQualityProfile(): QualityProfile {
  return useSyncExternalStore(subscribeQuality, getQualityProfile, () => QUALITY_PROFILES.high);
}

export function useAutoFlat(): boolean {
  return useSyncExternalStore(subscribeQuality, getAutoFlat, () => false);
}

/** For tests: forget the cached state, and optionally fix the device tier instead of detecting it. */
export function resetGraphicsModeForTests(tier?: DeviceTier): void {
  state = tier ? stateOf(tier, readMapView(tier)) : null;
  probe = { deltas: [], done: false };
  listeners.clear();
}
