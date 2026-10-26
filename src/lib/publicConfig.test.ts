/// <reference types="node" />
// Node is needed here only: Vite refuses to import .env files into the module graph.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PublicConfigError, parsePublicConfig } from './publicConfig';

/** KEY=VALUE lines of a committed .env file at the repository root (Vitest runs from it). */
function envFile(name: string): Record<string, string> {
  const text = readFileSync(join(process.cwd(), name), 'utf8');
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
  );
}

describe('committed build defaults', () => {
  it('production builds open in LIVE, against the public Data Hub', () => {
    const config = parsePublicConfig(envFile('.env.production'));
    expect(config.dataMode).toBe('LIVE');
    expect(config.apiBaseUrl).toBe('https://api.orangkeren.me');
    expect(config.earthquakePreview).toBe(false);
    expect(config.modeSwitch).toBe(false);
  });

  it('development reads LIVE too, without the DEMO switch', () => {
    const config = parsePublicConfig(envFile('.env.development'));
    expect(config.dataMode).toBe('LIVE');
    expect(config.modeSwitch).toBe(false);
  });

  it('ships no secret-looking key in the public env files', () => {
    for (const name of ['.env.production', '.env.development', '.env.example']) {
      expect(Object.keys(envFile(name)).filter((key) => /KEY|TOKEN|SECRET|PASSWORD/i.test(key))).toEqual([]);
    }
  });
});

describe('parsePublicConfig', () => {
  it('maps demo and live to the DEMO/LIVE data modes', () => {
    expect(parsePublicConfig({ VITE_DATA_MODE: 'demo' }).dataMode).toBe('DEMO');
    expect(parsePublicConfig({ VITE_DATA_MODE: 'live', VITE_API_BASE_URL: 'https://hub.example' })).toEqual({
      dataMode: 'LIVE',
      apiBaseUrl: 'https://hub.example',
      earthquakePreview: false,
      modeSwitch: false,
    });
    expect(
      parsePublicConfig({ VITE_DATA_MODE: 'demo', VITE_EARTHQUAKE_PREVIEW: '1' }).earthquakePreview,
    ).toBe(true);
  });

  it('shows the DEMO/LIVE switch only when the tests ask for it', () => {
    expect(parsePublicConfig({ VITE_DATA_MODE: 'demo' }).modeSwitch).toBe(false);
    expect(parsePublicConfig({ VITE_DATA_MODE: 'demo', VITE_DATA_MODE_SWITCH: '1' }).modeSwitch).toBe(true);
  });

  it('defaults to DEMO only in local development', () => {
    expect(parsePublicConfig({ DEV: true }).dataMode).toBe('DEMO');
    expect(() => parsePublicConfig({ DEV: false })).toThrow(PublicConfigError);
  });

  it('fails closed on unknown modes and on LIVE without an API', () => {
    expect(() => parsePublicConfig({ VITE_DATA_MODE: 'production' })).toThrow(PublicConfigError);
    expect(() => parsePublicConfig({ VITE_DATA_MODE: 'live' })).toThrow(/VITE_API_BASE_URL/);
  });
});
