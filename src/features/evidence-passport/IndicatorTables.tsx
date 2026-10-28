import { categoryLabel } from '@/features/data-hub';
import { evidenceClassLabel, evidenceClassMeaning, type EvidenceClass } from './evidenceClass';
import type { EvidenceIndicator, EvidenceRecord, EvidenceValue, IndicatorSourceInfo } from './evidenceTypes';
import { Disclosure } from './Disclosure';
import { ScrollRegion } from './ScrollRegion';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';

const WARN_CLASSES: ReadonlySet<EvidenceClass> = new Set([
  'IMPUTED_PROVINCE',
  'DEMO_EXAMPLE',
  'OTHER_FLAG',
  'UNSPECIFIED',
]);

/** The indicator's name; its definition, derivation and source unit open on demand. */
function IndicatorCell({ indicator }: { readonly indicator: EvidenceIndicator }) {
  return (
    <div className={styles.cell}>
      <span className={styles.indicatorName}>{indicator.label}</span>
      <Disclosure
        variant="inline"
        title={indicator.derivationFormula ? 'Definisi, rumus, dan satuan' : 'Definisi dan satuan'}
        context={indicator.label}
      >
        <p>{indicator.definition ?? 'Definisi belum tersedia dari Data Hub.'}</p>
        {indicator.derivationFormula && <p>Rumus turunan: {indicator.derivationFormula}</p>}
        <p>Satuan dari sumber: {indicator.rawUnit || 'belum tersedia'}</p>
      </Disclosure>
    </div>
  );
}

function ValueAndYear({ value }: { readonly value: EvidenceValue | null }) {
  if (!value) {
    return <span className={`kk-small ${styles.muted}`}>Tidak ada entri untuk indikator ini.</span>;
  }
  return (
    <div className={styles.cell}>
      <span className={styles.value} data-missing={value.status === 'AVAILABLE' ? undefined : true}>
        {value.valueText}
      </span>
      <span className={`kk-small ${styles.muted}`}>
        Tahun {value.referenceYear === null ? 'belum tersedia' : value.referenceYear}
      </span>
    </div>
  );
}

function ClassTag({ value }: { readonly value: EvidenceValue | null }) {
  if (!value?.evidenceClass) {
    return <span className={`kk-small ${styles.muted}`}>Tidak ada nilai untuk digolongkan.</span>;
  }
  const { evidenceClass } = value;
  return (
    <div className={styles.cell}>
      <span>
        <span className={`${styles.tag} ${WARN_CLASSES.has(evidenceClass) ? styles.tagWarn : ''}`}>
          {evidenceClassLabel(evidenceClass, value.rawFlag)}
        </span>
      </span>
      <Disclosure
        variant="inline"
        title="Arti kelas bukti"
        context={evidenceClassLabel(evidenceClass, value.rawFlag)}
      >
        <p>{value.classNote ?? evidenceClassMeaning(evidenceClass)}</p>
      </Disclosure>
    </div>
  );
}

function SourceLine({ source }: { readonly source: IndicatorSourceInfo }) {
  const name = `${source.agencyCode ?? 'Lembaga belum tersedia'} · ${source.datasetTitle ?? source.datasetId ?? 'judul dataset belum tersedia'}`;
  if (!source.officialUrl) {
    return (
      <span className={styles.cell}>
        <span>{name}</span>
        <span className={`kk-small ${styles.muted}`}>Tautan sumber belum tersedia.</span>
      </span>
    );
  }
  return (
    <a className={styles.link} href={source.officialUrl} target="_blank" rel="noreferrer noopener">
      {name}
      <span className={styles.srOnly}> (membuka tab baru)</span>
    </a>
  );
}

function groupByCategory(indicators: readonly EvidenceIndicator[]): [string, EvidenceIndicator[]][] {
  const groups = new Map<string, EvidenceIndicator[]>();
  for (const indicator of indicators) {
    const group = groups.get(indicator.category) ?? [];
    group.push(indicator);
    groups.set(indicator.category, group);
  }
  return [...groups.entries()];
}

function categoryCaption(category: string, count: number): string {
  return `${category ? categoryLabel(category) : 'Tanpa kategori'} (${String(count)} indikator)`;
}

