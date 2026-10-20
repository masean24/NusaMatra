export type DisplayMode = 'normal' | 'glass';

export const DISPLAY_MODE_STORAGE_KEY = 'nusa-matra:display-mode';

/** Figma 26:37 / 30:1467: reduced transparency or more contrast turns Kaca off automatically. */
export const OPAQUE_SURFACES_QUERY = '(prefers-reduced-transparency: reduce), (prefers-contrast: more)';

export interface PreferenceEnvironment {
  readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly matchMedia: ((query: string) => Pick<MediaQueryList, 'matches'>) | null;
}

export function browserEnvironment(): PreferenceEnvironment {
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Private mode or blocked storage: the preference simply is not persisted.
  }
  return {
    storage,
    matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null,
  };
}

export function prefersOpaqueSurfaces(env: PreferenceEnvironment): boolean {
  return env.matchMedia?.(OPAQUE_SURFACES_QUERY).matches ?? false;
}

export function readStoredDisplayMode(env: PreferenceEnvironment): DisplayMode | null {
  try {
    const value = env.storage?.getItem(DISPLAY_MODE_STORAGE_KEY);
    return value === 'glass' || value === 'normal' ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredDisplayMode(env: PreferenceEnvironment, mode: DisplayMode): void {
  try {
    env.storage?.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
  } catch {
    // Quota or security errors must never break the toggle itself.
  }
}

/** Kept in sync with the inline boot script in index.html, which runs before React. */
export function resolveInitialDisplayMode(env: PreferenceEnvironment): DisplayMode {
  if (prefersOpaqueSurfaces(env)) return 'normal';
  return readStoredDisplayMode(env) ?? 'normal';
}

export function oppositeMode(mode: DisplayMode): DisplayMode {
  return mode === 'glass' ? 'normal' : 'glass';
}
