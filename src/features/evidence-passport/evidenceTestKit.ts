/**
 * Test helpers for the Paspor Bukti. Three kinds of input are kept apart on purpose:
 *
 * - CAPTURED LIVE: responses captured from the production Data Hub (`__fixtures__/live/*`), unaltered.
 * - CAPTURED DEMO: responses captured from the DEMO Data Hub (`__fixtures__/*`), unaltered.
 * - SYNTHETIC: a captured response with a stated change (a second region, a removed field), made
 *   only to reach a case no capture holds. Every use is named as synthetic in the test.
 */
import type { Mock } from 'vitest';
import { createFixtureFetch, fixtureJson, jsonResponse, repositoryOver } from '@/test/dataHubFixtures';
import type { DataMode } from '@/services/api';
import catalogV21 from '@/services/api/__fixtures__/live-v2.1/indicators_catalog.json';
import compositeJateng from '@/services/api/__fixtures__/live-v2.1/composite_jateng_kemiskinan_stunting.json';
import compositeNationalHdi from '@/services/api/__fixtures__/live-v2.1/composite_national_hdi.json';
import compositeNationalKms from '@/services/api/__fixtures__/live-v2.1/composite_national_kemiskinan_stunting.json';
import composite3T from '@/services/api/__fixtures__/live-v2.1/composite_national_pendidikan_3t.json';
import coverageV21 from '@/services/api/__fixtures__/live-v2.1/indicators_coverage.json';
import compositePresets from '@/services/api/__fixtures__/live-v2.1/composite_presets.json';
import compositeSumut from '@/services/api/__fixtures__/live-v2.1/composite_sumut_bencana.json';
import valuesWater from '@/services/api/__fixtures__/live-v2.1/values_inf_safe_water_pct.json';
import type { RawCompositeSources } from './compositeTypes';
import type { RawEvidenceSources } from './evidenceTypes';
import { loadCompositeSources as loadSourcesForLab, loadEvidenceSources } from './useEvidenceSources';

type JsonObject = Record<string, unknown>;

/** A response body by API path. Anything not listed fails the test as an unexpected request. */
export type HubBodies = Readonly<Record<string, unknown>>;

