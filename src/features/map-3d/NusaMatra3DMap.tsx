import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Real CSS Module. Kept separate from the Three.js engine for host integration.
import styles from './NusaMatra3DMap.module.css';
import { PointOverlay, type MapOverlayPoint } from './pointOverlay';
import { consolidateExtrudeGroups, ringsToSegmentsGeometry } from './regionGeometry';
import { fbmNoise } from './terrain/noise';
import { getIndonesiaCoastline } from './terrain/coastline';
import { buildHeroTerrain, type HeroTerrain } from './terrain/heroTerrain';
import { HERO_SUN_DIRECTION } from './terrain/heightField';
import { fitCameraToPoints, type CameraPose } from './terrain/cameraFit';

/** Hero framing: elevation of the camera and the free border kept for parallax and the intro. */
/** Start-up camera of the Explore map, (0, 33, 29): its distance and the direction it looks from. */
const EXPLORE_CAMERA_DISTANCE = Math.hypot(33, 29);
const EXPLORE_CAMERA_DIRECTION = new THREE.Vector3(0, 33, 29).normalize();
const EXPLORE_FOG_NEAR = 32;
const EXPLORE_FOG_FAR = 118;
/** Extra room around the official geography when it is fitted to the canvas width. */
const EXPLORE_FIT_MARGIN = 1.2;

/**
 * Host fix: how far the camera must be for a ground strip of `width` to fit the canvas. LIVE
 * geography (the whole archipelago) is fitted this way so it is never cropped, whatever the shape of
 * the canvas beside the side panel or above a phone's sheet; it never comes closer than start-up.
 */
function exploreDefaultPosition(
  eng: { camera: THREE.PerspectiveCamera; scene: THREE.Scene; exploreFrame: { width: number } | null },
  target: THREE.Vector3,
): THREE.Vector3 {
  const distance = eng.exploreFrame
    ? exploreFitDistance(eng.camera, eng.exploreFrame.width, eng.scene)
    : EXPLORE_CAMERA_DISTANCE;
  return target.clone().addScaledVector(EXPLORE_CAMERA_DIRECTION, distance);
}

function exploreFitDistance(camera: THREE.PerspectiveCamera, width: number, scene?: THREE.Scene): number {
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const fitting = (width * EXPLORE_FIT_MARGIN) / (2 * Math.tan(halfFov) * camera.aspect);
  const distance = Math.max(EXPLORE_CAMERA_DISTANCE, fitting);
  // The haze was tuned for the start-up distance; keep it in proportion when the camera backs off,
  // or the land washes out toward the sea colour.
  if (scene?.fog instanceof THREE.Fog) {
    const ratio = distance / EXPLORE_CAMERA_DISTANCE;
    scene.fog.near = EXPLORE_FOG_NEAR * ratio;
    scene.fog.far = EXPLORE_FOG_FAR * ratio;
  }
  return distance;
}

const NO_OVERLAY_POINTS: readonly MapOverlayPoint[] = [];

const HERO_CAMERA_ELEVATION_DEG = 54;
const HERO_FRAME_MARGIN = 0.05;
const HERO_MARKER_SCALE = 2.2;
/** Fog band as multiples of the camera distance: clear over the land, solid well before the sea ends. */
const HERO_FOG_NEAR = 1.3;
const HERO_FOG_FAR = 2.6;

// ============================================================================
// 1. PUBLIC TYPES & STRICT API CONTRACT
// ============================================================================

export type NusaMatraDisplayMode = 'normal' | 'glass';
export type MapPresentationMode = 'hero' | 'explore';
export type DataMode = 'DEMO' | 'LIVE';
export type CameraPreset = 'perspective' | 'top-down';

export interface RegionSelection {
  regionId: string;
  displayName: string;
  boundaryEditionId: string;
  dataMode: DataMode;
  codeSystem?: string;
  regionCode?: string;
}

export interface GeoFeatureProperties {
  regionId: string;
  displayName: string;
  regionCode?: string;
  tier?: 1 | 2 | 3 | 4;
  focusLon?: number;
  focusLat?: number;
  focusDistance?: number;
  summaryNote?: string;
}

export type LonLatPair = [number, number] | number[];
export type LinearRing = LonLatPair[];
export type PolygonCoordinates = LinearRing[];
export type MultiPolygonCoordinates = PolygonCoordinates[];

export interface ValidatedGeoFeature {
  type: 'Feature';
  properties: GeoFeatureProperties;
  geometry:
    | {
        type: 'Polygon';
        coordinates: PolygonCoordinates;
      }
    | {
        type: 'MultiPolygon';
        coordinates: MultiPolygonCoordinates;
      };
}

export interface GeographyDatasetMetadata {
  datasetId: string;
  boundaryEditionId: string;
  codeSystem: string;
  dataMode: DataMode;
  isAuthoritative: boolean;
  provenanceNote: string;
  snapshotId?: string;
}

export interface GeographyDataset {
  type: 'FeatureCollection';
  metadata: GeographyDatasetMetadata;
  features: ValidatedGeoFeature[];
}

export interface StrategicMarker {
  id: string;
  name: string;
  lon: number;
  lat: number;
  category: 'anchor' | 'regional-node';
  note: string;
}

export interface NusaMatra3DMapHandle {
  focusRegion: (regionId: string) => void;
  focusCoordinates: (lon: number, lat: number, distance?: number) => void;
  resetCamera: () => void;
  setCameraPreset: (preset: CameraPreset) => void;
  triggerExploreTransition: () => void;
}

export interface NusaMatra3DMapProps {
  mode?: MapPresentationMode;
  displayMode?: NusaMatraDisplayMode;
  className?: string;
  reducedMotion?: boolean;
  dataMode?: DataMode;
  /** Versioned geometry supplied by the host, not fetched secretly by renderer. */
  geography?: unknown;
  selectedRegionId?: string | null;
  onSelectRegion?: (region: RegionSelection) => void;
  onHoverRegion?: (region: RegionSelection | null) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
  /** Optional explore-mode visual toggles controlled by host */
  showGraticule?: boolean;
  showMarkers?: boolean;
  showCoastlines?: boolean;
  cameraPreset?: CameraPreset;
  /** Optional DEV-only inspector panel (off by default in production) */
  enableDevInspector?: boolean;
  /** Host fix: clickable points drawn over the map (e.g. BMKG epicentres); never touch region geometry. */
  overlayPoints?: readonly MapOverlayPoint[];
  selectedOverlayId?: string | null;
  onSelectOverlay?: (id: string) => void;
}

// ============================================================================
// 2. KAPUR & KOBALT PALETTE TOKENS
// ============================================================================

export const KAPUR_KOBALT_PALETTE = {
  seaDeep: '#1E3FD9',
  sea: '#2F5BFF',
  seaShallow: '#5C7FFF',
  land1: '#FBFAF6',
  land2: '#EDE9DF',
  land3: '#D9D3C3',
  land4: '#B8AF9A',
  bg: '#F2F1EC',
  surface: '#FBFAF6',
  text: '#121826',
  textMuted: '#5A6170',
  textOnSea: '#FFFFFF',
  accent: '#FF8A3D',
  accentHover: '#FF7420',
  sunLight: '#FFF6EA',
} as const;

export function getTierColorHex(tier: 1 | 2 | 3 | 4 = 1): number {
  switch (tier) {
    case 1:
      return 0xfbfaf6; // --land-1
    case 2:
      return 0xede9df; // --land-2
    case 3:
      return 0xd9d3c3; // --land-3
    case 4:
      return 0xb8af9a; // --land-4
    default:
      return 0xfbfaf6;
  }
}

/**
 * Jelajahi atlas materials per display mode (Kapur & Kobalt). Every region gets the same land
 * colour: the map shows no indicator, so nothing may read as a choropleth. Hover and selection
 * recolour only the top surface, and stay distinct from the earthquake markers (dark discs with a
 * light ring).
 */
export interface AtlasPalette {
  readonly ocean: string;
  readonly landTop: string;
  readonly landSide: string;
  readonly boundary: string;
  readonly hover: string;
  readonly selected: string;
  readonly graticule: string;
}

export const EXPLORE_ATLAS_PALETTE: Readonly<Record<NusaMatraDisplayMode, AtlasPalette>> = {
  normal: {
    ocean: '#DCE8FF',
    landTop: '#F2EBDD',
    landSide: '#D4CBB8',
    boundary: '#B9AB92',
    hover: '#8CACFF',
    selected: '#2F5BFF',
    graticule: '#AFC4F2',
  },
  glass: {
    ocean: '#17368C',
    landTop: '#FBFAF6',
    landSide: '#D4CBB8',
    boundary: '#B9AB92',
    hover: '#8CACFF',
    selected: '#2F5BFF',
    graticule: '#2F5BFF',
  },
};

/**
 * Explore lights. MeshStandardMaterial reflects albedo / π of the light it receives, so a surface
 * facing up is lit with about π in total (sky + sun + rim) and renders at its palette colour. Most of
 * it is soft sky light, which keeps shadows and extruded sides gentle.
 */
const EXPLORE_HEMI_INTENSITY = 2.1;
const EXPLORE_SUN_INTENSITY = 1.25;
const EXPLORE_RIM_INTENSITY = 0.25;

/** Share of land colour in the hemisphere's ground (bounce) light; the rest is the sea's. */
const SIDE_BOUNCE_LAND_SHARE = 0.8;

type RegionPaint = 'idle' | 'hover' | 'selected';
const REGION_LIFT: Readonly<Record<RegionPaint, number>> = { idle: 0, hover: 0.08, selected: 0.16 };

