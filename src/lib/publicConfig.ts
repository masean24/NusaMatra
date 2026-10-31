/**
 * Public, browser-visible configuration, validated once at start-up (docs/04 §8.2, §13.2).
 * Unset values take the published site's defaults (LIVE, the public Data Hub); an unknown data
 * mode is a configuration error, never a silent guess.
 */
export type DataMode = 'DEMO' | 'LIVE';

export interface PublicConfig {
  readonly dataMode: DataMode;
  readonly apiBaseUrl: string | null;
  /**
   * Opt-in, for reviewers only: show BMKG events from a response that does not declare whether they
   * are live, cached or a local fixture. Markers are then labelled "belum terverifikasi". Declared
   * BMKG data does not need it. Never set for production.
   */
  readonly earthquakePreview: boolean;
  /**
   * Shows the DEMO/LIVE switch and the mode labels. Off for visitors: the site reads LIVE only
   * (owner decision 2026-10-26). On only where DEMO fixtures are needed: the automated tests.
   */
  readonly modeSwitch: boolean;
}

export class PublicConfigError extends Error {
  override readonly name = 'PublicConfigError';
}

interface RawEnv {
  /** Vite's other variables (MODE, DEV, …) pass through untouched. */
  readonly [name: string]: string | boolean | undefined;
  readonly VITE_DATA_MODE?: string | undefined;
  readonly VITE_API_BASE_URL?: string | undefined;
  readonly VITE_EARTHQUAKE_PREVIEW?: string | undefined;
  readonly VITE_DATA_MODE_SWITCH?: string | undefined;
}

/**
 * The published site's settings. The repository ships no .env file, so every build (local, CI,
 * Coolify) uses these unless an environment variable overrides them. Both are public, not secrets.
 */
const DEFAULT_DATA_MODE = 'live';
const DEFAULT_API_BASE_URL = 'https://api.nusamatra.site';

export function parsePublicConfig(env: RawEnv): PublicConfig {
  const rawMode = (env.VITE_DATA_MODE?.trim() || DEFAULT_DATA_MODE).toLowerCase();
  const apiBaseUrl = env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  const earthquakePreview = env.VITE_EARTHQUAKE_PREVIEW?.trim() === '1';
  const modeSwitch = env.VITE_DATA_MODE_SWITCH?.trim() === '1';

  if (rawMode === 'demo') return { dataMode: 'DEMO', apiBaseUrl, earthquakePreview, modeSwitch };
  if (rawMode === 'live') return { dataMode: 'LIVE', apiBaseUrl, earthquakePreview, modeSwitch };
  throw new PublicConfigError(`VITE_DATA_MODE must be "demo" or "live", got "${rawMode}".`);
}

export const publicConfig: PublicConfig = parsePublicConfig(import.meta.env);