function SingleRegionTable({
  category,
  indicators,
}: {
  readonly category: string;
  readonly indicators: readonly EvidenceIndicator[];
}) {
  return (
    <ScrollRegion label={categoryCaption(category, indicators.length)}>
      <table className={`${styles.table} ${styles.fixedTable}`}>
        <caption className="kk-body-strong">{categoryCaption(category, indicators.length)}</caption>
        {/* One set of column widths for every category's table, so the columns line up down the page. */}
        <colgroup>
          <col style={{ width: '34%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '26%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Indikator</th>
            <th scope="col">Nilai dan tahun</th>
            <th scope="col">Kelas bukti</th>
            <th scope="col">Sumber</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((indicator) => {
            const value = indicator.values[0] ?? null;
            return (
              <tr key={indicator.indicatorId}>
                <th scope="row">
                  <IndicatorCell indicator={indicator} />
                </th>
                <td>
                  <ValueAndYear value={value} />
                </td>
                <td>
                  <ClassTag value={value} />
                </td>
                <td>{value ? <SourceLine source={value.source} /> : 'Sumber belum tersedia.'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

function ComparisonCell({ indicator }: { readonly indicator: EvidenceIndicator }) {
  const { comparison } = indicator;
  if (!comparison) return null;
  return (
    <div className={styles.cell}>
      {comparison.allowed ? (
        <>
          <span>
            <span className={styles.tag}>Dapat dibandingkan</span>
          </span>
          <span>{comparison.differenceText}</span>
        </>
      ) : (
        <>
          <span>
            <span className={`${styles.tag} ${styles.tagWarn}`}>Tidak dibandingkan</span>
          </span>
          <ul role="list" className={`kk-small ${styles.list}`}>
            {comparison.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </>
      )}
      {comparison.warnings.length > 0 && (
        <ul role="list" className={`kk-small ${styles.list}`}>
          {comparison.warnings.map((warning) => (
            <li key={warning}>Peringatan: {warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComparisonSources({ indicator }: { readonly indicator: EvidenceIndicator }) {
  const [a, b] = indicator.values;
  if (a && b && a.source.datasetId === b.source.datasetId && a.source.datasetId !== null) {
    return <SourceLine source={a.source} />;
  }
  return (
    <div className={styles.cell}>
      {a && (
        <span>
          <strong>A: </strong>
          <SourceLine source={a.source} />
        </span>
      )}
      {b && (
        <span>
          <strong>B: </strong>
          <SourceLine source={b.source} />
        </span>
      )}
      {!a && !b && 'Sumber belum tersedia.'}
    </div>
  );
}

function ComparisonTable({
  category,
  indicators,
  names,
}: {
  readonly category: string;
  readonly indicators: readonly EvidenceIndicator[];
  readonly names: readonly [string, string];
}) {
  return (
    <ScrollRegion label={categoryCaption(category, indicators.length)}>
      <table className={`${styles.table} ${styles.fixedTable}`}>
        <caption className="kk-body-strong">{categoryCaption(category, indicators.length)}</caption>
        {/* One set of column widths for every category's table, so the columns line up down the page. */}
        <colgroup>
          <col style={{ width: '28%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Indikator</th>
            <th scope="col">A: {names[0]}</th>
            <th scope="col">B: {names[1]}</th>
            <th scope="col">Perbandingan</th>
            <th scope="col">Sumber</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((indicator) => (
            <tr key={indicator.indicatorId}>
              <th scope="row">
                <IndicatorCell indicator={indicator} />
              </th>
              {[0, 1].map((index) => {
                const value = indicator.values[index] ?? null;
                return (
                  <td key={index}>
                    <div className={styles.cell}>
                      <ValueAndYear value={value} />
                      <ClassTag value={value} />
                    </div>
                  </td>
                );
              })}
              <td>
                <ComparisonCell indicator={indicator} />
              </td>
              <td>
                <ComparisonSources indicator={indicator} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

export function IndicatorTables({ record }: { readonly record: EvidenceRecord }) {
  const groups = groupByCategory(record.indicators);
  const names: readonly [string, string] = [
    record.regions[0]?.name ?? 'Wilayah A',
    record.regions[1]?.name ?? 'Wilayah B',
  ];

  return (
    <Section
      id="paspor-indikator"
      title={
        record.kind === 'bandingkan'
          ? 'Indikator, bukti, dan hasil perbandingan'
          : 'Indikator, kelas bukti, dan sumber'
      }
      mode={record.source.dataMode}
    >
      {record.indicators.length === 0 ? (
        <p className="kk-body">
          Tidak ada indikator yang dapat ditampilkan: Data Hub tidak memuat nilai untuk permintaan ini pada
          snapshot ini.
        </p>
      ) : (
        groups.map(([category, indicators]) =>
          record.kind === 'bandingkan' ? (
            <ComparisonTable key={category} category={category} indicators={indicators} names={names} />
          ) : (
            <SingleRegionTable key={category} category={category} indicators={indicators} />
          ),
        )
      )}
    </Section>
  );
}