/** Colour and lift of one region for its interaction state; the only place regions are recoloured. */
function paintRegion(group: THREE.Group, palette: AtlasPalette, state: RegionPaint): void {
  const top = group.userData.topMaterial as THREE.MeshStandardMaterial;
  top.color.set(
    state === 'selected' ? palette.selected : state === 'hover' ? palette.hover : palette.landTop
  );
  group.position.y = REGION_LIFT[state];
}

// ============================================================================
// 3. DOCUMENTED EQUIDISTANT CYLINDRICAL PROJECTION
// ============================================================================

export const PROJECTION_CENTER_LON = 118.0;
export const PROJECTION_CENTER_LAT = -2.0;
export const PROJECTION_SCALE = 1.0;
const COS_CENTER_LAT = Math.cos((PROJECTION_CENTER_LAT * Math.PI) / 180);

export function lonLatToPlanar(
  lon: number,
  lat: number,
  elevation = 0
): THREE.Vector3 {
  const x = (lon - PROJECTION_CENTER_LON) * PROJECTION_SCALE * COS_CENTER_LAT;
  const z = -(lat - PROJECTION_CENTER_LAT) * PROJECTION_SCALE;
  return new THREE.Vector3(x, elevation, z);
}

export function planarToLonLat(
  x: number,
  z: number
): { lon: number; lat: number } {
  const lon = x / (PROJECTION_SCALE * COS_CENTER_LAT) + PROJECTION_CENTER_LON;
  const lat = -z / PROJECTION_SCALE + PROJECTION_CENTER_LAT;
  return { lon, lat };
}

// ============================================================================
// 4. DEMO / ILLUSTRATIVE GEOGRAPHY & TOPOLOGY VALIDATOR
// ============================================================================

export const HERO_DIORAMA_MARKERS: StrategicMarker[] = [
  {
    id: 'hero-node-west',
    name: 'Simpul Barat (Sumatera-Jawa)',
    lon: 106.85,
    lat: -6.2,
    category: 'anchor',
    note: 'Titik orientasi barat diorama ilustratif.',
  },
  {
    id: 'hero-node-central',
    name: 'Simpul Tengah (Kalimantan-Sulawesi)',
    lon: 116.7,
    lat: -0.97,
    category: 'anchor',
    note: 'Titik orientasi tengah kepulauan.',
  },
  {
    id: 'hero-node-east',
    name: 'Simpul Timur (Maluku-Papua)',
    lon: 135.5,
    lat: -3.8,
    category: 'anchor',
    note: 'Titik orientasi timur diorama ilustratif.',
  },
];

export const EXPLORE_DEMO_MARKERS: StrategicMarker[] = [
  {
    id: 'ref-jkt',
    name: 'Jakarta (Titik Referensi)',
    lon: 106.8456,
    lat: -6.2088,
    category: 'anchor',
    note: 'Titik referensi koordinat perkotaan barat.',
  },
  {
    id: 'ref-ikn',
    name: 'IKN Nusantara (Titik Referensi)',
    lon: 116.705,
    lat: -0.973,
    category: 'anchor',
    note: 'Titik referensi koordinat Kalimantan Timur.',
  },
  {
    id: 'ref-mdn',
    name: 'Medan',
    lon: 98.6722,
    lat: 3.5952,
    category: 'regional-node',
    note: 'Titik referensi Sumatera bagian utara.',
  },
  {
    id: 'ref-sby',
    name: 'Surabaya',
    lon: 112.7521,
    lat: -7.2575,
    category: 'regional-node',
    note: 'Titik referensi Jawa bagian timur.',
  },
  {
    id: 'ref-mks',
    name: 'Makassar',
    lon: 119.4327,
    lat: -5.1477,
    category: 'regional-node',
    note: 'Titik referensi kawasan Sulawesi.',
  },
  {
    id: 'ref-amb',
    name: 'Ambon',
    lon: 128.1814,
    lat: -3.6954,
    category: 'regional-node',
    note: 'Titik referensi kepulauan Maluku.',
  },
  {
    id: 'ref-jyp',
    name: 'Jayapura',
    lon: 140.7181,
    lat: -2.5337,
    category: 'regional-node',
    note: 'Titik referensi kawasan timur Papua.',
  },
];

