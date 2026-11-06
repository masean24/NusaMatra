import type { StatusTone } from './StatusPanel';
import { localized, t } from '@/lib/i18n';

/**
 * How far a LIVE ranking that is on screen can be trusted. A ranking that failed a blocking check never
 * reaches this: it is withheld before there is anything to describe.
 *
 * - `verified`: every check passed and there is nothing to add;
 * - `limited`: the checks passed, but the result carries limits the reader must know;
 * - `unfinished`: a check could not complete, so it cannot be called checked;
 * - `stale`: the weights changed and the list still shows the previous calculation.
 */
export type ResultTrust = 'verified' | 'limited' | 'unfinished' | 'stale';

export interface ResultFacts {
  /** The sliders differ from the weights this ranking was calculated with. */
  readonly stale: boolean;
  /** The check of score direction against the source did not complete. */
  readonly directionCheckFailed: boolean;
  /** Share of the requested weight with national data; `null` when not reported. */
  readonly requestedWeightAvailabilityPct: number | null;
  readonly partialRegions: number;
  readonly imputedRegions: number;
  readonly insufficientRegions: number;
  readonly unlistedRegions: number;
  /** Criteria whose score direction could not be fully verified against the source. */
  readonly unverifiedDirectionLabels: readonly string[];
  /** Regions outside this list whose source scores are inconsistent, which withholds national ranks. */
  readonly nationalRankWithheldRegions: readonly string[];
}

export interface ResultStatus {
  readonly trust: ResultTrust;
  readonly tone: StatusTone;
  readonly title: string;
  /** One short sentence per limit that applies; empty for a fully verified result. */
  readonly limitations: readonly string[];
}

const TITLE = localized((): Readonly<Record<ResultTrust, string>> => ({
  verified: t('Hasil lolos semua pemeriksaan'),
  limited: t('Hasil dapat dibaca dengan catatan'),
  unfinished: t('Pemeriksaan hasil belum selesai'),
  stale: t('Peringkat belum memakai bobot terbaru'),
}));

const FULL_AVAILABILITY_PCT = 100;

function limitationsOf(facts: ResultFacts): string[] {
  const limits: string[] = [];
  const available = facts.requestedWeightAvailabilityPct;
  if (available !== null && available < FULL_AVAILABILITY_PCT) {
    limits.push(
      t(
        'Kriteria senilai {0}% dari bobot Anda belum punya data untuk seluruh Indonesia, jadi tidak ikut dihitung; bobotnya dibagi ke kriteria lain.',
        (FULL_AVAILABILITY_PCT - available).toFixed(0),
      ),
    );
  }
  if (facts.imputedRegions > 0) {
    limits.push(
      t(
        '{0} wilayah memakai estimasi tingkat provinsi untuk sebagian kriteria.',
        String(facts.imputedRegions),
      ),
    );
  }
  if (facts.partialRegions > 0) {
    limits.push(
      t('{0} wilayah dihitung dari sebagian kriteria saja (diberi tanda).', String(facts.partialRegions)),
    );
  }
  if (facts.insufficientRegions > 0) {
    limits.push(
      t('{0} wilayah tidak diperingkat karena datanya belum cukup.', String(facts.insufficientRegions)),
    );
  }
  if (facts.unlistedRegions > 0) {
    limits.push(t('{0} wilayah lain tidak tercantum di hasil Data Hub.', String(facts.unlistedRegions)));
  }
  if (facts.unverifiedDirectionLabels.length > 0) {
    limits.push(
      t(
        'Arah skor belum terverifikasi penuh terhadap data sumber untuk: {0}.',
        facts.unverifiedDirectionLabels.join(', '),
      ),
    );
  }
  if (facts.nationalRankWithheldRegions.length > 0) {
    limits.push(
      t(
        'Peringkat nasional tidak ditampilkan: skor sumber {0} (di luar daftar ini) tidak konsisten, dan peringkat nasional dihitung bersama wilayah itu.',
        facts.nationalRankWithheldRegions.join(', '),
      ),
    );
  }
  if (facts.directionCheckFailed) limits.push(t('Arah skor belum dapat dicocokkan dengan data sumber.'));
  return limits;
}

/** The one status of a ranking on screen; the most urgent state wins, its limits are always listed. */
export function describeResultStatus(facts: ResultFacts): ResultStatus {
  const limitations = limitationsOf(facts);
  let trust: ResultTrust = 'verified';
  if (facts.stale) trust = 'stale';
  else if (facts.directionCheckFailed) trust = 'unfinished';
  else if (limitations.length > 0) trust = 'limited';
  return { trust, tone: trust === 'verified' ? 'ok' : 'warning', title: TITLE()[trust], limitations };
}
