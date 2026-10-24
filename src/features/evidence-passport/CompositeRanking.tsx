import { evidenceClassLabel, type EvidenceClass } from './evidenceClass';
import type {
  CompositeEvidenceRecord,
  CompositeRegionRow,
  InsufficientRegionRow,
  RegionComponent,
} from './compositeTypes';
import { ScrollRegion } from './ScrollRegion';
import { Section } from './Section';
import { bpsLabel } from './weightLabel';
import styles from './EvidencePassport.module.css';

const percentLabel = (value: number | null): string =>
  value === null ? 'belum tersedia' : `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

const WARN_CLASSES: ReadonlySet<EvidenceClass> = new Set([
  'IMPUTED_PROVINCE',
  'DEMO_EXAMPLE',
  'OTHER_FLAG',
  'UNSPECIFIED',
]);

function FocusTag() {
  return <span className={styles.tag}>Wilayah yang Anda buka</span>;
}

function CoverageCell({
  row,
  labelOf,
}: {
  readonly row: CompositeRegionRow;
  readonly labelOf: (id: string) => string;
}) {
  return (
    <div className={styles.cell}>
      <span className={styles.value}>{percentLabel(row.coveragePct)}</span>
      {row.tier === 'complete' && <span className={styles.tag}>Lengkap</span>}
      {row.tier === 'partial' && (
        <span className={`${styles.tag} ${styles.tagWarn}`}>Parsial, bobot dialihkan</span>
      )}
      {row.tier === 'unreported' && <span className={styles.tag}>Cakupan tidak dilaporkan</span>}
      {row.missingIndicators.length > 0 && (
        <span className="kk-small">
          Tidak ada data: {row.missingIndicators.map((id) => labelOf(id)).join(', ')}
        </span>
      )}
    </div>
  );
}

function ComponentLine({
  component,
  differs,
  requestedBps,
}: {
  readonly component: RegionComponent;
  readonly differs: boolean;
  readonly requestedBps: number | undefined;
}) {
  if (!component.hasScore) {
    return (
      <li>
        <strong>{component.label}</strong>: tidak tersedia (tidak dihitung, bukan nol)
      </li>
    );
  }
  if (component.weightBps === null) {
    return (
      <li>
        <strong>{component.label}</strong>: skor {component.scoreText} · bobot wilayah belum dilaporkan
      </li>
    );
  }
  return (
    <li>
      <strong>{component.label}</strong>: skor {component.scoreText} · bobot wilayah{' '}
      {bpsLabel(component.weightBps)}
      {differs && requestedBps !== undefined && ` (diminta ${bpsLabel(requestedBps)})`}
      <ObservationSource component={component} />
    </li>
  );
}

/**
 * The observation's own source, shown only where it differs from the indicator's catalog dataset (for
 * example a province-level value standing in for a kabupaten/kota one). Every row keeps it in the JSON.
 */
function ObservationSource({ component }: { readonly component: RegionComponent }) {
  const { observationDatasetId, sourceRecordRef, catalogDatasetId } = component;
  if (!observationDatasetId || observationDatasetId === catalogDatasetId) return null;
  return (
    <>
      {' · sumber observasi: '}
      <span className={styles.code}>{observationDatasetId}</span>
      {sourceRecordRef && ` (${sourceRecordRef})`}
    </>
  );
}

function QualityCell({ row }: { readonly row: CompositeRegionRow }) {
  const classes = new Map<string, { evidenceClass: EvidenceClass; flag: string | null; labels: string[] }>();
  for (const component of row.components) {
    if (!component.evidenceClass) continue;
    const key = evidenceClassLabel(component.evidenceClass, component.flag);
    const entry = classes.get(key) ?? {
      evidenceClass: component.evidenceClass,
      flag: component.flag,
      labels: [],
    };
    entry.labels.push(component.label);
    classes.set(key, entry);
  }
  return (
    <div className={styles.cell}>
      {[...classes.entries()].map(([label, entry]) => (
        <span key={label}>
          <span className={`${styles.tag} ${WARN_CLASSES.has(entry.evidenceClass) ? styles.tagWarn : ''}`}>
            {label}
          </span>
          {WARN_CLASSES.has(entry.evidenceClass) && (
            <span className="kk-small"> {entry.labels.join(', ')}</span>
          )}
        </span>
      ))}
      {row.imputedIndicators.length > 0 && (
        <span className="kk-small">Estimasi tingkat provinsi, bukan pengukuran kabupaten/kota.</span>
      )}
    </div>
  );
}

function RankingTable({ record }: { readonly record: CompositeEvidenceRecord }) {
  const labelOf = (id: string) =>
    record.indicators.find((indicator) => indicator.indicatorId === id)?.label ?? id;
  const caption = `Peringkat ${String(record.rows.length)} wilayah, urutan dari Data Hub`;
  return (
    <ScrollRegion label={caption}>
      <table className={`${styles.table} ${styles.wideTable}`}>
        <caption className="kk-body-strong">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Peringkat</th>
            <th scope="col">Peringkat nasional</th>
            <th scope="col">Wilayah</th>
            <th scope="col">Skor</th>
            <th scope="col">Cakupan data</th>
            <th scope="col">Kriteria, skor, dan bobot wilayah</th>
            <th scope="col">Kualitas data</th>
          </tr>
        </thead>
        <tbody>
          {record.rows.map((row) => (
            <tr
              key={row.regionId}
              className={row.isFocus ? styles.focusRow : undefined}
              data-focus={row.isFocus || undefined}
            >
              <td className={styles.numeric}>{row.rank ?? 'belum tersedia'}</td>
              <td className={styles.numeric}>{row.nationalRank ?? 'belum tersedia'}</td>
              <th scope="row">
                <div className={styles.cell}>
                  <span>{row.name}</span>
                  <span className={`kk-small ${styles.muted}`}>Kode {row.regionId}</span>
                  {row.isFocus && <FocusTag />}
                </div>
              </th>
              <td className={styles.numeric}>{row.scoreText ?? 'belum tersedia'}</td>
              <td>
                <CoverageCell row={row} labelOf={labelOf} />
              </td>
              <td>
                <ul role="list" className={`kk-small ${styles.criteriaList}`}>
                  {row.components.map((component) => (
                    <ComponentLine
                      key={component.indicatorId}
                      component={component}
                      differs={row.weightsDiffer}
                      requestedBps={record.requestedWeights[component.indicatorId]}
                    />
                  ))}
                </ul>
                {row.weightsDiffer && (
                  <span className="kk-small">
                    <span className={`${styles.tag} ${styles.tagWarn}`}>Bobot berbeda dari bobot global</span>{' '}
                    karena sebagian kriteria tidak punya nilai.
                  </span>
                )}
              </td>
              <td>
                <QualityCell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

export function RankingSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  return (
    <Section id="paspor-peringkat" title="Peringkat dari Data Hub" mode={record.source.dataMode}>
      <p className="kk-body">{record.scoreMeaning}</p>
      <p className={`kk-small ${styles.muted}`}>
        Peringkat dan skor dikutip apa adanya dari Data Hub; paspor ini tidak menghitung atau mengurutkan
        ulang.
      </p>
      <RankingTable record={record} />
    </Section>
  );
}

function InsufficientTable({
  rows,
  labelOf,
}: {
  readonly rows: readonly InsufficientRegionRow[];
  readonly labelOf: (id: string) => string;
}) {
  const caption = `Wilayah tidak diperingkat (${String(rows.length)})`;
  return (
    <ScrollRegion label={caption}>
      <table className={styles.table}>
        <caption className="kk-body-strong">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Wilayah</th>
            <th scope="col">Cakupan data</th>
            <th scope="col">Kriteria yang punya data</th>
            <th scope="col">Kriteria tanpa data</th>
            <th scope="col">Alasan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.regionId}
              className={row.isFocus ? styles.focusRow : undefined}
              data-focus={row.isFocus || undefined}
            >
              <th scope="row">
                <div className={styles.cell}>
                  <span>{row.name}</span>
                  <span className={`kk-small ${styles.muted}`}>Kode {row.regionId}</span>
                  {row.isFocus && <FocusTag />}
                </div>
              </th>
              <td className={styles.numeric}>{percentLabel(row.coveragePct)}</td>
              <td>{row.componentsUsed.map((id) => labelOf(id)).join(', ') || 'tidak ada'}</td>
              <td>{row.missingIndicators.map((id) => labelOf(id)).join(', ') || 'tidak ada'}</td>
              <td>
                <div className={styles.cell}>
                  <span className={`${styles.tag} ${styles.tagWarn}`}>Tidak diperingkat</span>
                  <span>{row.reasonText}</span>
                  <span className={`kk-small ${styles.code}`}>{row.reason}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

export function InsufficientSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  const labelOf = (id: string) =>
    record.indicators.find((indicator) => indicator.indicatorId === id)?.label ?? id;
  return (
    <Section id="paspor-tidak-diperingkat" title="Wilayah tidak diperingkat" mode={record.source.dataMode}>
      {record.insufficient.length === 0 ? (
        <p className="kk-body">
          Data Hub tidak melaporkan wilayah yang dikecualikan karena data tidak cukup pada hasil ini.
        </p>
      ) : (
        <>
          <p className="kk-body">
            Wilayah berikut tidak mendapat skor ataupun peringkat. Ini bukan skor nol: datanya tidak cukup
            untuk dihitung.
          </p>
          <InsufficientTable rows={record.insufficient} labelOf={labelOf} />
        </>
      )}
    </Section>
  );
}