export const DEMO_ILLUSTRATIVE_GEOGRAPHY: GeographyDataset = {
  type: 'FeatureCollection',
  metadata: {
    datasetId: 'nusa-matra-demo-archipelago-v1',
    boundaryEditionId: 'DEMO-SILHOUETTE-2026-V1',
    codeSystem: 'DEMO_ISLAND_GROUP',
    dataMode: 'DEMO',
    isAuthoritative: false,
    provenanceNote:
      'Siluet gugus pulau ilustratif untuk demonstrasi UI/3D. Bukan batas administrasi resmi provinsi/kabupaten/kota.',
    snapshotId: 'SIM-SNAPSHOT-001',
  },
  features: [
    {
      type: 'Feature',
      properties: {
        regionId: 'ID-DEMO-SUMATERA',
        displayName: 'Gugus Pulau Sumatera (Simulasi)',
        regionCode: 'DEMO-01',
        tier: 1,
        focusLon: 101.5,
        focusLat: -0.5,
        focusDistance: 18,
        summaryNote:
          'Geometri gugus pulau simulasi. Indikator kebijakan belum dimuat pada mode DEMO.',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [95.3, 5.55],
              [95.8, 5.4],
              [96.4, 5.2],
              [97.1, 5.25],
              [97.5, 5.1],
              [98.0, 4.4],
              [98.7, 3.8],
              [99.1, 3.3],
              [99.8, 2.95],
              [100.1, 2.5],
              [100.6, 2.1],
              [101.4, 1.65],
              [102.1, 1.45],
              [102.5, 1.0],
              [103.4, 0.75],
              [103.6, 0.3],
              [103.5, -0.3],
              [103.8, -0.8],
              [104.4, -1.05],
              [104.5, -1.6],
              [104.9, -2.1],
              [105.9, -2.9],
              [106.0, -3.3],
              [105.8, -4.1],
              [105.85, -5.0],
              [105.7, -5.85],
              [105.2, -5.8],
              [104.6, -5.9],
              [103.9, -5.25],
              [103.0, -4.5],
              [102.2, -3.8],
              [101.2, -2.6],
              [100.4, -1.3],
              [99.9, -0.4],
              [99.1, 0.3],
              [98.8, 1.2],
              [98.5, 1.7],
              [97.9, 2.25],
              [97.4, 2.9],
              [96.9, 3.55],
              [96.4, 4.15],
              [95.6, 4.65],
              [95.2, 5.25],
              [95.3, 5.55],
            ],
          ],
          [
            [
              [105.2, -1.6],
              [105.9, -1.8],
              [106.5, -2.3],
              [106.8, -2.95],
              [106.4, -3.1],
              [105.9, -2.5],
              [105.2, -2.0],
              [105.2, -1.6],
            ],
          ],
          [
            [
              [107.5, -2.55],
              [108.2, -2.55],
              [108.3, -3.2],
              [107.6, -3.25],
              [107.5, -2.55],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        regionId: 'ID-DEMO-JAWA',
        displayName: 'Gugus Pulau Jawa & Madura (Simulasi)',
        regionCode: 'DEMO-02',
        tier: 2,
        focusLon: 110.0,
        focusLat: -7.2,
        focusDistance: 13,
        summaryNote:
          'Geometri gugus pulau simulasi. Gunakan adapter Data Hub untuk memuat batas kabupaten/kota resmi.',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [105.2, -6.75],
              [105.6, -6.5],
              [106.0, -5.9],
              [106.7, -6.05],
              [107.0, -5.95],
              [107.5, -6.2],
              [107.8, -6.25],
              [108.3, -6.3],
              [108.5, -6.7],
              [109.0, -6.8],
              [109.7, -6.85],
              [110.4, -6.9],
              [110.8, -6.4],
              [111.1, -6.7],
              [111.9, -6.8],
              [112.6, -6.9],
              [112.8, -7.3],
              [113.3, -7.7],
              [114.0, -7.7],
              [114.45, -8.1],
              [114.4, -8.75],
              [113.9, -8.6],
              [113.4, -8.4],
              [112.6, -8.35],
              [111.8, -8.25],
              [111.0, -8.25],
              [110.3, -8.0],
              [109.3, -7.75],
              [108.7, -7.7],
              [108.2, -7.75],
              [107.4, -7.5],
              [106.4, -7.4],
              [106.4, -6.95],
              [105.5, -6.9],
              [105.2, -6.75],
            ],
          ],
          [
            [
              [112.7, -6.9],
              [113.5, -6.9],
              [114.1, -7.0],
              [113.9, -7.25],
              [112.8, -7.2],
              [112.7, -6.9],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        regionId: 'ID-DEMO-NUSATENGGARA',
        displayName: 'Gugus Bali & Nusa Tenggara (Simulasi)',
        regionCode: 'DEMO-03',
        tier: 3,
        focusLon: 119.5,
        focusLat: -8.8,
        focusDistance: 14,
        summaryNote:
          'Geometri gugus kepulauan simulasi. Tidak merepresentasikan skor prioritas daerah.',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [114.45, -8.1],
              [115.1, -8.1],
              [115.7, -8.35],
              [115.5, -8.8],
              [115.1, -8.8],
              [114.6, -8.4],
              [114.45, -8.1],
            ],
          ],
          [
            [
              [115.8, -8.3],
              [116.6, -8.25],
              [116.7, -8.85],
              [115.8, -8.85],
              [115.8, -8.3],
            ],
          ],
          [
            [
              [116.75, -8.4],
              [117.6, -8.15],
              [118.2, -8.3],
              [119.0, -8.4],
              [119.1, -8.8],
              [118.2, -8.85],
              [117.3, -9.0],
              [116.7, -8.95],
              [116.75, -8.4],
            ],
          ],
          [
            [
              [119.8, -8.4],
              [120.6, -8.25],
              [121.5, -8.4],
              [122.3, -8.3],
              [123.0, -8.2],
              [123.0, -8.55],
              [122.0, -8.8],
              [121.0, -8.9],
              [119.9, -8.8],
              [119.8, -8.4],
            ],
          ],
          [
            [
              [119.0, -9.35],
              [120.2, -9.6],
              [120.8, -10.1],
              [120.2, -10.3],
              [119.3, -9.8],
              [119.0, -9.35],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        regionId: 'ID-DEMO-KALIMANTAN',
        displayName: 'Gugus Pulau Kalimantan (Simulasi)',
        regionCode: 'DEMO-04',
        tier: 1,
        focusLon: 114.2,
        focusLat: 0.5,
        focusDistance: 17,
        summaryNote:
          'Siluet ilustratif Kalimantan pada mode DEMO. Batas negara/provinsi resmi memerlukan dataset LIVE.',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [108.8, 0.8],
              [109.6, 2.0],
              [110.5, 1.2],
              [111.5, 1.1],
              [112.2, 1.4],
              [113.6, 1.3],
              [114.6, 1.8],
              [115.5, 3.2],
              [115.8, 4.3],
              [117.8, 4.2],
              [117.9, 3.5],
              [117.6, 2.7],
              [118.0, 2.1],
              [118.9, 1.0],
              [117.9, 0.5],
              [117.5, -0.5],
              [116.8, -1.3],
              [116.5, -2.1],
              [116.2, -3.3],
              [116.0, -3.6],
              [115.0, -3.8],
              [114.5, -4.1],
              [114.3, -3.4],
              [113.3, -3.3],
              [112.5, -3.3],
              [111.7, -3.5],
              [111.0, -2.9],
              [110.1, -2.9],
              [110.0, -1.8],
              [109.2, -0.8],
              [108.9, 0.1],
              [108.8, 0.8],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        regionId: 'ID-DEMO-SULAWESI',
        displayName: 'Gugus Pulau Sulawesi (Simulasi)',
        regionCode: 'DEMO-05',
        tier: 2,
        focusLon: 121.0,
        focusLat: -2.0,
        focusDistance: 15,
        summaryNote:
          'Geometri gugus pulau Sulawesi untuk simulasi navigasi kamera dan seleksi fitur.',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [118.8, -2.7],
              [119.3, -1.2],
              [119.9, 0.2],
              [120.4, 1.0],
              [121.5, 1.0],
              [122.8, 0.95],
              [124.0, 0.9],
              [125.1, 1.65],
              [125.2, 1.35],
              [124.5, 0.6],
              [123.2, 0.35],
              [121.5, 0.4],
              [120.5, 0.1],
              [120.6, -0.9],
              [121.6, -0.9],
              [122.6, -0.6],
              [123.5, -0.8],
              [123.3, -1.3],
              [122.1, -1.5],
              [121.6, -2.1],
              [122.3, -3.1],
              [122.9, -4.1],
              [122.5, -4.6],
              [121.6, -4.6],
              [121.3, -3.7],
              [120.7, -2.6],
              [120.3, -3.2],
              [120.4, -4.5],
              [120.5, -5.6],
              [119.4, -5.6],
              [119.4, -4.5],
              [119.6, -3.5],
              [118.9, -3.5],
              [118.8, -2.7],
            ],
          ],
          [
            [
              [122.6, -4.5],
              [123.2, -4.4],
              [123.1, -5.4],
              [122.5, -5.5],
              [122.6, -4.5],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        regionId: 'ID-DEMO-MALUKU',
        displayName: 'Gugus Kepulauan Maluku (Simulasi)',
        regionCode: 'DEMO-06',
        tier: 3,
        focusLon: 128.5,
        focusLat: -2.2,
        focusDistance: 14,
        summaryNote:
          'Geometri gugus kepulauan Maluku untuk simulasi eksplorasi spasial.',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [127.4, 1.5],
              [127.9, 2.2],
              [128.0, 1.6],
              [128.7, 1.5],
              [128.4, 0.8],
              [127.9, 0.6],
              [128.2, -0.2],
              [128.1, -0.8],
              [127.6, -0.5],
              [127.5, 0.4],
              [127.4, 1.5],
            ],
          ],
          [
            [
              [127.9, -3.0],
              [129.0, -2.8],
              [130.5, -3.1],
              [130.8, -3.8],
              [129.5, -3.5],
              [128.0, -3.5],
              [127.9, -3.0],
            ],
          ],
          [
            [
              [126.0, -3.1],
              [127.1, -3.1],
              [127.2, -3.8],
              [126.1, -3.7],
              [126.0, -3.1],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        regionId: 'ID-DEMO-PAPUA',
        displayName: 'Gugus Tanah Papua (Simulasi)',
        regionCode: 'DEMO-07',
        tier: 4,
        focusLon: 136.0,
        focusLat: -4.2,
        focusDistance: 17,
        summaryNote:
          'Geometri siluet Papua dengan tingkatan warna kapur ke-4 (relief ilustratif, bukan DEM).',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [130.9, -1.2],
              [131.5, -0.8],
              [132.5, -0.4],
              [134.0, -0.8],
              [134.1, -1.8],
              [134.5, -2.5],
              [135.2, -3.2],
              [136.0, -2.1],
              [138.0, -1.6],
              [139.5, -2.1],
              [140.9, -2.6],
              [140.95, -9.1],
              [140.2, -8.5],
              [139.0, -8.1],
              [137.8, -8.3],
              [138.2, -7.4],
              [138.8, -6.2],
              [138.1, -5.5],
              [136.8, -4.9],
              [135.0, -4.3],
              [134.0, -4.0],
              [133.2, -3.5],
              [132.5, -2.9],
              [133.5, -2.3],
              [132.2, -2.1],
              [131.2, -1.6],
              [130.9, -1.2],
            ],
          ],
        ],
      },
    },
  ],
};

function normalizeAndValidateRing(rawRing: unknown, regionId: string): LinearRing {
  if (!Array.isArray(rawRing) || rawRing.length < 3) {
    throw new Error(
      `Geometri tidak valid pada wilayah "${regionId}": setiap cincin poligon membutuhkan minimal 3 titik koordinat.`
    );
  }

  const normalized: LinearRing = [];
  for (const pt of rawRing) {
    if (
      !Array.isArray(pt) ||
      pt.length < 2 ||
      typeof pt[0] !== 'number' ||
      typeof pt[1] !== 'number' ||
      !Number.isFinite(pt[0]) ||
      !Number.isFinite(pt[1])
    ) {
      throw new Error(
        `Koordinat tidak valid pada wilayah "${regionId}": wajib berupa pasangan angka [lon, lat] yang terbatas.`
      );
    }
    const lon = pt[0];
    const lat = pt[1];
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      throw new Error(
        `Koordinat di luar rentang geografis pada wilayah "${regionId}": [${lon}, ${lat}].`
      );
    }
    normalized.push([lon, lat]);
  }

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  if (!first || !last) {
    throw new Error(`Cincin poligon pada wilayah "${regionId}" kosong.`);
  }
  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalized.push([first[0], first[1]]);
  }

  if (normalized.length < 4) {
    throw new Error(
      `Cincin poligon pada wilayah "${regionId}" tidak membentuk area tertutup yang valid.`
    );
  }

  return normalized;
}

/** Fallback camera focus for official geometry without explicit focus coordinates. */
export function approximateFeatureCenter(feature: ValidatedGeoFeature): { lon: number; lat: number } {
  const polygons: MultiPolygonCoordinates = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const point of ring) {
        minLon = Math.min(minLon, point[0]);
        maxLon = Math.max(maxLon, point[0]);
        minLat = Math.min(minLat, point[1]);
        maxLat = Math.max(maxLat, point[1]);
      }
    }
  }
  return { lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2 };
}

