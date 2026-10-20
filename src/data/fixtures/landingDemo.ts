/**
 * DEMO — simulated values for the landing-page previews only.
 *
 * Nothing here is official data. The region names are placeholders ("Wilayah A"), the
 * normalised values were chosen so the computed scores match the example in the approved
 * Figma (27:2), and every screen that shows them carries a visible "data simulasi" label.
 * Real data will come from the separate Data Hub service (docs/08-API-SPECIFICATION.md).
 */
import type { ScoringRegion, WeightsBps } from '@/domain/prioritization';

export const DATA_ORIGIN = 'DEMO' as const;

export type DemoCriterionId = 'floodExposure' | 'socialVulnerability' | 'serviceCapacity';

export const DEMO_CRITERIA: readonly { id: DemoCriterionId; label: string; shortLabel: string }[] = [
  { id: 'floodExposure', label: 'Paparan banjir', shortLabel: 'Banjir' },
  { id: 'socialVulnerability', label: 'Kerentanan sosial', shortLabel: 'Sosial' },
  { id: 'serviceCapacity', label: 'Kapasitas layanan', shortLabel: 'Layanan' },
];

/** The scenario shown in the Lab preview (45% · 35% · 20%). */
export const DEMO_CURRENT_WEIGHTS: WeightsBps<DemoCriterionId> = {
  floodExposure: 4500,
  socialVulnerability: 3500,
  serviceCapacity: 2000,
};

/**
 * An earlier scenario that ranks Wilayah B above Wilayah D. The G6 animation replays the
 * change from this scenario to the current one once, so the reorder is computed, not scripted.
 */
export const DEMO_PREVIOUS_WEIGHTS: WeightsBps<DemoCriterionId> = {
  floodExposure: 2000,
  socialVulnerability: 3000,
  serviceCapacity: 5000,
};

export const DEMO_REGIONS: readonly ScoringRegion<DemoCriterionId>[] = [
  {
    code: 'DEMO-A',
    name: 'Wilayah A',
    values: { floodExposure: 0.88, socialVulnerability: 0.82, serviceCapacity: 0.7 },
  },
  {
    code: 'DEMO-B',
    name: 'Wilayah B',
    values: { floodExposure: 0.5, socialVulnerability: 0.64, serviceCapacity: 0.8 },
  },
  {
    code: 'DEMO-D',
    name: 'Wilayah D',
    values: { floodExposure: 0.84, socialVulnerability: 0.74, serviceCapacity: 0.5 },
  },
];

export type DataStatusKind = 'complete' | 'yearMismatch' | 'blocked';

/** Example data-health findings as drawn in Figma; illustrative, not a diagnosis of a real dataset. */
export const DEMO_DATA_STATUSES: readonly { kind: DataStatusKind; title: string; description: string }[] = [
  {
    kind: 'complete',
    title: 'Data lengkap',
    description: '38 kombinasi indikator–wilayah lengkap dan setahun.',
  },
  {
    kind: 'yearMismatch',
    title: 'Tahun berbeda',
    description: 'Kapasitas layanan memakai 2021 untuk 3 wilayah.',
  },
  {
    kind: 'blocked',
    title: 'Perbandingan diblokir',
    description: 'Akses air minum diukur dengan metode berbeda.',
  },
];

/** Floating cards around the hero diorama (Figma 27:102, 27:107, 27:112). */
export const DEMO_HERO_CARDS: readonly {
  id: string;
  title: string;
  detail: string;
  badge: string;
  badgeTone: 'neutral' | 'warning';
}[] = [
  {
    id: 'a',
    title: 'Wilayah A · prioritas tinggi',
    detail: 'Skor 0,82 dari 3 indikator',
    badge: 'Data simulasi untuk prototipe',
    badgeTone: 'neutral',
  },
  {
    id: 'b',
    title: 'Wilayah B · prioritas sedang',
    detail: 'Paparan banjir naik dibanding 2021',
    badge: 'Data simulasi untuk prototipe',
    badgeTone: 'neutral',
  },
  {
    id: 'c',
    title: 'Wilayah C',
    detail: 'Data kemiskinan 2021, risiko 2023',
    badge: 'Tahun berbeda',
    badgeTone: 'warning',
  },
];

/** Sample Paspor Bukti preview (Figma 41:324). The identifier is an example, not a real report. */
export const DEMO_PASSPORT_PREVIEW = {
  id: 'NM-2026-0412',
  rows: [
    { label: 'Sumber', value: 'BNPB InaRISK, BPS (direncanakan)' },
    { label: 'Tahun', value: '2023 · 2021' },
    { label: 'Asumsi', value: 'Banjir 45% · Sosial 35% · Layanan 20%' },
  ],
} as const;
