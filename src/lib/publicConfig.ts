/**
 * Public, browser-visible configuration, validated once at start-up (docs/04 §8.2, §13.2).
 * Fail closed: an unknown data mode is a configuration error, never a silent guess at LIVE.
 */
export type DataMode = 'DEMO' | 'LIVE';

export interface PublicConfig {
  readonly dataMode: DataMode;
  readonly apiBaseUrl: string | null;
}

export class PublicConfigError extends Error {
  override readonly name = 'PublicConfigError';
}

interface RawEnv {
  readonly VITE_DATA_MODE?: string | undefined;
  readonly VITE_API_BASE_URL?: string | undefined;
  readonly DEV?: boolean | undefined;
}

export function parsePublicConfig(env: RawEnv): PublicConfig {
  // Local development without a .env file defaults to DEMO; builds read .env.production.
  const rawMode = (env.VITE_DATA_MODE ?? (env.DEV ? 'demo' : '')).trim().toLowerCase();
  const apiBaseUrl = env.VITE_API_BASE_URL?.trim() || null;

  if (rawMode === 'demo') return { dataMode: 'DEMO', apiBaseUrl };
  if (rawMode === 'live') {
    if (!apiBaseUrl)
      throw new PublicConfigError('VITE_DATA_MODE=live requires VITE_API_BASE_URL (the Data Hub API).');
    return { dataMode: 'LIVE', apiBaseUrl };
  }
  throw new PublicConfigError(`VITE_DATA_MODE must be "demo" or "live", got "${rawMode}".`);
}

export const publicConfig: PublicConfig = parsePublicConfig(import.meta.env);
