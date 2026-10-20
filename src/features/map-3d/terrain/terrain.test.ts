import * as THREE from 'three';
import { fitCameraToPoints } from './cameraFit';
import { coastlineBounds, getIndonesiaCoastline, parseCoastlineDataset } from './coastline';
import { buildHeightField, createGrid, distanceTransform, expandBounds, rasterizeLand } from './heightField';
import { buildHeroTerrain } from './heroTerrain';

const coastline = getIndonesiaCoastline();

function isLand(lon: number, lat: number): boolean {
  const grid = createGrid({ minLon: lon, maxLon: lon, minLat: lat, maxLat: lat }, 1);
  return rasterizeLand(coastline.polygons, grid)[0] === 1;
}

describe('bundled Indonesia coastline', () => {
  it('documents its source, licence and processing', () => {
    expect(coastline.metadata.source).toMatch(/Natural Earth/);
    expect(coastline.metadata.license).toMatch(/[Pp]ublic domain/);
    expect(coastline.metadata.version).not.toBe('');
  });

  it('covers the archipelago from Sabang to Merauke, small islands included', () => {
    const bounds = coastlineBounds(coastline.polygons);
    expect(bounds.minLon).toBeLessThan(95.5);
    expect(bounds.maxLon).toBeGreaterThan(140.9);
    expect(bounds.minLat).toBeLessThan(-10.5);
    expect(bounds.maxLat).toBeGreaterThan(5.5);
    expect(coastline.polygons.length).toBeGreaterThan(200);
  });

  it.each([
    ['Sumatera', 101.5, -0.5],
    ['Jawa', 110.4, -7.5],
    ['Bali', 115.15, -8.4],
    ['Kalimantan', 113.9, -1.0],
    ['Sulawesi', 120.2, -2.0],
    ['Flores', 121.0, -8.7],
    ['Halmahera', 128.0, 1.0],
    ['Papua', 138.5, -4.5],
  ])('has land in %s', (_name, lon, lat) => {
    expect(isLand(lon, lat)).toBe(true);
  });

  it.each([
    ['Laut Jawa', 110.0, -5.0],
    ['Selat Makassar', 118.2, -2.0],
    ['Laut Banda', 127.0, -6.0],
  ])('has water in %s', (_name, lon, lat) => {
    expect(isLand(lon, lat)).toBe(false);
  });
});

describe('parseCoastlineDataset', () => {
  const valid = {
    type: 'FeatureCollection',
    metadata: {
      datasetId: 'test',
      version: '1',
      source: 'unit test',
      sourceUrl: 'https://example.invalid',
      license: 'Public domain',
      processing: 'none',
      purpose: 'test',
    },
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [110, -7],
              [111, -7],
              [111, -6],
              [110, -7],
            ],
          ],
        },
      },
    ],
  };

  it('accepts a well-formed dataset', () => {
    expect(parseCoastlineDataset(valid).polygons).toHaveLength(1);
  });

  it('rejects a dataset without a licence', () => {
    expect(() => parseCoastlineDataset({ ...valid, metadata: { ...valid.metadata, license: '' } })).toThrow(
      /license/,
    );
  });

  const withRing = (ring: number[][]) => ({
    ...valid,
    features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }],
  });

  it('rejects an open ring', () => {
    const open = withRing([
      [110, -7],
      [111, -7],
      [111, -6],
      [110, -6.5],
    ]);
    expect(() => parseCoastlineDataset(open)).toThrow(/tidak tertutup/);
  });

  it('rejects coordinates outside Indonesia', () => {
    const far = withRing([
      [10, 50],
      [11, 50],
      [11, 51],
      [10, 50],
    ]);
    expect(() => parseCoastlineDataset(far)).toThrow(/di luar wilayah/);
  });
});

describe('distanceTransform', () => {
  it('measures grid steps to the nearest node of the other class', () => {
    // 5×5 with a single land node in the centre.
    const mask = new Uint8Array(25);
    mask[12] = 1;
    const toLand = distanceTransform(mask, 5, 5, 0);
    expect(toLand[12]).toBe(0);
    expect(toLand[11]).toBe(1);
    expect(toLand[6]).toBeCloseTo(Math.SQRT2, 5);
    expect(toLand[10]).toBe(2);
  });
});

describe('illustrative height field', () => {
  const grid = createGrid(expandBounds(coastlineBounds(coastline.polygons), 3), 0.25);
  const options = { maxRelief: 0.7, coastRampDeg: 0.9 };
  const field = buildHeightField(coastline.polygons, grid, options);

  it('is zero on water and stays within the relief budget on land', () => {
    let landPeak = 0;
    field.heights.forEach((height, i) => {
      if (field.land[i] === 1) landPeak = Math.max(landPeak, height);
      else expect(height).toBe(0);
    });
    expect(landPeak).toBeGreaterThan(0.3);
    expect(landPeak).toBeLessThanOrEqual(options.maxRelief);
  });

  it('is deterministic across builds', () => {
    expect(buildHeightField(coastline.polygons, grid, options).heights).toEqual(field.heights);
  });
});

describe('fitCameraToPoints', () => {
  const points = [
    new THREE.Vector3(-23, 0, 8),
    new THREE.Vector3(22, 0, 7),
    new THREE.Vector3(-20, 0.4, -8),
    new THREE.Vector3(21, 0.4, -6),
  ];

  it.each([1.09, 0.62, 1.8])('keeps every point inside the margin at aspect %f, and fills it', (aspect) => {
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 400);
    fitCameraToPoints(camera, points, { elevationDeg: 54, margin: 0.05 });
    const extents = points.map((p) => {
      const ndc = p.clone().project(camera);
      return Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
    });
    expect(Math.max(...extents)).toBeLessThanOrEqual(0.95 + 1e-6);
    expect(Math.max(...extents)).toBeGreaterThan(0.94);
  });
});

describe('buildHeroTerrain', () => {
  const project = (lon: number, lat: number, elevation = 0) =>
    new THREE.Vector3(lon - 118, elevation, -(lat + 2));
  const options = { project, reliefBumpMap: new THREE.Texture(), oceanBumpMap: new THREE.Texture() };
  const terrain = buildHeroTerrain(coastline, options);

  it('raises island interiors above the shore', () => {
    expect(terrain.surfaceHeightAt(113.9, -1.0)).toBeGreaterThan(terrain.surfaceHeightAt(110.0, -5.0) + 0.1);
  });

  it('frames the whole archipelago', () => {
    const size = terrain.landBounds.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(44);
    expect(terrain.framingPoints.length).toBeGreaterThan(8);
  });

  it('reuses the computed data on the next build, with fresh GPU objects', () => {
    const again = buildHeroTerrain(coastline, options);
    const first = terrain.land.children[1] as THREE.Mesh;
    const second = again.land.children[1] as THREE.Mesh;
    expect(second.geometry).not.toBe(first.geometry);
    expect(second.geometry.getAttribute('position')).toBe(first.geometry.getAttribute('position'));
    again.dispose();
  });
});
