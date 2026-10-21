import rawDataset from '../../../public/data/hex-indonesia.json';
import { parseHexDataset } from './hexDataset';
import { valueToRgb } from './hexColors';

describe('parseHexDataset', () => {
  it('accepts the generated file and keeps its simulated label', () => {
    const dataset = parseHexDataset(rawDataset);
    expect(dataset.cells.length).toBeGreaterThan(100);
    expect(rawDataset.metadata.kind).toBe('DEMO_SIMULATION');
    expect(dataset.cells.some((cell) => !cell.hasData)).toBe(true);
    expect(dataset.cells.every((cell) => (cell.hasData ? cell.value !== null : cell.value === null))).toBe(
      true,
    );
  });

  it('spreads the simulated values over the whole 0–1 range', () => {
    const values = parseHexDataset(rawDataset)
      .cells.map((cell) => cell.value)
      .filter((value): value is number => value !== null);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(1);
  });

  it('rejects a file that is not marked as a simulation', () => {
    const real = { ...rawDataset, metadata: { ...rawDataset.metadata, kind: 'OFFICIAL' } };
    expect(() => parseHexDataset(real)).toThrow(/DEMO_SIMULATION/);
  });

  it('rejects a missing value that is not null, and a value outside 0–1', () => {
    const [first] = rawDataset.cells;
    if (!first) throw new Error('empty dataset');
    const withBad = (cell: object) => ({ ...rawDataset, cells: [cell] });
    expect(() => parseHexDataset(withBad({ ...first, hasData: false, value: 0 }))).toThrow(/null/);
    expect(() => parseHexDataset(withBad({ ...first, hasData: true, value: 1.4 }))).toThrow(/0–1/);
    expect(() => parseHexDataset({ ...rawDataset, cells: [] })).toThrow(/kosong/);
  });
});

describe('valueToRgb', () => {
  it('runs from limestone white to dark orange and clamps out-of-range values', () => {
    expect(valueToRgb(0)).toEqual([0xfb, 0xfa, 0xf6]);
    expect(valueToRgb(1)).toEqual([0xd9, 0x58, 0x1a]);
    expect(valueToRgb(-3)).toEqual(valueToRgb(0));
    expect(valueToRgb(9)).toEqual(valueToRgb(1));
  });
});
