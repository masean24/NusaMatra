import type { CompositeEvidenceRecord, CompositeRegionRow } from './compositeTypes';
import { withheldReasonText } from './withheldReason';
import { scopeLabel } from './scopeLabel';
import { Section } from './Section';
import { bpsLabel } from './weightLabel';
import styles from './EvidencePassport.module.css';
import { locale, t } from '@/lib/i18n';

/** How many regions the summary names; the full ranking stays in its own section and in the JSON. */
export const SUMMARY_TOP_COUNT = 5;

const percent = (value: number) => `${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;

function coverageText(row: CompositeRegionRow): string {
  if (row.coveragePct === null) return t('cakupan tidak dilaporkan');
  return row.tier === 'partial'
    ? t('cakupan {0}, bobot dialihkan', percent(row.coveragePct))
    : t('cakupan {0}', percent(row.coveragePct));
}

function TopRegions({ record }: { readonly record: CompositeEvidenceRecord }) {
  const top = record.rows.slice(0, SUMMARY_TOP_COUNT);
  if (top.length === 0) {
    return (
      <p className="kk-body">{t('Data Hub tidak mengirim wilayah berperingkat untuk permintaan ini.')}</p>
    );
  }
  return (
    <>
      <h3 className="kk-body-strong">
        {t(
          '{0} wilayah dengan prioritas tertinggi, {1}',
          top.length,
          scopeLabel(record.scope.provinceId, record.scope.provinceName),
        )}
      </h3>
      <ol role="list" className={styles.topList} aria-label={t('Wilayah dengan prioritas tertinggi')}>
        {top.map((row) => (
          <li key={row.regionId} className={styles.topItem} data-focus={row.isFocus || undefined}>
            <span className={styles.topRank}>
              <span className={styles.srOnly}>{t('Peringkat')} </span>
              {row.rank ?? '–'}
            </span>
            <span className={styles.topName}>
              <span className="kk-body-strong">{row.name}</span>
              <span className={`kk-small ${styles.muted}`}>
                {t('Skor {0}, {1}', row.scoreText ?? t('belum tersedia'), coverageText(row))}
                {row.isFocus && t(' (wilayah yang Anda buka)')}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className={`kk-small ${styles.muted}`}>
        {record.scoreMeaning}{' '}
        <a href="#paspor-peringkat" className={`${styles.link} ${styles.noPrint}`}>
          {t('Lihat peringkat lengkap')}
        </a>
      </p>
    </>
  );
}

function Withheld({ record }: { readonly record: CompositeEvidenceRecord }) {
  return (
    <div className={styles.withheld}>
      <p className="kk-body-strong">{t('Peringkat ditahan, jadi tidak ada daftar wilayah teratas.')}</p>
      <p className="kk-small">{withheldReasonText(record)}</p>
    </div>
  );
}

/**
 * The answer of a Lab passport (or why there is none) and what it was computed from. Reproducibility
 * and sources are in the hero and the trust overview. Every figure is read from the record; nothing
 * here re-ranks or recomputes.
 */
export function CompositeSummary({ record }: { readonly record: CompositeEvidenceRecord }) {
  const { source, integrity } = record;
  return (
    <Section id="paspor-ringkasan" title={t('Ringkasan hasil')} mode={source.dataMode}>
      {record.ranking === 'SHOWN' ? <TopRegions record={record} /> : <Withheld record={record} />}
      <dl className={styles.summaryFacts}>
        <div>
          <dt>{t('Kriteria dan bobot diminta')}</dt>
          <dd>
            <ul role="list" className={styles.chips}>
              {record.indicators.map((indicator) => (
                <li key={indicator.indicatorId} className={styles.chip}>
                  {indicator.label} <strong>{bpsLabel(indicator.requestedBps)}</strong>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>{t('Kualitas dan cakupan data')}</dt>
          <dd>
            {record.ranking === 'SHOWN'
              ? t(
                  '{0} wilayah lengkap, {1} parsial, {2} tidak diperingkat',
                  String(integrity.coverageTiers.complete),
                  String(integrity.coverageTiers.partial),
                  String(record.insufficient.length),
                )
              : t('Tidak dinyatakan karena peringkat ditahan.')}
            {integrity.requestedWeightAvailabilityPct !== null &&
              t(
                '. Bobot yang diminta tersedia {0} secara nasional.',
                percent(integrity.requestedWeightAvailabilityPct),
              )}
          </dd>
        </div>
      </dl>
    </Section>
  );
}
