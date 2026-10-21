import rawDataset from '../../../public/data/hex-indonesia.json';
import { parseHexDataset } from './hexDataset';
import { POSTER_HEIGHT, POSTER_WIDTH, buildHexPoster } from './posterGeometry';

describe('buildHexPoster', () => {
  const dataset = parseHexDataset(rawDataset);
  const withData = dataset.cells.filter((cell) => cell.hasData).length;
  const normal = buildHexPoster(dataset, 'normal');
  const glass = buildHexPoster(dataset, 'glass');

  it('draws every cell that has data (two lit sides and a top) with a shadow under each', () => {
    expect(normal.tiles).toHaveLength(withData * 3);
    expect(normal.shadows).toHaveLength(withData);
    expect(normal.outlines).toHaveLength(dataset.cells.length - withData);
  });

  it('paints back to front, so nearer tiles cover the ones behind them', () => {
    const topOrder = normal.tiles.filter((shape) => shape.key.startsWith('t-')).map((shape) => shape.key);
    const zOf = new Map(dataset.cells.map((cell) => [`t-${cell.id}`, cell.z]));
    for (let index = 1; index < topOrder.length; index += 1) {
      const previous = zOf.get(topOrder[index - 1] ?? '') ?? 0;
      const current = zOf.get(topOrder[index] ?? '') ?? 0;
      expect(current).toBeGreaterThanOrEqual(previous);
    }
  });

  it('keeps every point inside the poster box', () => {
    for (const shape of [...normal.tiles, ...normal.shadows, ...normal.outlines]) {
      for (const pair of shape.points.split(' ')) {
        const [x, y] = pair.split(',').map(Number);
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(POSTER_WIDTH);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(POSTER_HEIGHT);
      }
    }
  });

  it('uses the theme palette and the theme shadow colour, with the same shapes in both', () => {
    expect(glass.tiles.map((shape) => shape.points)).toEqual(normal.tiles.map((shape) => shape.points));
    expect(glass.tiles.map((shape) => shape.fill)).not.toEqual(normal.tiles.map((shape) => shape.fill));
    expect(normal.shadows[0]?.fill).toBe('rgb(70,52,36)');
    expect(glass.shadows[0]?.fill).toBe('rgb(12,28,110)');
  });
});
