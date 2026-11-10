/**
 * DEMO — simulated values for the landing-page previews only.
 *
 * Nothing here is official data. The region names are placeholders ("Wilayah A"), the
 * normalised values were chosen so the computed scores match the example in the approved
 * Figma (27:2), and every screen that shows them carries a visible "data simulasi" label.
 * Real data comes from the separate Data Hub service.
 */
import type { ScoringRegion, WeightsBps } from '@/domain/prioritization';
import { localized, t } from '@/lib/i18n';

export const DATA_ORIGIN = 'DEMO' as const;

export type DemoCriterionId = 'floodExposure' | 'socialVulnerability' | 'serviceCapacity';

export const DEMO_CRITERIA = localized(
  (): readonly { id: DemoCriterionId; label: string; shortLabel: string }[] => [
    { id: 'floodExposure', label: t('Paparan banjir'), shortLabel: t('Banjir') },
    { id: 'socialVulnerability', label: t('Kerentanan sosial'), shortLabel: t('Sosial') },
    { id: 'serviceCapacity', label: t('Kapasitas layanan'), shortLabel: t('Layanan') },
  ],
);

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

export const DEMO_REGIONS = localized((): readonly ScoringRegion<DemoCriterionId>[] => [
  {
    code: 'DEMO-A',
    name: t('Wilayah A'),
    values: { floodExposure: 0.88, socialVulnerability: 0.82, serviceCapacity: 0.7 },
  },
  {
    code: 'DEMO-B',
    name: t('Wilayah B'),
    values: { floodExposure: 0.5, socialVulnerability: 0.64, serviceCapacity: 0.8 },
  },
  {
    code: 'DEMO-D',
    name: t('Wilayah D'),
    values: { floodExposure: 0.84, socialVulnerability: 0.74, serviceCapacity: 0.5 },
  },
]);

export type DataStatusKind = 'complete' | 'yearMismatch' | 'blocked';

/** Example data-health findings as drawn in Figma; illustrative, not a diagnosis of a real dataset. */
export const DEMO_DATA_STATUSES = localized(
  (): readonly { kind: DataStatusKind; title: string; description: string }[] => [
    {
      kind: 'complete',
      title: t('Data lengkap'),
      description: t('38 kombinasi indikator–wilayah lengkap dan setahun.'),
    },
    {
      kind: 'yearMismatch',
      title: t('Tahun berbeda'),
      description: t('Kapasitas layanan memakai 2021 untuk 3 wilayah.'),
    },
    {
      kind: 'blocked',
      title: t('Perbandingan diblokir'),
      description: t('Akses air minum diukur dengan metode berbeda.'),
    },
  ],
);

/** Sample Paspor Bukti preview (Figma 41:324). The identifier says CONTOH: no report has this number. */
export const DEMO_PASSPORT_PREVIEW = localized(
  () =>
    ({
      id: 'CONTOH-0412',
      rows: [
        // The agencies a real passport cites (indicators and BIG boundaries; BMKG is never one), and
        // the span of their datasets' years (SKI 2023 to BIG 2026).
        { label: t('Sumber'), value: t('BPS, BNPB, Kemenkes, Kemendikdasmen, BIG') },
        { label: t('Tahun'), value: t('2023 sampai 2026') },
        { label: t('Asumsi'), value: t('Banjir 45%, Sosial 35%, Layanan 20%') },
      ],
    }) as const,
);