export function validateAndAdaptGeography(
  input: unknown,
  expectedDataMode: DataMode = 'DEMO'
): GeographyDataset {
  if (input === undefined || input === null) {
    // Host integration fix: the metadata checks that used to sit here read `candidate` before
    // it was declared (a TDZ ReferenceError on every call without a dataset). They now run on
    // the supplied dataset below; with no dataset only the DEMO illustration is allowed.
    if (expectedDataMode === 'LIVE') {
      throw new Error(
        'Mode LIVE aktif, tetapi dataset geografi terverifikasi belum diberikan oleh aplikasi host.'
      );
    }
    return DEMO_ILLUSTRATIVE_GEOGRAPHY;
  }

  if (typeof input !== 'object') {
    throw new Error('Dataset geografi tidak valid: wajib berupa objek FeatureCollection.');
  }

  const candidate = input as Partial<GeographyDataset>;
  if (
    candidate.type !== 'FeatureCollection' ||
    !Array.isArray(candidate.features) ||
    !candidate.metadata ||
    typeof candidate.metadata.boundaryEditionId !== 'string' ||
    !candidate.metadata.boundaryEditionId.trim() ||
    typeof candidate.metadata.codeSystem !== 'string' ||
    !candidate.metadata.codeSystem.trim()
  ) {
    throw new Error(
      'Format dataset geografi tidak valid: wajib berupa FeatureCollection dengan metadata boundaryEditionId dan codeSystem.'
    );
  }

  const meta = candidate.metadata;
  if (
    typeof meta.datasetId !== 'string' || !meta.datasetId.trim() ||
    typeof meta.provenanceNote !== 'string' || !meta.provenanceNote.trim() ||
    (meta.dataMode !== 'DEMO' && meta.dataMode !== 'LIVE') ||
    typeof meta.isAuthoritative !== 'boolean' ||
    meta.dataMode !== expectedDataMode
  ) {
    throw new Error('Metadata geografi tidak lengkap atau dataMode dataset tidak cocok dengan mode aplikasi.');
  }
  if (expectedDataMode === 'LIVE' &&
    (typeof meta.snapshotId !== 'string' || !meta.snapshotId.trim())) {
    throw new Error('Dataset LIVE wajib mempunyai snapshotId dan metadata provenance yang jelas.');
  }

  if (expectedDataMode === 'LIVE') {
    if (
      candidate.metadata.dataMode !== 'LIVE' ||
      candidate.metadata.isAuthoritative !== true
    ) {
      throw new Error(
        'Pelanggaran kontrak data: tidak diizinkan menggunakan geometri DEMO atau non-otoritatif ketika aplikasi berada dalam mode LIVE.'
      );
    }
  }

  const seenIds = new Set<string>();
  const validatedFeatures: ValidatedGeoFeature[] = [];

  for (const rawFeature of candidate.features) {
    if (!rawFeature || typeof rawFeature !== 'object' || rawFeature.type !== 'Feature') {
      throw new Error('Ditemukan elemen fitur yang bukan GeoJSON Feature valid.');
    }

    const props = rawFeature.properties;
    if (
      !props ||
      typeof props.regionId !== 'string' ||
      !props.regionId.trim() ||
      typeof props.displayName !== 'string' ||
      !props.displayName.trim()
    ) {
      throw new Error(
        'Setiap fitur wajib memiliki properties.regionId dan properties.displayName kanonik (tidak boleh dibuat otomatis dari nama tampilan).'
      );
    }

    const regionId = props.regionId.trim();
    if (seenIds.has(regionId)) {
      throw new Error(`Ditemukan duplikasi regionId "${regionId}" di dalam dataset geografi.`);
    }
    seenIds.add(regionId);

    const geom = rawFeature.geometry;
    if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) {
      throw new Error(
        `Geometri pada wilayah "${regionId}" wajib bertipe Polygon atau MultiPolygon.`
      );
    }

    if (geom.type === 'Polygon') {
      if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
        throw new Error(`Poligon pada wilayah "${regionId}" tidak memiliki cincin koordinat.`);
      }
      const rings = geom.coordinates.map((ring) =>
        normalizeAndValidateRing(ring, regionId)
      );
      validatedFeatures.push({
        type: 'Feature',
        properties: { ...props, regionId },
        geometry: {
          type: 'Polygon',
          coordinates: rings,
        },
      });
    } else {
      if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
        throw new Error(
          `MultiPolygon pada wilayah "${regionId}" tidak memiliki daftar poligon.`
        );
      }
      const polygons: MultiPolygonCoordinates = geom.coordinates.map((poly) => {
        if (!Array.isArray(poly) || poly.length === 0) {
          throw new Error(`Poligon kosong di dalam MultiPolygon "${regionId}".`);
        }
        return poly.map((ring) => normalizeAndValidateRing(ring, regionId));
      });
      validatedFeatures.push({
        type: 'Feature',
        properties: { ...props, regionId },
        geometry: {
          type: 'MultiPolygon',
          coordinates: polygons,
        },
      });
    }
  }

  if (validatedFeatures.length === 0) {
    throw new Error('Dataset geografi tidak memiliki fitur poligon yang valid.');
  }

  return {
    type: 'FeatureCollection',
    metadata: { ...candidate.metadata },
    features: validatedFeatures,
  };
}

// ============================================================================
// 5. PROCEDURAL ILLUSTRATIVE TEXTURES (Relief Ilustratif — Not a DEM)
// ============================================================================

export interface ProceduralSurfaceSet {
  diffuseMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  oceanBumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createIllustrativeTextures(): ProceduralSurfaceSet {
  const size = 256;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = size;
  diffCanvas.height = size;
  const diffCtx = diffCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d');

  const oceanCanvas = document.createElement('canvas');
  oceanCanvas.width = 128;
  oceanCanvas.height = 128;
  const oceanCtx = oceanCanvas.getContext('2d');

  const c1 = [251, 250, 246] as const; // #FBFAF6
  const c2 = [237, 233, 223] as const; // #EDE9DF
  const c3 = [217, 211, 195] as const; // #D9D3C3
  const c4 = [184, 175, 154] as const; // #B8AF9A

  if (diffCtx && bumpCtx) {
    const diffImg = diffCtx.createImageData(size, size);
    const bumpImg = bumpCtx.createImageData(size, size);
    const scale = 10.0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * scale;
        const ny = (y / size) * scale;
        const n1 = fbmNoise(nx, ny, 4);
        const ridge = 1.0 - Math.abs(n1 * 2.0 - 1.0);
        const val = Math.min(1.0, Math.max(0.0, n1 * 0.65 + ridge * 0.35));
        const idx = (y * size + x) * 4;

        let r: number;
        let g: number;
        let b: number;
        if (val < 0.35) {
          const t = val / 0.35;
          r = c1[0] + (c2[0] - c1[0]) * t;
          g = c1[1] + (c2[1] - c1[1]) * t;
          b = c1[2] + (c2[2] - c1[2]) * t;
        } else if (val < 0.7) {
          const t = (val - 0.35) / 0.35;
          r = c2[0] + (c3[0] - c2[0]) * t;
          g = c2[1] + (c3[1] - c2[1]) * t;
          b = c2[2] + (c3[2] - c2[2]) * t;
        } else {
          const t = (val - 0.7) / 0.3;
          r = c3[0] + (c4[0] - c3[0]) * t;
          g = c3[1] + (c4[1] - c3[1]) * t;
          b = c3[2] + (c4[2] - c3[2]) * t;
        }

        const contour = Math.abs((val * 12) % 1 - 0.5) < 0.04 ? 0.94 : 1.0;
        diffImg.data[idx] = Math.min(255, Math.max(0, r * contour));
        diffImg.data[idx + 1] = Math.min(255, Math.max(0, g * contour));
        diffImg.data[idx + 2] = Math.min(255, Math.max(0, b * contour));
        diffImg.data[idx + 3] = 255;

        const hVal = Math.floor(Math.pow(val, 1.2) * 235);
        bumpImg.data[idx] = hVal;
        bumpImg.data[idx + 1] = hVal;
        bumpImg.data[idx + 2] = hVal;
        bumpImg.data[idx + 3] = 255;
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);
  }

  if (oceanCtx) {
    const oceanImg = oceanCtx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const wn = fbmNoise((x / 128) * 12.0, (y / 128) * 12.0, 3);
        const wave = Math.floor(wn * 255);
        const idx = (y * 128 + x) * 4;
        oceanImg.data[idx] = wave;
        oceanImg.data[idx + 1] = wave;
        oceanImg.data[idx + 2] = wave;
        oceanImg.data[idx + 3] = 255;
      }
    }
    oceanCtx.putImageData(oceanImg, 0, 0);
  }

  const diffuseMap = new THREE.CanvasTexture(diffCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  [diffuseMap, bumpMap].forEach((tex) => {
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.MirroredRepeatWrapping;
    tex.repeat.set(0.28, 0.28);
    tex.needsUpdate = true;
  });

  const oceanBumpMap = new THREE.CanvasTexture(oceanCanvas);
  oceanBumpMap.wrapS = THREE.MirroredRepeatWrapping;
  oceanBumpMap.wrapT = THREE.MirroredRepeatWrapping;
  oceanBumpMap.repeat.set(14, 9);
  oceanBumpMap.needsUpdate = true;

  return {
    diffuseMap,
    bumpMap,
    oceanBumpMap,
    dispose: () => {
      diffuseMap.dispose();
      bumpMap.dispose();
      oceanBumpMap.dispose();
    },
  };
}

// ============================================================================
// 6. GPU SCENE DISPOSAL HELPER
// ============================================================================

export function disposeObjectTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const meshOrLine = obj as THREE.Mesh | THREE.Line;
    if (meshOrLine.geometry) {
      geometries.add(meshOrLine.geometry);
    }
    if (meshOrLine.material) {
      if (Array.isArray(meshOrLine.material)) {
        meshOrLine.material.forEach((m) => materials.add(m));
      } else {
        materials.add(meshOrLine.material);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());

  for (const child of [...root.children]) {
    root.remove(child);
  }
}

// ============================================================================
// 7. SHARED 3D MAP COMPONENT (NusaMatra3DMap)
// ============================================================================

interface InternalEngineState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls | null;
  rootGroup: THREE.Group;
  regionsGroup: THREE.Group;
  markersGroup: THREE.Group;
  gridGroup: THREE.Group;
  oceanMesh: THREE.Mesh;
  oceanMaterial: THREE.MeshStandardMaterial;
  textures: ProceduralSurfaceSet;
  featureMeshes: Map<string, THREE.Group>;
  interactiveMeshes: THREE.Object3D[];
  raycaster: THREE.Raycaster;
  cameraTargetPos: THREE.Vector3 | null;
  controlsTargetPos: THREE.Vector3 | null;
  introProgress: number;
  pointerParallax: { x: number; y: number };
  isVisible: boolean;
  /** Hero only: coastline relief scene and the camera pose that frames it. */
  heroTerrain: HeroTerrain | null;
  heroPose: CameraPose | null;
  /** Explore, LIVE geography only: centre and width of the drawn regions, for fitting the camera. */
  exploreFrame: { center: THREE.Vector3; width: number } | null;
  /** Points over the map (host overlay), in their own group. */
  overlay: PointOverlay;
  /** Explore: lights and materials the atlas palette recolours in place on a theme change. */
  hemiLight: THREE.HemisphereLight;
  gridMaterial: THREE.LineBasicMaterial;
  regionSideMaterial: THREE.MeshStandardMaterial | null;
  regionBoundaryMaterial: THREE.LineBasicMaterial | null;
}

