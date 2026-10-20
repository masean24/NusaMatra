import {
  DISPLAY_MODE_STORAGE_KEY,
  OPAQUE_SURFACES_QUERY,
  resolveInitialDisplayMode,
  writeStoredDisplayMode,
  type PreferenceEnvironment,
} from './displayModePreference';

function environment(
  saved: string | null,
  opaque = false,
): PreferenceEnvironment & { stored: Map<string, string> } {
  const stored = new Map<string, string>(saved === null ? [] : [[DISPLAY_MODE_STORAGE_KEY, saved]]);
  return {
    stored,
    storage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => {
        stored.set(key, value);
      },
    },
    matchMedia: (query) => ({ matches: opaque && query === OPAQUE_SURFACES_QUERY }),
  };
}

describe('display mode preference', () => {
  it('restores a saved Kaca preference', () => {
    expect(resolveInitialDisplayMode(environment('glass'))).toBe('glass');
  });

  it('defaults to Normal when nothing or something invalid is stored', () => {
    expect(resolveInitialDisplayMode(environment(null))).toBe('normal');
    expect(resolveInitialDisplayMode(environment('dark'))).toBe('normal');
  });

  it('forces Normal when the device asks for opaque surfaces, even if Kaca was saved', () => {
    expect(resolveInitialDisplayMode(environment('glass', true))).toBe('normal');
  });

  it('survives storage that throws (private mode)', () => {
    const throwing: PreferenceEnvironment = {
      storage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
      matchMedia: null,
    };
    expect(resolveInitialDisplayMode(throwing)).toBe('normal');
    expect(() => {
      writeStoredDisplayMode(throwing, 'glass');
    }).not.toThrow();
  });

  it('persists the chosen mode', () => {
    const env = environment(null);
    writeStoredDisplayMode(env, 'glass');
    expect(env.stored.get(DISPLAY_MODE_STORAGE_KEY)).toBe('glass');
  });
});