/** A body served with a status other than 200, or with response headers. */
class ServedBody {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
  constructor(status: number, body: unknown, headers: Readonly<Record<string, string>> = {}) {
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}
export const withStatus = (status: number, body: unknown): ServedBody => new ServedBody(status, body);
export const withHeaders = (body: unknown, headers: Readonly<Record<string, string>>): ServedBody =>
  new ServedBody(200, body, headers);

const respond = (served: ServedBody): Response =>
  new Response(JSON.stringify(served.body), {
    status: served.status,
    headers: { 'Content-Type': 'application/json', ...served.headers },
  });

export function hubFetch(bodies: HubBodies): Mock<typeof fetch> {
  return createFixtureFetch(
    Object.fromEntries(
      Object.entries(bodies).map(([path, body]) => [
        path,
        () => (body instanceof ServedBody ? respond(body) : jsonResponse(body)),
      ]),
    ),
  );
}

export function clone(name: string): JsonObject {
  return structuredClone(fixtureJson(name)) as JsonObject;
}

/** CAPTURED LIVE set for region 1101 (Aceh Selatan). */
export function capturedLiveBodies(): Record<string, unknown> {
  return {
    '/api/v1/regions/1101': clone('live/region_detail_1101'),
    '/api/v1/indicators': clone('live/indicators'),
    '/api/v1/datasets': clone('live/datasets'),
    '/api/v1/snapshots': clone('live/snapshots'),
    // CAPTURED 2026-10-23T15:19Z: 25 of 33 indicators had data. (The snapshot list captured earlier
    // says 51.6% complete; the two are different claims and the passport shows both.)
    '/api/v1/indicators/coverage': structuredClone(coverageV21),
  };
}

export const DEMO_SNAPSHOT = '2026.10.0-wia-demo';

/**
 * CAPTURED DEMO set for region 3201 (the synthetic "Kabupaten Demo Jabar 1"), with the CAPTURED v2.2
 * detail of the DEMO snapshot (2026-10-24), which a link naming that snapshot asks for first.
 */
export function capturedDemoBodies(): Record<string, unknown> {
  return {
    '/api/v1/regions/3201': clone('region_detail'),
    '/api/v1/indicators': clone('indicators'),
    '/api/v1/datasets': clone('datasets'),
    '/api/v1/snapshots': clone('snapshots'),
    [`/api/v1/snapshots/${DEMO_SNAPSHOT}`]: clone('live-v2.2/demo_snapshot_detail'),
  };
}

export interface Profile {
  meta: { snapshot_id: string; mode: string };
  data: { region: JsonObject; indicators: JsonObject[] };
}

/** SYNTHETIC: the captured profile moved to another region id and name, for comparison cases. */
export function relabelledProfile(source: unknown, regionId: string, name: string): Profile {
  const profile = structuredClone(source as Profile);
  profile.data.region = { ...profile.data.region, region_id: regionId, name, short_name: name };
  return profile;
}

export function indicatorOf(profile: Profile, indicatorId: string): JsonObject {
  const found = profile.data.indicators.find((indicator) => indicator.indicator_id === indicatorId);
  if (!found) throw new Error(`Indicator ${indicatorId} is not in the profile`);
  return found;
}

const SUPPORTING_PATHS = [
  '/api/v1/indicators',
  '/api/v1/datasets',
  '/api/v1/snapshots',
  '/api/v1/indicators/coverage',
];

/**
 * Runs the page's own loader (and so the real repository and adapter) over the given bodies.
 * `withSupporting: false` leaves the supporting responses out, so those requests fail as gaps.
 */
export async function loadSources(
  bodies: HubBodies,
  mode: DataMode,
  regionIds: readonly string[],
  options: { readonly withSupporting?: boolean; readonly linkSnapshotId?: string | null } = {},
): Promise<RawEvidenceSources> {
  const served =
    options.withSupporting === false
      ? Object.fromEntries(Object.entries(bodies).filter(([path]) => !SUPPORTING_PATHS.includes(path)))
      : bodies;
  return loadEvidenceSources(repositoryOver(hubFetch(served)), regionIds, mode, options.linkSnapshotId);
}

/** The profile body held under `path`, typed so a test can change it (SYNTHETIC edits only). */
export function profileIn(bodies: HubBodies, path: string): Profile {
  return bodies[path] as Profile;
}

// ---------------------------------------------------------------------------------------------
// Lab (composite) passports. The files under live-v2.1/ are CAPTURED production responses
// (2026-10-23), imported directly and never edited; a modified copy is always built in memory.
// ---------------------------------------------------------------------------------------------

export const JATENG_WEIGHTS = {
  soc_poverty_rate: 3000,
  hlt_stunting_prevalence: 3000,
  inf_safe_water_pct: 2000,
  inf_safe_sanitation_pct: 2000,
} as const;
export const SUMUT_WEIGHTS = {
  dis_multihazard_index: 3500,
  dis_flood_hazard_idx: 1500,
  inf_asphalt_road_village_pct: 2500,
  inf_electrification_pct: 2500,
} as const;
export const PENDIDIKAN_3T_WEIGHTS = {
  edu_damaged_classrooms_pct: 3000,
  edu_mean_years_schooling: 2500,
  edu_student_teacher_ratio_sd: 2500,
  inf_internet_household_pct: 2000,
} as const;

export const COMPOSITE_PATH = '/api/v1/indicators/composite-query';

/** Everything a Lab passport fetches, around one captured composite response. */
export function capturedCompositeBodies(composite: unknown): Record<string, unknown> {
  return {
    [COMPOSITE_PATH]: structuredClone(composite),
    '/api/v1/indicators/composite-presets': structuredClone(compositePresets),
    '/api/v1/indicators': structuredClone(catalogV21),
    '/api/v1/datasets': clone('live/datasets'),
    '/api/v1/snapshots': clone('live/snapshots'),
    '/api/v1/indicators/coverage': structuredClone(coverageV21),
  };
}

/**
 * SYNTHETIC region registry for one province, built from the regions of the captured composite in
 * `bodies` (no capture of the LIVE registry with province names exists in the repository). The
 * province name is a test value; the application never contains one.
 */
export function withRegistry(
  bodies: Record<string, unknown>,
  provinceId: string,
  provinceName: string,
): Record<string, unknown> {
  const composite = bodies[COMPOSITE_PATH] as {
    data: { regions: { region_id: string; region_name: string }[] };
  };
  const regions = composite.data.regions;
  return {
    ...bodies,
    '/api/v1/regions': {
      status: 'success',
      meta: {
        snapshot_id: '2026.10.0-official-live',
        mode: 'LIVE',
        boundary_version: null,
        total_count: regions.length,
      },
      data: regions.map((region) => ({
        region_id: region.region_id,
        parent_region_id: provinceId,
        province_name: provinceName,
        level: 'kabupaten',
        name: region.region_name,
        short_name: region.region_name,
        codes: { bps: region.region_id },
      })),
    },
  };
}

export const capturedJatengNoRegistry = (): Record<string, unknown> =>
  capturedCompositeBodies(compositeJateng);
export const capturedJateng = (): Record<string, unknown> =>
  withRegistry(capturedCompositeBodies(compositeJateng), '33', 'Provinsi Jawa Tengah');
export const capturedSumut = (): Record<string, unknown> =>
  withRegistry(capturedCompositeBodies(compositeSumut), '12', 'Provinsi Sumatera Utara');
export const captured3T = (): Record<string, unknown> => capturedCompositeBodies(composite3T);
export const capturedNationalKms = (): Record<string, unknown> =>
  capturedCompositeBodies(compositeNationalKms);
export const capturedNationalHdi = (): Record<string, unknown> =>
  capturedCompositeBodies(compositeNationalHdi);

/**
 * Adds the CAPTURED production values of `inf_safe_water_pct` (2026-10-23), where Lanny Jaya (9507,
 * IMPUTED_PROVINCE) has raw 32.89 but published score 100. Other weighted indicators stay unloaded.
 */
export const withCapturedWater = (bodies: Record<string, unknown>): Record<string, unknown> => ({
  ...bodies,
  '/api/v1/indicators/inf_safe_water_pct/values': structuredClone(valuesWater),
});

// ---------------------------------------------------------------------------------------------
// Data Hub v2.2 (snapshot pinning). CAPTURED production responses, 2026-10-24 (live-v2.2/README.md).
// ---------------------------------------------------------------------------------------------

export const SNAPSHOT_22 = '2026.10.0-live-62354dfad392d985';
export const DIGEST_22 = '62354dfad392d985168450ac670b6c647ab097e800ee023768d5858387a984b5';
export const KMS_WEIGHTS = JATENG_WEIGHTS;

/** Everything a pinned Lab passport fetches for the national kemiskinan + stunting scenario (v2.2). */
export function captured22NationalKms(): Record<string, unknown> {
  const values = Object.fromEntries(
    Object.keys(KMS_WEIGHTS).map((id) => [
      `/api/v1/indicators/${id}/values`,
      clone(`live-v2.2/values_${id === 'inf_safe_water_pct' ? 'water' : id}`),
    ]),
  );
  return {
    '/api/v1/snapshots': clone('live-v2.2/snapshots'),
    [`/api/v1/snapshots/${SNAPSHOT_22}`]: clone('live-v2.2/snapshot_detail'),
    [COMPOSITE_PATH]: clone('live-v2.2/composite_national_kms'),
    '/api/v1/indicators/composite-presets': clone('live-v2.2/presets'),
    '/api/v1/indicators': clone('live-v2.2/catalog'),
    // CAPTURED: /datasets sends meta.content_sha256 null; only its header carries the digest.
    '/api/v1/datasets': withHeaders(clone('live-v2.2/datasets'), {
      'X-NusaMatra-Snapshot': SNAPSHOT_22,
      'X-NusaMatra-Content-SHA256': DIGEST_22,
    }),
    '/api/v1/indicators/coverage': clone('live-v2.2/coverage'),
    ...values,
  };
}

/** The same set with the CAPTURED non-rankable composite (multihazard 5000 + school travel time 5000). */
export const NON_RANKABLE_WEIGHTS = {
  dis_multihazard_index: 5000,
  edu_school_travel_time_p90: 5000,
} as const;
export function captured22NonRankable(): Record<string, unknown> {
  return { ...captured22NationalKms(), [COMPOSITE_PATH]: clone('live-v2.2/composite_nonrankable') };
}

/** The page's own Lab loader over the given bodies, for builder-level tests. Absent bodies are gaps. */
export function loadCompositeSources(
  bodies: HubBodies,
  mode: DataMode,
  weights: Readonly<Record<string, number>>,
  provinceId: string | null,
  linkSnapshotId: string | null = null,
): Promise<RawCompositeSources> {
  return loadSourcesForLab(repositoryOver(hubFetch(bodies)), weights, provinceId, mode, linkSnapshotId);
}

export const DEMO_COMPOSITE_WEIGHTS = {
  dis_multihazard_index: 3500,
  soc_poverty_rate: 2500,
  edu_damaged_classrooms_pct: 2000,
  hlt_stunting_prevalence: 2000,
} as const;

/** CAPTURED DEMO (v0.1) composite response, with the captured DEMO catalog, datasets and snapshots. */
export function capturedDemoComposite(): Record<string, unknown> {
  const demo = capturedDemoBodies();
  return {
    [COMPOSITE_PATH]: clone('composite_valid'),
    '/api/v1/indicators': demo['/api/v1/indicators'],
    '/api/v1/datasets': demo['/api/v1/datasets'],
    '/api/v1/snapshots': demo['/api/v1/snapshots'],
    [`/api/v1/snapshots/${DEMO_SNAPSHOT}`]: demo[`/api/v1/snapshots/${DEMO_SNAPSHOT}`],
    '/api/v1/indicators/composite-presets': {
      status: 'success',
      meta: { snapshot_id: '2026.10.0-wia-demo', mode: 'DEMO', boundary_version: null, total_count: 0 },
      data: [],
    },
  };
}
