import { Button } from '@/components/ui/Button/Button';
import { evidenceClassLabel, type EvidenceClass } from './evidenceClass';
import { Pagination } from './Pagination';
import { ROWS_PER_PAGE, usePagedRows } from './usePagedRows';
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
import { locale, t } from '@/lib/i18n';

/** Rows a printout carries of each long table; the exact number is printed with it. */
export const PRINT_EXCERPT_ROWS = 20;

const percentLabel = (value: number | null): string =>
  value === null ? t('belum tersedia') : `${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;

const WARN_CLASSES: ReadonlySet<EvidenceClass> = new Set([
  'IMPUTED_PROVINCE',
  'DEMO_EXAMPLE',
  'OTHER_FLAG',
  'UNSPECIFIED',
]);

function FocusTag() {
  return <span className={styles.tag}>{t('Wilayah yang Anda buka')}</span>;
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
      {row.tier === 'complete' && <span className={styles.tag}>{t('Lengkap')}</span>}
      {row.tier === 'partial' && (
        <span className={`${styles.tag} ${styles.tagWarn}`}>{t('Parsial, bobot dialihkan')}</span>
      )}
      {row.tier === 'unreported' && <span className={styles.tag}>{t('Cakupan tidak dilaporkan')}</span>}
      {row.missingIndicators.length > 0 && (
        <span className="kk-small">
          {t('Tidak ada data: {0}', row.missingIndicators.map((id) => labelOf(id)).join(', '))}
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
        <strong>{component.label}</strong>
        {t(': tidak tersedia (tidak dihitung, bukan nol)')}
      </li>
    );
  }
  if (component.weightBps === null) {
    return (
      <li>
        <strong>{component.label}</strong>
        {t(': skor {0}, bobot wilayah belum dilaporkan', component.scoreText)}
      </li>
    );
  }
  return (
    <li>
      <strong>{component.label}</strong>
      {t(': skor {0}, bobot wilayah {1}', component.scoreText, bpsLabel(component.weightBps))}
      {differs && requestedBps !== undefined && t(' (diminta {0})', bpsLabel(requestedBps))}
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
      {t('; sumber observasi:')} <span className={styles.code}>{observationDatasetId}</span>
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
        <span className="kk-small">{t('Estimasi tingkat provinsi, bukan pengukuran kabupaten/kota.')}</span>
      )}
    </div>
  );
}

function RankingTable({
  record,
  rows,
  caption,
}: {
  readonly record: CompositeEvidenceRecord;
  readonly rows: readonly CompositeRegionRow[];
  readonly caption: string;
}) {
  const labelOf = (id: string) =>
    record.indicators.find((indicator) => indicator.indicatorId === id)?.label ?? id;
  return (
    <ScrollRegion label={caption}>
      <table className={`${styles.table} ${styles.wideTable}`}>
        <caption className="kk-body-strong">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('Peringkat')}</th>
            <th scope="col">{t('Peringkat nasional')}</th>
            <th scope="col">{t('Wilayah')}</th>
            <th scope="col">{t('Skor')}</th>
            <th scope="col">{t('Cakupan data')}</th>
            <th scope="col">{t('Kriteria, skor, dan bobot wilayah')}</th>
            <th scope="col">{t('Kualitas data')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.regionId}
              className={row.isFocus ? styles.focusRow : undefined}
              data-focus={row.isFocus || undefined}
            >
              <td className={styles.numeric}>{row.rank ?? t('belum tersedia')}</td>
              <td className={styles.numeric}>{row.nationalRank ?? t('belum tersedia')}</td>
              <th scope="row">
                <div className={styles.cell}>
                  <span>{row.name}</span>
                  <span className={`kk-small ${styles.muted}`}>{t('Kode {0}', row.regionId)}</span>
                  {row.isFocus && <FocusTag />}
                </div>
              </th>
              <td className={styles.numeric}>{row.scoreText ?? t('belum tersedia')}</td>
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
                    <span className={`${styles.tag} ${styles.tagWarn}`}>
                      {t('Bobot berbeda dari bobot global')}
                    </span>{' '}
                    {t('karena sebagian kriteria tidak punya nilai.')}
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

/**
 * What a printout of a long table holds, said on the paper itself: the exact number of rows printed,
 * out of how many, and where the complete list is.
 */
function printExcerptNote(printed: number, total: number, noun: string): string {
  return printed >= total
    ? t('Cetakan ini memuat seluruh {0} {1}.', String(total), noun)
    : t(
        'Cetakan ringkas: hanya {0} baris pertama (urutan 1–{1}) dari {2} {3} yang dicetak. Daftar lengkap ada di berkas JSON ("Unduh JSON" pada halaman Paspor Bukti); cetakan ini bukan daftar lengkap.',
        String(printed),
        String(printed),
        String(total),
        noun,
      );
}

/** Caption of a printed table: an excerpt says so; a table that fits whole says it is complete. */
function printCaption(printed: number, total: number, noun: string): string {
  return printed >= total
    ? t('Cetakan lengkap: {0} {1}', String(total), noun)
    : t('Kutipan cetak: {0} dari {1} {2}', String(printed), String(total), noun);
}

export function RankingSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  const paged = usePagedRows(record.rows);
  const total = record.rows.length;
  const caption = t('Peringkat {0} wilayah, urutan dari Data Hub', String(total));
  const focusIndex = record.rows.findIndex((row) => row.isFocus);
  const focusPage = focusIndex < 0 ? null : Math.floor(focusIndex / ROWS_PER_PAGE);
  const focusRow = focusIndex < 0 ? null : record.rows[focusIndex];
  const excerpt = record.rows.slice(0, PRINT_EXCERPT_ROWS);

  return (
    <Section id="paspor-peringkat" title={t('Peringkat dari Data Hub')} mode={record.source.dataMode}>
      <p className="kk-body">{record.scoreMeaning}</p>
      <p className={`kk-small ${styles.muted}`}>
        {t(
          'Peringkat dan skor dikutip apa adanya dari Data Hub; paspor ini tidak menghitung atau mengurutkan ulang.',
        )}
        <span className={styles.noPrint}>
          {' '}
          {t(
            'Halaman ini menampilkan {0} baris sekaligus; berkas JSON memuat seluruh {1} wilayah.',
            ROWS_PER_PAGE,
            total,
          )}
        </span>
      </p>
      <div className={styles.screenOnly}>
        {focusPage !== null && focusRow && focusPage !== paged.page && (
          <p>
            <Button
              variant="secondary"
              onClick={() => {
                paged.setPage(focusPage);
              }}
            >
              {t('Tampilkan wilayah yang Anda buka (urutan')} {focusIndex + 1})
            </Button>
          </p>
        )}
        <RankingTable record={record} rows={paged.pageRows} caption={caption} />
        <Pagination
          label={t('peringkat wilayah')}
          noun={t('wilayah berperingkat')}
          total={total}
          paging={paged}
        />
      </div>
      <div className={styles.printOnly}>
        <p className={`kk-small ${styles.printExcerptNote}`}>
          {printExcerptNote(excerpt.length, total, t('wilayah berperingkat'))}
        </p>
        <RankingTable
          record={record}
          rows={excerpt}
          caption={printCaption(excerpt.length, total, t('wilayah berperingkat'))}
        />
      </div>
    </Section>
  );
}

function InsufficientTable({
  rows,
  caption,
  labelOf,
}: {
  readonly rows: readonly InsufficientRegionRow[];
  readonly caption: string;
  readonly labelOf: (id: string) => string;
}) {
  return (
    <ScrollRegion label={caption}>
      <table className={styles.table}>
        <caption className="kk-body-strong">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('Wilayah')}</th>
            <th scope="col">{t('Cakupan data')}</th>
            <th scope="col">{t('Kriteria yang punya data')}</th>
            <th scope="col">{t('Kriteria tanpa data')}</th>
            <th scope="col">{t('Alasan')}</th>
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
                  <span className={`kk-small ${styles.muted}`}>{t('Kode {0}', row.regionId)}</span>
                  {row.isFocus && <FocusTag />}
                </div>
              </th>
              <td className={styles.numeric}>{percentLabel(row.coveragePct)}</td>
              <td>{row.componentsUsed.map((id) => labelOf(id)).join(', ') || t('tidak ada')}</td>
              <td>{row.missingIndicators.map((id) => labelOf(id)).join(', ') || t('tidak ada')}</td>
              <td>
                <div className={styles.cell}>
                  <span className={`${styles.tag} ${styles.tagWarn}`}>{t('Tidak diperingkat')}</span>
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

function InsufficientList({ record }: { readonly record: CompositeEvidenceRecord }) {
  const labelOf = (id: string) =>
    record.indicators.find((indicator) => indicator.indicatorId === id)?.label ?? id;
  const paged = usePagedRows(record.insufficient);
  const total = record.insufficient.length;
  const excerpt = record.insufficient.slice(0, PRINT_EXCERPT_ROWS);
  return (
    <>
      <div className={styles.screenOnly}>
        <InsufficientTable
          rows={paged.pageRows}
          caption={t('Wilayah tidak diperingkat ({0})', String(total))}
          labelOf={labelOf}
        />
        <Pagination
          label={t('wilayah tidak diperingkat')}
          noun={t('wilayah tidak diperingkat')}
          total={total}
          paging={paged}
        />
      </div>
      <div className={styles.printOnly}>
        <p className={`kk-small ${styles.printExcerptNote}`}>
          {printExcerptNote(excerpt.length, total, t('wilayah tidak diperingkat'))}
        </p>
        <InsufficientTable
          rows={excerpt}
          caption={printCaption(excerpt.length, total, t('wilayah tidak diperingkat'))}
          labelOf={labelOf}
        />
      </div>
    </>
  );
}

export function InsufficientSection({ record }: { readonly record: CompositeEvidenceRecord }) {
  return (
    <Section
      id="paspor-tidak-diperingkat"
      title={t('Wilayah tidak diperingkat')}
      mode={record.source.dataMode}
    >
      {record.insufficient.length === 0 ? (
        <p className="kk-body">
          {t('Data Hub tidak melaporkan wilayah yang dikecualikan karena data tidak cukup pada hasil ini.')}
        </p>
      ) : (
        <>
          <p className="kk-body">
            {t(
              'Wilayah berikut tidak mendapat skor ataupun peringkat. Ini bukan skor nol: datanya tidak cukup untuk dihitung.',
            )}
          </p>
          <InsufficientList record={record} />
        </>
      )}
    </Section>
  );
}
