import type { CompositeEvidenceRecord, CompositeRegionRow } from './compositeTypes';
import { withheldReasonText } from './withheldReason';
import { scopeLabel } from './scopeLabel';
import { Section } from './Section';
import { bpsLabel } from './weightLabel';
import styles from './EvidencePassport.module.css';

/** How many regions the summary names; the full ranking stays in its own section and in the JSON. */
export const SUMMARY_TOP_COUNT = 5;

const percent = (value: number) => `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

function coverageText(row: CompositeRegionRow): string {
  if (row.coveragePct === null) return 'cakupan tidak dilaporkan';
  return row.tier === 'partial'
    ? `cakupan ${percent(row.coveragePct)}, bobot dialihkan`
    : `cakupan ${percent(row.coveragePct)}`;
}

function TopRegions({ record }: { readonly record: CompositeEvidenceRecord }) {
  const top = record.rows.slice(0, SUMMARY_TOP_COUNT);
  if (top.length === 0) {
    return <p className="kk-body">Data Hub tidak mengirim wilayah berperingkat untuk permintaan ini.</p>;
  }
  return (
    <>
      <h3 className="kk-body-strong">
        {top.length} wilayah dengan prioritas tertinggi ·{' '}
        {scopeLabel(record.scope.provinceId, record.scope.provinceName)}
      </h3>
      <ol role="list" className={styles.topList} aria-label="Wilayah dengan prioritas tertinggi">
        {top.map((row) => (
          <li key={row.regionId} className={styles.topItem} data-focus={row.isFocus || undefined}>
            <span className={styles.topRank}>
              <span className={styles.srOnly}>Peringkat </span>
              {row.rank ?? '–'}
            </span>
            <span className={styles.topName}>
              <span className="kk-body-strong">{row.name}</span>
              <span className={`kk-small ${styles.muted}`}>
                Skor {row.scoreText ?? 'belum tersedia'} · {coverageText(row)}
                {row.isFocus && ' · wilayah yang Anda buka'}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className={`kk-small ${styles.muted}`}>
        {record.scoreMeaning}{' '}
        <a href="#paspor-peringkat" className={`${styles.link} ${styles.noPrint}`}>
          Lihat peringkat lengkap
        </a>
      </p>
    </>
  );
}

function Withheld({ record }: { readonly record: CompositeEvidenceRecord }) {
  return (
    <div className={styles.withheld}>
      <p className="kk-body-strong">Peringkat ditahan, jadi tidak ada daftar wilayah teratas.</p>
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
    <Section id="paspor-ringkasan" title="Ringkasan hasil" mode={source.dataMode}>
      {record.ranking === 'SHOWN' ? <TopRegions record={record} /> : <Withheld record={record} />}
      <dl className={styles.summaryFacts}>
        <div>
          <dt>Kriteria dan bobot diminta</dt>
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
          <dt>Kualitas dan cakupan data</dt>
          <dd>
            {record.ranking === 'SHOWN'
              ? `${String(integrity.coverageTiers.complete)} wilayah lengkap · ${String(integrity.coverageTiers.partial)} parsial · ${String(record.insufficient.length)} tidak diperingkat`
              : 'Tidak dinyatakan karena peringkat ditahan.'}
            {integrity.requestedWeightAvailabilityPct !== null &&
              ` · bobot diminta tersedia ${percent(integrity.requestedWeightAvailabilityPct)} secara nasional`}
          </dd>
        </div>
      </dl>
    </Section>
  );
}