export const NusaMatra3DMap = forwardRef<
  NusaMatra3DMapHandle,
  NusaMatra3DMapProps
>(function NusaMatra3DMap(props, ref) {
  const {
    mode = 'explore',
    displayMode = 'normal',
    className = '',
    reducedMotion = false,
    dataMode = 'DEMO',
    geography,
    selectedRegionId = null,
    onSelectRegion,
    onHoverRegion,
    onReady,
    onError,
    showGraticule = false,
    showMarkers = true,
    showCoastlines = true,
    cameraPreset = 'perspective',
    enableDevInspector = false,
    overlayPoints = NO_OVERLAY_POINTS,
    selectedOverlayId = null,
    onSelectOverlay,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const [hoveredInfo, setHoveredInfo] = useState<{
    name: string;
    x: number;
    y: number;
    subtitle?: string;
  } | null>(null);

  const [devWireframe, setDevWireframe] = useState(false);
  const [devExtrusion, setDevExtrusion] = useState(1.0);
  const [devCursorCoords, setDevCursorCoords] = useState<{
    lon: number;
    lat: number;
  } | null>(null);

  const engineRef = useRef<InternalEngineState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const isMotionReduced = reducedMotion || prefersReducedMotion;
  // Motion preference must not tear down/recreate the WebGL scene.
  const isMotionReducedRef = useRef(isMotionReduced);
  isMotionReducedRef.current = isMotionReduced;
  // Read when regions are (re)built, so new materials start in the current theme.
  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;

  const validationResult = useMemo<{
    dataset: GeographyDataset | null;
    error: Error | null;
  }>(() => {
    try {
      if (mode === 'hero') {
        return { dataset: DEMO_ILLUSTRATIVE_GEOGRAPHY, error: null };
      }
      const dataset = validateAndAdaptGeography(geography, dataMode);
      return { dataset, error: null };
    } catch (err) {
      const errorObj =
        err instanceof Error
          ? err
          : new Error('Gagal memvalidasi dataset geografi.');
      return { dataset: null, error: errorObj };
    }
  }, [mode, geography, dataMode]);

  const validatedDataset = validationResult.dataset;
  const dataValidationError = validationResult.error;

  useEffect(() => {
    if (dataValidationError) {
      onError?.(dataValidationError);
    }
  }, [dataValidationError, onError]);

  useImperativeHandle(
    ref,
    () => ({
      focusRegion: (regionId: string) => {
        const eng = engineRef.current;
        if (!eng || !validatedDataset) return;
        const feature = validatedDataset.features.find(
          (f) => f.properties.regionId === regionId
        );
        if (!feature) return;
        const center = approximateFeatureCenter(feature);
        const lon = Number.isFinite(feature.properties.focusLon) ? feature.properties.focusLon! : center.lon;
        const lat = Number.isFinite(feature.properties.focusLat) ? feature.properties.focusLat! : center.lat;
        const dist = feature.properties.focusDistance ?? 16;
        const targetWorld = lonLatToPlanar(lon, lat, 0);
        eng.controlsTargetPos = targetWorld.clone();
        eng.cameraTargetPos = new THREE.Vector3(
          targetWorld.x,
          dist * 0.82,
          targetWorld.z + (cameraPreset === 'top-down' ? 0.01 : dist * 0.65)
        );
      },
      focusCoordinates: (lon: number, lat: number, distance = 16) => {
        const eng = engineRef.current;
        if (!eng) return;
        const targetWorld = lonLatToPlanar(lon, lat, 0);
        eng.controlsTargetPos = targetWorld.clone();
        eng.cameraTargetPos = new THREE.Vector3(
          targetWorld.x,
          distance * 0.82,
          targetWorld.z + (cameraPreset === 'top-down' ? 0.01 : distance * 0.65)
        );
      },
      resetCamera: () => {
        const eng = engineRef.current;
        if (!eng) return;
        eng.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        if (mode === 'hero' && eng.heroPose) {
          eng.controlsTargetPos = eng.heroPose.target.clone();
          eng.cameraTargetPos = eng.heroPose.position.clone();
        } else if (mode === 'hero') {
          eng.cameraTargetPos = new THREE.Vector3(1.5, 29, 25);
        } else if (cameraPreset === 'top-down') {
          eng.cameraTargetPos = new THREE.Vector3(0, 44, 0.01);
        } else {
          eng.cameraTargetPos = new THREE.Vector3(0, 33, 29);
        }
      },
      setCameraPreset: (preset: CameraPreset) => {
        const eng = engineRef.current;
        if (!eng) return;
        const target = eng.controls
          ? eng.controls.target.clone()
          : new THREE.Vector3(0, 0, 0);
        eng.controlsTargetPos = target;
        if (preset === 'top-down') {
          eng.cameraTargetPos = new THREE.Vector3(target.x, 42, target.z + 0.01);
        } else {
          eng.cameraTargetPos = exploreDefaultPosition(eng, target);
        }
      },
      triggerExploreTransition: () => {
        const eng = engineRef.current;
        if (!eng || isMotionReducedRef.current) return;
        eng.controlsTargetPos = new THREE.Vector3(0, 0, 0);
        eng.cameraTargetPos = new THREE.Vector3(0, 20, 14);
      },
    }),
    [validatedDataset, mode, cameraPreset]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || dataValidationError) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: mode === 'hero',
        powerPreference: 'high-performance',
      });
    } catch {
      const msg =
        'WebGL tidak tersedia pada perangkat atau peramban ini. Menampilkan pratinjau statis.';
      setWebglError(msg);
      onError?.(new Error(msg));
      return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(360, rect.height);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    // Host integration fix: PCFSoftShadowMap is deprecated since three r186 (the host's version).
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // Host performance fix: the Explore scene is static between selections, so the shadow pass
    // (a second full draw of every region) runs only when something moved, not every frame. The
    // hero animates its whole group, so it keeps the per-frame update.
    renderer.shadowMap.autoUpdate = mode === 'hero';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(KAPUR_KOBALT_PALETTE.sea);
    scene.fog = new THREE.Fog(KAPUR_KOBALT_PALETTE.seaShallow, EXPLORE_FOG_NEAR, EXPLORE_FOG_FAR);

    const camera = new THREE.PerspectiveCamera(
      mode === 'hero' ? 40 : 45,
      width / height,
      0.1,
      400
    );
    if (mode === 'hero') {
      camera.position.set(1.5, 29, 25);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(0, 33, 29);
    }

    let controls: OrbitControls | null = null;
    if (mode === 'explore') {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.minDistance = 4.0;
      controls.maxDistance = 85.0;
      controls.target.set(0, 0, 0);
    }

    const hemiLight = new THREE.HemisphereLight(
      '#FFFFFF',
      KAPUR_KOBALT_PALETTE.seaDeep,
      0.75
    );
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(
      KAPUR_KOBALT_PALETTE.sunLight,
      1.22
    );
    dirLight.position.set(18, 42, 24);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 120;
    const d = 34;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(
      KAPUR_KOBALT_PALETTE.seaShallow,
      0.38
    );
    rimLight.position.set(-24, 16, -20);
    scene.add(rimLight);

    const textures = createIllustrativeTextures();

    const rootGroup = new THREE.Group();
    const regionsGroup = new THREE.Group();
    const markersGroup = new THREE.Group();
    const gridGroup = new THREE.Group();

    const overlay = new PointOverlay(lonLatToPlanar);
    rootGroup.add(regionsGroup, markersGroup, gridGroup, overlay.group);
    scene.add(rootGroup);

    // Hero: coastline relief on a textured sea, both inside rootGroup so the intro and the
    // pointer parallax move land and water together. Explore: the original flat sea plane.
    let heroTerrain: HeroTerrain | null = null;
    let heroPose: CameraPose | null = null;
    let oceanMesh: THREE.Mesh;
    let oceanMaterial: THREE.MeshStandardMaterial;
    if (mode === 'hero') {
      try {
        heroTerrain = buildHeroTerrain(getIndonesiaCoastline(), {
          project: lonLatToPlanar,
          reliefBumpMap: textures.bumpMap,
          oceanBumpMap: textures.oceanBumpMap,
        });
      } catch (err) {
        textures.dispose();
        renderer.dispose();
        const error = err instanceof Error ? err : new Error('Gagal membangun relief diorama.');
        setWebglError(error.message);
        onError?.(error);
        return;
      }
      oceanMesh = heroTerrain.ocean;
      oceanMaterial = heroTerrain.oceanMaterial;
      oceanMaterial.roughness = displayMode === 'glass' ? 0.36 : 0.55;
      rootGroup.add(heroTerrain.land, oceanMesh);

      heroPose = fitCameraToPoints(camera, heroTerrain.framingPoints, {
        elevationDeg: HERO_CAMERA_ELEVATION_DEG,
        margin: HERO_FRAME_MARGIN,
      });
      // Open sea fades into a background of the same cobalt, so the plane never shows an edge.
      const horizon = new THREE.Color(KAPUR_KOBALT_PALETTE.sea).lerp(
        new THREE.Color(KAPUR_KOBALT_PALETTE.seaDeep),
        0.45
      );
      scene.background = horizon;
      const viewDistance = heroPose.position.distanceTo(heroPose.target);
      scene.fog = new THREE.Fog(horizon, viewDistance * HERO_FOG_NEAR, viewDistance * HERO_FOG_FAR);

      // Brighter than Explore: chalk must read as chalk under a camera this far away.
      hemiLight.intensity = 1.15;
      dirLight.intensity = 1.9;
      const extent = heroTerrain.landBounds.getSize(new THREE.Vector3());
      const shadowHalf = Math.max(extent.x, extent.z) / 2 + 1.5;
      dirLight.position
        .set(HERO_SUN_DIRECTION[0], HERO_SUN_DIRECTION[1], HERO_SUN_DIRECTION[2])
        .multiplyScalar(60)
        .add(heroPose.target);
      dirLight.target.position.copy(heroPose.target);
      scene.add(dirLight.target);
      dirLight.shadow.mapSize.set(2048, 2048);
      dirLight.shadow.camera.left = -shadowHalf;
      dirLight.shadow.camera.right = shadowHalf;
      dirLight.shadow.camera.top = shadowHalf;
      dirLight.shadow.camera.bottom = -shadowHalf;
      dirLight.shadow.camera.far = 140;
      dirLight.shadow.bias = -0.0004;
      dirLight.shadow.normalBias = 0.02;
      dirLight.shadow.camera.updateProjectionMatrix();
    } else {
      // Colours come from EXPLORE_ATLAS_PALETTE (theme effect); no metalness, so the sea is its colour.
      hemiLight.intensity = EXPLORE_HEMI_INTENSITY;
      dirLight.intensity = EXPLORE_SUN_INTENSITY;
      rimLight.intensity = EXPLORE_RIM_INTENSITY;
      oceanMaterial = new THREE.MeshStandardMaterial({
        color: EXPLORE_ATLAS_PALETTE[displayMode].ocean,
        roughness: displayMode === 'glass' ? 0.36 : 0.6,
        metalness: 0,
        bumpMap: textures.oceanBumpMap,
        bumpScale: 0.035,
      });
      oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 130, 32, 32), oceanMaterial);
      oceanMesh.rotation.x = -Math.PI / 2;
      oceanMesh.position.y = -0.02;
      oceanMesh.receiveShadow = true;
      scene.add(oceanMesh);
    }

    const gridMaterial = new THREE.LineBasicMaterial({
      color: KAPUR_KOBALT_PALETTE.seaShallow,
      transparent: true,
      opacity: 0.45,
    });
    for (let lon = 95; lon <= 140; lon += 5) {
      const start = lonLatToPlanar(lon, -12, 0.01);
      const end = lonLatToPlanar(lon, 8, 0.01);
      const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
      gridGroup.add(new THREE.Line(geo, gridMaterial));
    }
    for (let lat = -10; lat <= 5; lat += 5) {
      const start = lonLatToPlanar(92, lat, 0.01);
      const end = lonLatToPlanar(143, lat, 0.01);
      const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
      gridGroup.add(new THREE.Line(geo, gridMaterial));
    }
    gridGroup.visible = mode === 'explore' && showGraticule;

    engineRef.current = {
      scene,
      camera,
      renderer,
      controls,
      rootGroup,
      regionsGroup,
      markersGroup,
      gridGroup,
      oceanMesh,
      oceanMaterial,
      textures,
      featureMeshes: new Map(),
      interactiveMeshes: [],
      raycaster: new THREE.Raycaster(),
      cameraTargetPos: null,
      controlsTargetPos: null,
      introProgress: isMotionReducedRef.current ? 1 : 0,
      pointerParallax: { x: 0, y: 0 },
      isVisible: true,
      heroTerrain,
      heroPose,
      exploreFrame: null,
      overlay,
      hemiLight,
      gridMaterial,
      regionSideMaterial: null,
      regionBoundaryMaterial: null,
    };

    onReady?.();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, entry.contentRect.width);
        const h = Math.max(1, entry.contentRect.height);
        const eng = engineRef.current;
        const fitBefore =
          mode === 'explore' && eng?.exploreFrame
            ? exploreFitDistance(camera, eng.exploreFrame.width, scene)
            : null;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (mode === 'explore' && eng?.exploreFrame && fitBefore !== null) {
          // Refit to the new canvas shape, keeping the direction the user is looking from.
          const target = eng.controls ? eng.controls.target : new THREE.Vector3();
          if (eng.cameraTargetPos) {
            // A camera move is under way (start-up framing): retarget it for the new shape.
            eng.cameraTargetPos.copy(exploreDefaultPosition(eng, eng.controlsTargetPos ?? target));
          } else {
            // Scale the distance by how much the fitted distance changed, so a side panel folding
            // keeps the user's zoom and target instead of snapping back to the whole frame.
            const fitAfter = exploreFitDistance(camera, eng.exploreFrame.width, scene);
            const offset = camera.position.clone().sub(target);
            camera.position.copy(target).addScaledVector(offset, fitAfter / fitBefore);
          }
        }
        if (eng?.heroTerrain && !eng.cameraTargetPos) {
          // Re-frame the whole archipelago for the new aspect ratio.
          eng.heroPose = fitCameraToPoints(camera, eng.heroTerrain.framingPoints, {
            elevationDeg: HERO_CAMERA_ELEVATION_DEG,
            margin: HERO_FRAME_MARGIN,
          });
          const viewDistance = eng.heroPose.position.distanceTo(eng.heroPose.target);
          if (scene.fog instanceof THREE.Fog) {
            scene.fog.near = viewDistance * HERO_FOG_NEAR;
            scene.fog.far = viewDistance * HERO_FOG_FAR;
          }
        }
      }
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (engineRef.current && entries[0]) {
          engineRef.current.isVisible = entries[0].isIntersecting;
        }
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    let rafId = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const eng = engineRef.current;
      if (!eng || !eng.isVisible) {
        lastTime = now;
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (mode === 'hero') {
        if (isMotionReducedRef.current) eng.introProgress = 1;
        if (eng.introProgress < 1 && !isMotionReducedRef.current) {
          eng.introProgress = Math.min(1, eng.introProgress + dt / 1.1);
          const easeOut = 1 - Math.pow(1 - eng.introProgress, 3);
          eng.rootGroup.position.y = (1 - easeOut) * -2.2;
          eng.rootGroup.scale.setScalar(0.94 + 0.06 * easeOut);
        } else {
          eng.rootGroup.scale.setScalar(1);
          eng.rootGroup.position.y = isMotionReducedRef.current
            ? 0
            : Math.sin(now * 0.0014) * 0.12;
        }

        const maxRad = (6 * Math.PI) / 180;
        const targetRotY = isMotionReducedRef.current ? 0 : eng.pointerParallax.x * maxRad;
        const targetRotX = isMotionReducedRef.current
          ? 0
          : eng.pointerParallax.y * maxRad * 0.6;
        const damp = 1 - Math.exp(-6 * dt);
        eng.rootGroup.rotation.y += (targetRotY - eng.rootGroup.rotation.y) * damp;
        eng.rootGroup.rotation.x += (targetRotX - eng.rootGroup.rotation.x) * damp;
      }

      if (eng.cameraTargetPos && eng.controlsTargetPos) {
        const lerpFactor = isMotionReducedRef.current ? 1 : 1 - Math.exp(-5.5 * dt);
        eng.camera.position.lerp(eng.cameraTargetPos, lerpFactor);
        if (eng.controls) {
          eng.controls.target.lerp(eng.controlsTargetPos, lerpFactor);
        } else {
          eng.camera.lookAt(eng.controlsTargetPos);
        }
        if (eng.camera.position.distanceTo(eng.cameraTargetPos) < 0.12) {
          eng.cameraTargetPos = null;
          eng.controlsTargetPos = null;
        }
      }

      if (!isMotionReducedRef.current) {
        eng.textures.oceanBumpMap.offset.x = (now * 0.00004) % 1;
        eng.textures.oceanBumpMap.offset.y = (now * 0.00003) % 1;

        eng.markersGroup.children.forEach((markerGroup, idx) => {
          const ring = markerGroup.getObjectByName('marker-ring');
          if (ring) {
            const s = 1 + Math.sin(now * 0.003 + idx) * 0.22;
            ring.scale.set(s, s, 1);
          }
        });
      }

      eng.controls?.update();
      eng.overlay.tick(now);
      eng.renderer.render(eng.scene, eng.camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      controls?.dispose();
      overlay.dispose();
      disposeObjectTree(rootGroup);
      heroTerrain?.dispose(); // also frees the data textures, which the tree walk does not reach
      oceanMesh.geometry.dispose();
      oceanMaterial.dispose();
      textures.dispose();
      dirLight.shadow.map?.dispose();
      renderer.dispose();
      engineRef.current = null;
    };
  }, [mode, dataValidationError]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !validatedDataset) return;

    eng.renderer.shadowMap.needsUpdate = true;
    disposeObjectTree(eng.regionsGroup);
    disposeObjectTree(eng.markersGroup);
    eng.featureMeshes.clear();
    eng.interactiveMeshes = [];

    const palette = EXPLORE_ATLAS_PALETTE[displayModeRef.current];
    // Shared by every region (one draw state), recoloured in place on a theme change.
    const borderMat = new THREE.LineBasicMaterial({
      color: palette.boundary,
      transparent: true,
      opacity: 0.85,
    });
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: palette.landSide,
      roughness: 0.95,
      metalness: 0,
      wireframe: devWireframe,
    });
    eng.regionSideMaterial = sideMaterial;
    eng.regionBoundaryMaterial = borderMat;

    // The hero draws the coastline relief built with the scene; selectable regions are Explore's.
    const regionFeatures = mode === 'hero' ? [] : validatedDataset.features;
    regionFeatures.forEach((feature) => {
      const { regionId, displayName } = feature.properties;
      // Regions are Explore's only (the hero draws its own relief): one uniform height.
      const tierDepth = 0.28;

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: tierDepth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.03,
      };

      const polygons: MultiPolygonCoordinates =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;

      const shapes: THREE.Shape[] = [];
      const coastlineRings: THREE.Vector3[][] = [];

      polygons.forEach((polygon) => {
        if (!polygon || !polygon[0] || polygon[0].length < 4) return;
        const outerRing = polygon[0];
        const shape = new THREE.Shape();

        outerRing.forEach((coord, i) => {
          const v = lonLatToPlanar(coord[0], coord[1], 0);
          if (i === 0) shape.moveTo(v.x, -v.z);
          else shape.lineTo(v.x, -v.z);
        });

        for (let h = 1; h < polygon.length; h++) {
          const holeRing = polygon[h];
          if (!holeRing || holeRing.length < 4) continue;
          const holePath = new THREE.Path();
          holeRing.forEach((coord, i) => {
            const v = lonLatToPlanar(coord[0], coord[1], 0);
            if (i === 0) holePath.moveTo(v.x, -v.z);
            else holePath.lineTo(v.x, -v.z);
          });
          shape.holes.push(holePath);
        }

        shapes.push(shape);

        if (showCoastlines) {
          const pts = outerRing.map((c) =>
            lonLatToPlanar(c[0], c[1], tierDepth + 0.032)
          );
          coastlineRings.push(pts);
        }
      });

      if (shapes.length === 0) return;

      // Host performance fix: two material groups per region instead of two per island.
      const geometry = consolidateExtrudeGroups(new THREE.ExtrudeGeometry(shapes, extrudeSettings));
      geometry.rotateX(-Math.PI / 2);

      // One uniform land colour (no tier tint, no mottled texture): a faint bump keeps it material.
      // Its own instance only so hover and selection can recolour this region alone.
      const topMaterial = new THREE.MeshStandardMaterial({
        color: palette.landTop,
        bumpMap: eng.textures.bumpMap,
        bumpScale: 0.05,
        roughness: 0.88,
        metalness: 0,
        wireframe: devWireframe,
      });

      const mesh = new THREE.Mesh(geometry, [topMaterial, sideMaterial]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        isRegionMesh: true,
        regionId,
        displayName,
        featureProperties: feature.properties,
        topMaterial,
      };

      const featureGroup = new THREE.Group();
      featureGroup.userData = { regionId, topMaterial };
      featureGroup.add(mesh);
      if (coastlineRings.length > 0) {
        featureGroup.add(new THREE.LineSegments(ringsToSegmentsGeometry(coastlineRings), borderMat));
      }

      eng.regionsGroup.add(featureGroup);
      eng.featureMeshes.set(regionId, featureGroup);
      eng.interactiveMeshes.push(mesh);
    });

    // LIVE geography is the whole archipelago: centre the view on it and fit it to the canvas.
    if (mode === 'explore' && validatedDataset.metadata.dataMode === 'LIVE' && eng.regionsGroup.children.length > 0) {
      const bounds = new THREE.Box3().setFromObject(eng.regionsGroup);
      const center = bounds.getCenter(new THREE.Vector3());
      center.y = 0;
      eng.exploreFrame = { center, width: bounds.max.x - bounds.min.x };
      const target = eng.controls ? eng.controls.target : new THREE.Vector3();
      target.copy(center);
      eng.camera.position
        .copy(center)
        .addScaledVector(EXPLORE_CAMERA_DIRECTION, exploreFitDistance(eng.camera, eng.exploreFrame.width, eng.scene));
      eng.camera.lookAt(center);
      eng.controls?.update();
    } else {
      eng.exploreFrame = null;
    }

    const activeMarkers =
      mode === 'hero'
        ? HERO_DIORAMA_MARKERS
        : // Host fix: the demo markers are illustrative pins, so official LIVE geography never shows them.
        showMarkers && validatedDataset.metadata.dataMode === 'DEMO'
        ? EXPLORE_DEMO_MARKERS
        : [];

    const pinGeo = new THREE.CylinderGeometry(0.06, 0.02, 0.62, 12);
    const headGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const ringGeo = new THREE.RingGeometry(0.19, 0.3, 24);
    ringGeo.rotateX(-Math.PI / 2);

    activeMarkers.forEach((m) => {
      const groundY = eng.heroTerrain ? eng.heroTerrain.surfaceHeightAt(m.lon, m.lat) : 0.32;
      const pos = lonLatToPlanar(m.lon, m.lat, groundY);
      const markerGroup = new THREE.Group();
      markerGroup.position.copy(pos);
      // The hero camera frames the whole archipelago, so markers need more size to read.
      if (mode === 'hero') markerGroup.scale.setScalar(HERO_MARKER_SCALE);

      const mat = new THREE.MeshStandardMaterial({
        color:
          m.category === 'anchor'
            ? KAPUR_KOBALT_PALETTE.accentHover
            : KAPUR_KOBALT_PALETTE.accent,
        emissive: KAPUR_KOBALT_PALETTE.accent,
        emissiveIntensity: 0.42,
        roughness: 0.35,
      });

      const pin = new THREE.Mesh(pinGeo, mat);
      pin.position.y = 0.31;
      pin.castShadow = true;
      markerGroup.add(pin);

      const head = new THREE.Mesh(headGeo, mat);
      head.position.y = 0.66;
      head.castShadow = true;
      head.userData = {
        isMarker: true,
        name: m.name,
        note: m.note,
      };
      markerGroup.add(head);

      const ringMat = new THREE.MeshBasicMaterial({
        color: KAPUR_KOBALT_PALETTE.land1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.name = 'marker-ring';
      ring.position.y = 0.03;
      markerGroup.add(ring);

      eng.markersGroup.add(markerGroup);
    });
  }, [validatedDataset, mode, showMarkers, showCoastlines, devWireframe]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (mode === 'explore') {
      // Theme change in place: no rebuild of regions, no new canvas.
      const palette = EXPLORE_ATLAS_PALETTE[displayMode];
      const ocean = new THREE.Color(palette.ocean);
      eng.scene.background = ocean;
      if (eng.scene.fog instanceof THREE.Fog) eng.scene.fog.color.copy(ocean);
      eng.oceanMaterial.color.copy(ocean);
      // Light bounced up onto the extruded sides: sea and land mixed, so a deep Kaca sea tints the
      // sides without turning them grey.
      eng.hemiLight.groundColor.copy(ocean).lerp(new THREE.Color(palette.landSide), SIDE_BOUNCE_LAND_SHARE);
      eng.gridMaterial.color.set(palette.graticule);
      eng.regionSideMaterial?.color.set(palette.landSide);
      eng.regionBoundaryMaterial?.color.set(palette.boundary);
    }
    eng.oceanMaterial.roughness = displayMode === 'glass' ? 0.36 : 0.6;
    eng.oceanMaterial.needsUpdate = true;
    eng.gridGroup.visible = mode === 'explore' && showGraticule;
    eng.regionsGroup.scale.y = devExtrusion;
    eng.renderer.shadowMap.needsUpdate = true;
    eng.markersGroup.position.y = (devExtrusion - 1) * 0.32;
  }, [displayMode, mode, showGraticule, devExtrusion]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.renderer.shadowMap.needsUpdate = true;
    const palette = EXPLORE_ATLAS_PALETTE[displayMode];
    eng.featureMeshes.forEach((group, id) => {
      paintRegion(group, palette, id === selectedRegionId ? 'selected' : 'idle');
    });
    hoveredIdRef.current = null;
  }, [selectedRegionId, validatedDataset, displayMode]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || mode !== 'explore') return;
    const target = eng.controls
      ? eng.controls.target.clone()
      : new THREE.Vector3(0, 0, 0);
    eng.controlsTargetPos = target;
    if (cameraPreset === 'top-down') {
      eng.cameraTargetPos = new THREE.Vector3(target.x, 42, target.z + 0.01);
    } else {
      eng.cameraTargetPos = exploreDefaultPosition(eng, target);
    }
  }, [cameraPreset, mode]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.overlay.setPoints(overlayPoints, performance.now(), !isMotionReducedRef.current);
  }, [overlayPoints, mode, dataValidationError]);

  useEffect(() => {
    engineRef.current?.overlay.setSelected(selectedOverlayId);
  }, [selectedOverlayId, overlayPoints, mode, dataValidationError]);

  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const hoveredIdRef = useRef<string | null>(null);

  const getBoundedNDC = useCallback((clientX: number, clientY: number) => {
    const eng = engineRef.current;
    if (!eng) return null;
    const rect = eng.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return {
      ndc: new THREE.Vector2(x, y),
      localX: clientX - rect.left,
      localY: clientY - rect.top,
      rect,
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const eng = engineRef.current;
      if (!eng || !validatedDataset) return;

      if (
        e.target instanceof HTMLElement &&
        e.target.closest('[data-nm-dev-inspector="true"]')
      ) {
        return;
      }

      const coords = getBoundedNDC(e.clientX, e.clientY);
      if (!coords) return;

      if (mode === 'hero') {
        eng.pointerParallax = {
          x: Math.max(-1, Math.min(1, coords.ndc.x)),
          y: Math.max(-1, Math.min(1, coords.ndc.y)),
        };
        return;
      }

      eng.raycaster.setFromCamera(coords.ndc, eng.camera);

      if (enableDevInspector) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const pt = new THREE.Vector3();
        if (eng.raycaster.ray.intersectPlane(plane, pt)) {
          setDevCursorCoords(planarToLonLat(pt.x, pt.z));
        }
      }

      const overlayId = eng.overlay.hit(eng.raycaster);
      const hits = overlayId ? [] : eng.raycaster.intersectObjects(eng.interactiveMeshes, false);
      const firstHit = hits[0];
      if (firstHit) {
        const hitMesh = firstHit.object;
        const rId = hitMesh.userData.regionId as string;
        const name = hitMesh.userData.displayName as string;

        const clampedX = Math.min(
          Math.max(coords.localX + 14, 12),
          Math.max(12, coords.rect.width - 220)
        );
        const clampedY = Math.min(
          Math.max(coords.localY - 12, 12),
          Math.max(12, coords.rect.height - 64)
        );

        setHoveredInfo({
          name,
          x: clampedX,
          y: clampedY,
          subtitle:
            validatedDataset.metadata.dataMode === 'DEMO'
              ? 'Geometri Simulasi (DEMO)'
              : validatedDataset.metadata.boundaryEditionId,
        });

        if (hoveredIdRef.current !== rId) {
          if (
            hoveredIdRef.current &&
            hoveredIdRef.current !== selectedRegionId
          ) {
            const prevGroup = eng.featureMeshes.get(hoveredIdRef.current);
            if (prevGroup) paintRegion(prevGroup, EXPLORE_ATLAS_PALETTE[displayMode], 'idle');
          }
          hoveredIdRef.current = rId;
          eng.renderer.shadowMap.needsUpdate = true;
          if (rId !== selectedRegionId) {
            const currGroup = eng.featureMeshes.get(rId);
            if (currGroup) paintRegion(currGroup, EXPLORE_ATLAS_PALETTE[displayMode], 'hover');
          }
          onHoverRegion?.({
            regionId: rId,
            displayName: name,
            boundaryEditionId: validatedDataset.metadata.boundaryEditionId,
            dataMode: validatedDataset.metadata.dataMode,
            codeSystem: validatedDataset.metadata.codeSystem,
            regionCode: hitMesh.userData.featureProperties?.regionCode,
          });
        }
      } else {
        const overlayLabel = overlayId ? eng.overlay.labelOf(overlayId) : null;
        setHoveredInfo(
          overlayLabel
            ? {
                name: overlayLabel,
                x: Math.min(Math.max(coords.localX + 14, 12), Math.max(12, coords.rect.width - 220)),
                y: Math.min(Math.max(coords.localY - 12, 12), Math.max(12, coords.rect.height - 64)),
                subtitle: 'Klik untuk detail gempa',
              }
            : null,
        );
        if (hoveredIdRef.current) {
          if (hoveredIdRef.current !== selectedRegionId) {
            const prevGroup = eng.featureMeshes.get(hoveredIdRef.current);
            if (prevGroup) paintRegion(prevGroup, EXPLORE_ATLAS_PALETTE[displayMode], 'idle');
          }
          hoveredIdRef.current = null;
          eng.renderer.shadowMap.needsUpdate = true;
          onHoverRegion?.(null);
        }
      }
    },
    [
      mode,
      validatedDataset,
      selectedRegionId,
      displayMode,
      enableDevInspector,
      getBoundedNDC,
      onHoverRegion,
    ]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (mode !== 'explore' || e.button !== 0) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('[data-nm-dev-inspector="true"]')
      ) {
        return;
      }
      pointerDownRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      };
    },
    [mode]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (mode !== 'explore' || !pointerDownRef.current || !validatedDataset) {
        return;
      }
      const dx = e.clientX - pointerDownRef.current.x;
      const dy = e.clientY - pointerDownRef.current.y;
      const dist = Math.hypot(dx, dy);
      const elapsed = performance.now() - pointerDownRef.current.time;
      pointerDownRef.current = null;

      if (dist > 6 || elapsed > 450) return;

      const eng = engineRef.current;
      const coords = getBoundedNDC(e.clientX, e.clientY);
      if (!eng || !coords) return;

      eng.raycaster.setFromCamera(coords.ndc, eng.camera);
      const overlayId = eng.overlay.hit(eng.raycaster);
      if (overlayId) {
        onSelectOverlay?.(overlayId);
        return;
      }
      const hits = eng.raycaster.intersectObjects(eng.interactiveMeshes, false);

      const firstHit = hits[0];
      if (firstHit) {
        const hitMesh = firstHit.object;
        onSelectRegion?.({
          regionId: hitMesh.userData.regionId,
          displayName: hitMesh.userData.displayName,
          boundaryEditionId: validatedDataset.metadata.boundaryEditionId,
          dataMode: validatedDataset.metadata.dataMode,
          codeSystem: validatedDataset.metadata.codeSystem,
          regionCode: hitMesh.userData.featureProperties?.regionCode,
        });
      }
    },
    [mode, validatedDataset, getBoundedNDC, onSelectRegion, onSelectOverlay]
  );

  const handlePointerLeave = useCallback(() => {
    const eng = engineRef.current;
    if (eng) {
      eng.pointerParallax = { x: 0, y: 0 };
      const previousId = hoveredIdRef.current;
      if (previousId && previousId !== selectedRegionId) {
        const previousGroup = eng.featureMeshes.get(previousId);
        if (previousGroup) paintRegion(previousGroup, EXPLORE_ATLAS_PALETTE[displayMode], 'idle');
      }
    }
    hoveredIdRef.current = null;
    if (eng) eng.renderer.shadowMap.needsUpdate = true;
    setHoveredInfo(null);
    onHoverRegion?.(null);
  }, [selectedRegionId, displayMode, onHoverRegion]);

  if (webglError || dataValidationError) {
    return (
      <div
        role="region"
        aria-label={
          mode === 'hero'
            ? 'Ilustrasi geografis kepulauan Indonesia'
            : 'Peta interaktif kepulauan Indonesia'
        }
        className={`${styles.fallbackContainer} ${className}`.trim()}
      >
        <div className={styles.fallbackIcon} aria-hidden="true">
          !
        </div>
        <h3 className={styles.fallbackTitle}>
          {dataValidationError
            ? 'Data Geografi Belum Tersedia'
            : 'Mode Pratinjau Statis'}
        </h3>
        <p className={styles.fallbackMessage}>
          {dataValidationError ? dataValidationError.message : webglError}
        </p>
        <span className={styles.fallbackPill}>
          Ilustrasi geografis — bukan peta skala presisi
        </span>
      </div>
    );
  }

  const rootClasses = [
    styles.mapContainer,
    mode === 'hero' ? styles.modeHero : styles.modeExplore,
    displayMode === 'glass' ? styles.themeGlass : styles.themeNormal,
    hoveredInfo && mode === 'explore' ? styles.cursorPointer : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="region"
      aria-label={
        mode === 'hero'
          ? 'Diorama 3D ilustratif kepulauan Indonesia'
          : 'Peta 3D interaktif wilayah Indonesia'
      }
      className={rootClasses}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div ref={containerRef} className={styles.canvasMount} />

      <div className={styles.attributionBadge}>
        {mode === 'hero'
          ? 'Garis pantai: Natural Earth · Relief ilustratif, bukan data elevasi'
          : validatedDataset?.metadata.isAuthoritative
          ? `Batas: ${validatedDataset.metadata.boundaryEditionId}`
          : 'Data simulasi (DEMO) — Relief ilustratif'}
      </div>

      {mode === 'explore' && hoveredInfo && (
        <div
          className={styles.hoverTooltip}
          style={{
            left: `${hoveredInfo.x}px`,
            top: `${hoveredInfo.y}px`,
          }}
        >
          <p className={styles.tooltipTitle}>{hoveredInfo.name}</p>
          {hoveredInfo.subtitle && (
            <div className={styles.tooltipSubtitle}>{hoveredInfo.subtitle}</div>
          )}
        </div>
      )}

      {mode === 'explore' && enableDevInspector && (
        <div className={styles.devInspector} data-nm-dev-inspector="true">
          <div className={styles.devHeader}>DEV Inspector (Non-Produksi)</div>
          <label className={styles.devRow}>
            <span>Skala Ekstrusi Visual</span>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={devExtrusion}
              onChange={(e) => setDevExtrusion(parseFloat(e.target.value))}
              className={styles.devRange}
            />
          </label>
          <label className={styles.devCheckboxLabel}>
            <input
              type="checkbox"
              checked={devWireframe}
              onChange={(e) => setDevWireframe(e.target.checked)}
            />
            <span>Tampilkan Wireframe Mesh</span>
          </label>
          {devCursorCoords && (
            <div className={styles.devCoords}>
              Proyeksi Planar: {devCursorCoords.lat.toFixed(2)}° ,{' '}
              {devCursorCoords.lon.toFixed(2)}°
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// 8. CONVENIENCE MODE WRAPPERS (HeroDiorama & Explore3DMap)
// ============================================================================

export const HeroDiorama = forwardRef<
  NusaMatra3DMapHandle,
  Omit<NusaMatra3DMapProps, 'mode' | 'dataMode'> & { dataMode?: DataMode }
>(function HeroDiorama({ dataMode = 'DEMO', ...rest }, ref) {
  return (
    <NusaMatra3DMap ref={ref} {...rest} mode="hero" dataMode={dataMode} />
  );
});

export const Explore3DMap = forwardRef<
  NusaMatra3DMapHandle,
  Omit<NusaMatra3DMapProps, 'mode'>
>(function Explore3DMap(props, ref) {
  return <NusaMatra3DMap ref={ref} {...props} mode="explore" />;
});

export default NusaMatra3DMap;