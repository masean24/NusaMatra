/*
 * What the app shell loads before any page: every module reachable from src/main.tsx through
 * static imports (type-only imports and dynamic `import()` excluded). The bundler preloads all of
 * it on every page, so a page's own feature must stay behind its lazy route. One barrel import of
 * a constant was enough to pull Paspor Bukti, Lab Prioritas, Jelajahi and the earthquake layer
 * into the shell.
 */

const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EXTENSIONS = ['.ts', '.tsx'];
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;

/**
 * Route addresses and link builders other features may use: small modules with no UI, so reaching
 * them does not load the feature they point to.
 */
const ROUTE_PATH_MODULES = new Set([
  '/src/features/comparison/links.ts',
  '/src/features/evidence-passport/links.ts',
  '/src/features/evidence-passport/evidenceQuery.ts',
  '/src/features/exploration/links.ts',
  '/src/features/exploration/regionSelection.ts',
]);

/** POSIX `dirname` + relative join, for the glob's `/src/...` keys. */
function joinPath(fromFile: string, specifier: string): string {
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = `/src/${specifier.slice(2)}`;
  else if (specifier.startsWith('.')) base = joinPath(from, specifier);
  else return null;
  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ];
  return candidates.find((path) => path in SOURCES) ?? null;
}

function staticallyReachable(entry: string): Set<string> {
  const seen = new Set([entry]);
  const queue = [entry];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    const text = (SOURCES[file] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const match of text.matchAll(STATIC_IMPORT)) {
      const target = resolveImport(file, match[1] ?? '');
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
}

function featuresIn(files: Set<string>): Set<string> {
  const features = new Set<string>();
  for (const file of files) {
    if (ROUTE_PATH_MODULES.has(file)) continue;
    const match = /^\/src\/features\/([^/]+)\//.exec(file);
    if (match?.[1]) features.add(match[1]);
  }
  return features;
}

describe('the app shell', () => {
  const reachable = staticallyReachable('/src/main.tsx');
  const shell = featuresIn(reachable);

  it('finds the features the shell does need, so the scan itself works', () => {
    expect(shell).toContain('navigation');
    expect(shell).toContain('landing');
    // The router names the Bandingkan detail route through its light entry: a scan that misses
    // this file would pass every check below without looking.
    expect(reachable).toContain('/src/features/comparison/links.ts');
  });

  it.each(['evidence-passport', 'priority-lab', 'exploration', 'earthquakes', 'comparison', 'map-3d'])(
    'does not statically load the %s feature, which belongs to its own page',
    (feature) => {
      expect(shell).not.toContain(feature);
    },
  );
});

describe('pages that only link to Paspor Bukti', () => {
  // A link to the passport needs `passportHref`, not the passport and the Lab behind it.
  it.each(['ComparisonPage', 'ExplorePage', 'MethodologyPage'])(
    '%s does not load Paspor Bukti or Lab Prioritas',
    (page) => {
      const features = featuresIn(staticallyReachable(`/src/app/pages/${page}.tsx`));
      expect(features).not.toContain('evidence-passport');
      expect(features).not.toContain('priority-lab');
    },
  );
});

describe('Bandingkan', () => {
  // It reads region codes from the address with `parseRegionId`; that must not bring Jelajahi along.
  it.each(['ComparisonPage', 'ComparisonDetailPage'])(
    '%s does not load Jelajahi or the earthquake layer',
    (page) => {
      const reachable = staticallyReachable(`/src/app/pages/${page}.tsx`);
      const features = featuresIn(reachable);
      expect(features).toContain('comparison');
      // The light entry is reached, so the scan sees the import instead of silently dropping it.
      expect(reachable).toContain('/src/features/exploration/links.ts');
      expect(features).not.toContain('exploration');
      expect(features).not.toContain('earthquakes');
    },
  );
});
