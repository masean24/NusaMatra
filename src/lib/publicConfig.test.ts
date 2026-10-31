import { PublicConfigError, parsePublicConfig } from './publicConfig';

describe('build defaults (the repository ships no .env file)', () => {
  it('opens in LIVE against the public Data Hub, without the DEMO switch', () => {
    expect(parsePublicConfig({})).toEqual({
      dataMode: 'LIVE',
      apiBaseUrl: 'https://api.nusamatra.site',
      earthquakePreview: false,
      modeSwitch: false,
    });
  });

  it('treats empty variables as unset', () => {
    expect(parsePublicConfig({ VITE_DATA_MODE: ' ', VITE_API_BASE_URL: '' })).toMatchObject({
      dataMode: 'LIVE',
      apiBaseUrl: 'https://api.nusamatra.site',
    });
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

  it('fails closed on unknown modes', () => {
    expect(() => parsePublicConfig({ VITE_DATA_MODE: 'production' })).toThrow(PublicConfigError);
  });
});
