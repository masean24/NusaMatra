import compactDataset from '../../../public/data/hex-indonesia-compact.json';
import rawDataset from '../../../public/data/hex-indonesia.json';
import { lerpLightRig, lightRigFor, valueToRgb } from './hexColors';
import { parseHexDataset } from './hexDataset';

describe('parseHexDataset', () => {
  const dataset = parseHexDataset(rawDataset);

  it('accepts the generated file and keeps its simulated label', () => {
    expect(dataset.cells.length).toBeGreaterThan(300);
    expect(rawDataset.metadata.kind).toBe('DEMO_SIMULATION');
    expect(dataset.cells.some((cell) => !cell.hasData)).toBe(true);
    expect(dataset.cells.every((cell) => (cell.hasData ? cell.value !== null : cell.value === null))).toBe(
      true,
    );
  });

  it('spreads the simulated values over the whole 0–1 range', () => {
    const values = dataset.cells.map((cell) => cell.value).filter((value): value is number => value !== null);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(1);
  });

  it('keeps every cell on its own grid slot (no two cells share a position)', () => {
    const slots = new Set(dataset.cells.map((cell) => `${String(cell.x)}:${String(cell.z)}`));
    expect(slots.size).toBe(dataset.cells.length);
  });

  it('rejects a file that is not marked as a simulation', () => {
    const real = { ...rawDataset, metadata: { ...rawDataset.metadata, kind: 'OFFICIAL' } };
    expect(() => parseHexDataset(real)).toThrow(/DEMO_SIMULATION/);
  });

  it('rejects a malformed row and a value outside 0–1', () => {
    const [first] = rawDataset.cells;
    if (!first) throw new Error('empty dataset');
    expect(() => parseHexDataset({ ...rawDataset, cells: [first.slice(0, 4)] })).toThrow(/baris/);
    expect(() => parseHexDataset({ ...rawDataset, cells: [[...first.slice(0, 4), 1.4]] })).toThrow(/0–1/);
    expect(() => parseHexDataset({ ...rawDataset, cells: [] })).toThrow(/kosong/);
  });
});

describe('valueToRgb', () => {
  it('runs from the lightest tile to deep orange in both themes and clamps out-of-range values', () => {
    expect(valueToRgb(0, 'normal')).toEqual([0xe6, 0xd5, 0xb8]);
    expect(valueToRgb(1, 'normal')).toEqual([0xd2, 0x52, 0x16]);
    expect(valueToRgb(-3)).toEqual(valueToRgb(0));
    expect(valueToRgb(9, 'glass')).toEqual(valueToRgb(1, 'glass'));
  });

  it('keeps the value ordering in both themes: a higher value is always darker', () => {
    const luminance = ([r, g, b]: readonly [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    for (const theme of ['normal', 'glass'] as const) {
      const ramp = Array.from({ length: 21 }, (_, step) => luminance(valueToRgb(step / 20, theme)));
      for (let step = 1; step < ramp.length; step += 1) {
        expect(ramp[step]).toBeLessThanOrEqual((ramp[step - 1] ?? 0) + 1e-9);
      }
    }
  });

  it('keeps even the lightest Normal tile clearly darker than the ivory page, so the silhouette reads', () => {
    const luminance = ([r, g, b]: readonly [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const page = luminance([0xf2, 0xf1, 0xec]);
    expect(page - luminance(valueToRgb(0, 'normal'))).toBeGreaterThan(18);
  });

  it('gives Kaca its own cool-tinted light end while the dark end stays orange', () => {
    const [nr, , nb] = valueToRgb(0, 'normal');
    const [gr, , gb] = valueToRgb(0, 'glass');
    expect(gb - gr).toBeGreaterThan(nb - nr);
    const [r, g, b] = valueToRgb(1, 'glass');
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
});

describe('lerpLightRig', () => {
  it('starts at one theme and ends exactly at the other', () => {
    const normal = lightRigFor('normal');
    const glass = lightRigFor('glass');
    expect(lerpLightRig(normal, glass, 0)).toEqual(normal);
    expect(lerpLightRig(normal, glass, 1)).toEqual(glass);
    expect(lerpLightRig(normal, glass, 0.5).shadowOpacity).toBeCloseTo(
      (normal.shadowOpacity + glass.shadowOpacity) / 2,
    );
  });
});

describe.each([
  ['desktop grid', rawDataset, 20],
  ['compact (phone) grid', compactDataset, 10],
])('geographic separation in the %s', (_name, source, minimumGroups) => {
  const { cells, hexSizeDeg } = parseHexDataset(source);
  const neighbourDistance = Math.sqrt(3) * hexSizeDeg * 1.05;

  // Connected groups of touching cells: islands that the grid keeps apart must be different groups.
  const group = new Map<string, number>();
  let groups = 0;
  for (const start of cells) {
    if (group.has(start.id)) continue;
    groups += 1;
    const queue = [start];
    group.set(start.id, groups);
    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) break;
      for (const other of cells) {
        if (group.has(other.id)) continue;
        if (Math.hypot(other.lon - current.lon, other.lat - current.lat) <= neighbourDistance) {
          group.set(other.id, groups);
          queue.push(other);
        }
      }
    }
  }

  const nearest = (lon: number, lat: number) => {
    let best = cells[0];
    for (const cell of cells) {
      if (!best || Math.hypot(cell.lon - lon, cell.lat - lat) < Math.hypot(best.lon - lon, best.lat - lat)) {
        best = cell;
      }
    }
    if (!best) throw new Error('no cells');
    return best;
  };

  it('is an archipelago, not one land mass', () => {
    expect(groups).toBeGreaterThanOrEqual(minimumGroups);
  });

  type Pair = [string, number, number, string, number, number];
  const pairs: Pair[] = [
    ['Sumatra', 101.5, -1.5, 'Java', 110.0, -7.3],
    ['Java', 109.0, -7.2, 'Bali', 115.1, -8.4],
    ['Kalimantan', 114.0, -1.0, 'Sulawesi', 120.0, -2.0],
    ['Sulawesi', 121.0, -1.5, 'Papua', 137.0, -4.5],
    ['Kalimantan', 114.0, -1.0, 'Java', 110.0, -7.3],
  ];
  // Bali has no cell of its own on the coarse phone grid, so that pair only applies to the fine one.
  const applicable = minimumGroups >= 20 ? pairs : pairs.filter(([, , , other]) => other !== 'Bali');

  it.each(applicable)(
    'keeps %s and %s apart (the strait or sea between them stays open)',
    (_a, lonA, latA, _b, lonB, latB) => {
      expect(group.get(nearest(lonA, latA).id)).not.toBe(group.get(nearest(lonB, latB).id));
    },
  );

  it('leaves the open seas empty (Makassar Strait, Java Sea, Banda Sea)', () => {
    for (const [lon, lat] of [
      [118.0, -1.0],
      [111.0, -4.8],
      [127.0, -5.5],
    ] as const) {
      const near = cells.filter((cell) => Math.hypot(cell.lon - lon, cell.lat - lat) < 0.5);
      expect(near).toHaveLength(0);
    }
  });
});
