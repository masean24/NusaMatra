import { PublicConfigError, parsePublicConfig } from './publicConfig';

describe('parsePublicConfig', () => {
  it('maps demo and live to the DEMO/LIVE data modes', () => {
    expect(parsePublicConfig({ VITE_DATA_MODE: 'demo' }).dataMode).toBe('DEMO');
    expect(parsePublicConfig({ VITE_DATA_MODE: 'live', VITE_API_BASE_URL: 'https://hub.example' })).toEqual({
      dataMode: 'LIVE',
      apiBaseUrl: 'https://hub.example',
      earthquakePreview: false,
    });
    expect(
      parsePublicConfig({ VITE_DATA_MODE: 'demo', VITE_EARTHQUAKE_PREVIEW: '1' }).earthquakePreview,
    ).toBe(true);
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
