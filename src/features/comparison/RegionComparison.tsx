import type { ReactNode } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button, ButtonLink } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import { describeUnit, readComparison, type DisplayUnit } from '@/domain/indicators';
import {
  ResourceView,
  categoryLabel,
  formatDecimalId,
  publicHttpUrl,
  useDataHub,
  useDataHubResource,
  type ResourceState,
} from '@/features/data-hub';
import { passportHref } from '@/features/evidence-passport';
import type { DataHubIndicatorDTO, IndicatorCatalogDTO, RegionProfileDTO } from '@/services/api';
import { buildComparisonRows, type ComparisonRow, type ComparisonSide } from './comparisonRows';
import { describeQualityFlag } from './qualityFlag';
import { RegionPicker } from './RegionPicker';
import { useComparisonParams } from './comparisonParams';
import styles from './RegionComparison.module.css';

const SIMILAR_RATIO = 1.05;
const DATA_QUALITY_SECTION = 'Metrik kualitas data';

/**
 * `summary` (Bandingkan): pickers and a short table, each row only the indicator, both values, the
 * difference and which side is better. `detail` (its "Selengkapnya" page): the same pair with the
 * years, sources, explanations and the reasons a row is not compared.
 */
export type ComparisonView = 'summary' | 'detail';

/** The full-detail page of a pair; the same `?a=&b=` as Bandingkan. */
export const COMPARISON_DETAIL_PATH = '/bandingkan/rincian';
const COMPARISON_PATH = '/bandingkan';

function pairHref(path: string, a: string, b: string): string {
  return `${path}?${new URLSearchParams({ a, b }).toString()}`;
}

interface RegionComparisonProps {
  readonly view?: ComparisonView;
  /** Slot under the result for a follow-up action (for example a link to the evidence passport). */
  readonly footerSlot?: ReactNode;
}

/** Bandingkan: two real regions, indicator by indicator, comparing only what is comparable. */
export function RegionComparison({ view = 'summary', footerSlot }: RegionComparisonProps) {
  const { a, b, setA, setB, swap } = useComparisonParams();

  return (
    <div className={styles.comparison}>
      {view === 'summary' && (
        <div className={styles.pickers}>
          <RegionPicker slot="Wilayah A" selectedCode={a} onSelect={setA} excludeCode={b} />
          <Button variant="secondary" onClick={swap} disabled={a === null && b === null}>
            Tukar wilayah
          </Button>
          <RegionPicker slot="Wilayah B" selectedCode={b} onSelect={setB} excludeCode={a} />
        </div>
      )}
      {a !== null && b !== null ? (
        a === b ? (
          <StatusMessage kind="info" title="Pilih dua wilayah yang berbeda">
            Wilayah A dan B sama, jadi tidak ada yang dibandingkan.
          </StatusMessage>
        ) : (
          <ComparisonTable codeA={a} codeB={b} view={view} />
        )
      ) : (
        <StatusMessage
          kind="empty"
          title="Pilih dua wilayah"
          action={
            view === 'detail' ? (
              <ButtonLink to={COMPARISON_PATH} variant="secondary">
                Pilih di Bandingkan
              </ButtonLink>
            ) : undefined
          }
        >
          Cari dan pilih Wilayah A dan Wilayah B untuk melihat perbandingan indikatornya.
        </StatusMessage>
      )}
      {a !== null && b !== null && a !== b ? footerSlot : null}
    </div>
  );
}

function ComparisonTable({
  codeA,
  codeB,
  view,
}: {
  readonly codeA: string;
  readonly codeB: string;
  readonly view: ComparisonView;
}) {
  const profileA = useDataHubResource(`profile|${codeA}`, (repository, dataMode, signal) =>
    repository.getRegionDetail({ dataMode, regionId: codeA, signal }),
  );
  const profileB = useDataHubResource(`profile|${codeB}`, (repository, dataMode, signal) =>
    repository.getRegionDetail({ dataMode, regionId: codeB, signal }),
  );

  // Polarity and definitions come from the catalog; without it nothing is called better or worse.
  const catalog = useDataHubResource('catalog', (repository, dataMode, signal) =>
    repository.getIndicatorCatalog({ dataMode, signal }),
  );

  if (profileA.state.status === 'success' && profileB.state.status === 'success') {
    return (
      <ComparisonResult
        a={profileA.state.data.data}
        b={profileB.state.data.data}
        catalog={catalog.state}
        onRetryCatalog={catalog.retry}
        view={view}
      />
    );
  }

  // Each region reports its own state, so a failure says which region failed and can be retried alone.
  return (
    <div className={styles.slotStates}>
      <RegionSlotState slot="Wilayah A" state={profileA.state} onRetry={profileA.retry} />
      <RegionSlotState slot="Wilayah B" state={profileB.state} onRetry={profileB.retry} />
    </div>
  );
}

function RegionSlotState({
  slot,
  state,
  onRetry,
}: {
  readonly slot: string;
  readonly state: ResourceState<{ readonly data: RegionProfileDTO }>;
  readonly onRetry: () => void;
}) {
  return (
    <div role="group" aria-label={`Status ${slot}`}>
      <ResourceView state={state} onRetry={onRetry} loadingTitle={`Memuat ${slot}…`}>
        {(envelope) => (
          <p className="kk-small" role="status">
            {slot}: {envelope.data.region.displayName} sudah dimuat. Perbandingan menunggu kedua wilayah.
          </p>
        )}
      </ResourceView>
    </div>
  );
}

function shortName(profile: RegionProfileDTO): string {
  return profile.region.shortName ?? profile.region.displayName;
}

function ComparisonResult({
  a,
  b,
  catalog,
  onRetryCatalog,
  view,
}: {
  readonly a: RegionProfileDTO;
  readonly b: RegionProfileDTO;
  readonly catalog: ResourceState<{ readonly data: IndicatorCatalogDTO }>;
  readonly onRetryCatalog: () => void;
  readonly view: ComparisonView;
}) {
  const { dataMode } = useDataHub();
  const rows = buildComparisonRows(a, b);
  if (rows.length === 0) {
    return (
      <StatusMessage kind="empty" title="Belum ada data indikator untuk dibandingkan">
        Data Hub belum memuat indikator untuk {a.region.displayName} maupun {b.region.displayName} pada
        snapshot ini.
      </StatusMessage>
    );
  }
  const definitions = catalog.status === 'success' ? catalog.data.data : null;
  const regionalRows = rows.filter((row) => row.kind === 'regional');
  const qualityRows = rows.filter((row) => row.kind === 'data_quality');
  const comparable = regionalRows.filter((row) => row.assessment.allowed).length;
  const blocked = regionalRows.length - comparable;
  const groups = groupByCategory(regionalRows);
  const snapshotsDiffer = a.snapshotId !== b.snapshotId || a.dataMode !== b.dataMode;

  return (
    <Surface radius="card" reading className={styles.result}>
      <h2 className="kk-h3">
        {a.region.displayName} dan {b.region.displayName}
      </h2>
      {dataMode === 'DEMO' && (
        <div className={styles.context}>
          <Chip tone="warning">DEMO · simulasi, bukan observasi resmi</Chip>
        </div>
      )}
      {snapshotsDiffer && (
        <p className={`kk-small ${styles.warning}`} role="alert">
          Data kedua wilayah berasal dari versi data yang berbeda. Muat ulang sebelum membandingkan.
        </p>
      )}
      {view === 'summary' ? (
        <p className="kk-body" role="status">
          Dari {regionalRows.length} indikator wilayah, {comparable} dapat dibandingkan
          {blocked > 0 ? ` dan ${String(blocked)} tidak.` : '.'} Angka lebih tinggi tidak selalu berarti lebih
          baik.
        </p>
      ) : (
        <p className="kk-body" role="status">
          Dari {regionalRows.length} indikator wilayah, {comparable} dapat dibandingkan
          {blocked > 0
            ? ` dan ${String(blocked)} tidak dibandingkan karena data kosong, tahun, satuan atau definisi berbeda, sumber tidak diketahui, atau nilai diimputasi.`
            : '.'}{' '}
          Angka yang lebih tinggi tidak selalu berarti lebih baik; arahnya mengikuti definisi tiap indikator.
          Selisih menunjukkan perbedaan angka yang teramati, bukan penyebabnya.
        </p>
      )}
      <CatalogNote catalog={catalog} onRetry={onRetryCatalog} />
      <ResultActions a={a} b={b} snapshotsDiffer={snapshotsDiffer} view={view} />
      {catalog.status === 'success' && (
        <p className={`kk-small ${styles.legend}`}>
          <span data-outcome="better">Hijau: kondisi lebih baik</span>
          <span data-outcome="worse">Merah: kondisi kurang baik</span>
          <span>Biru: arah baik atau buruk belum ditetapkan</span>
        </p>
      )}
      {/* Scrolls sideways on narrow screens; focusable so the keyboard can scroll it too. */}
      <div
        className={styles.scroll}
        // A scrollable region must take focus to scroll without a pointer (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="region"
        aria-label={`Tabel perbandingan ${shortName(a)} dan ${shortName(b)}, dapat digeser`}
      >
        <table className={styles.table} data-view={view}>
          <caption className="visually-hidden">
            Perbandingan indikator {a.region.displayName} dan {b.region.displayName}
          </caption>
          {/* Fixed column widths: every indicator group lines up under the same four columns. */}
          <colgroup>
            <col style={{ width: '34%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '26%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{view === 'summary' ? 'Indikator' : 'Indikator · tahun · sumber'}</th>
              <th scope="col">{shortName(a)}</th>
              <th scope="col">{shortName(b)}</th>
              <th scope="col">Hasil</th>
            </tr>
          </thead>
          {groups.map(([category, items]) => (
            <IndicatorGroup
              key={category}
              title={categoryLabel(category)}
              rows={items}
              a={a}
              b={b}
              definitions={definitions}
              view={view}
            />
          ))}
          {qualityRows.length > 0 && (
            <IndicatorGroup
              title={DATA_QUALITY_SECTION}
              rows={qualityRows}
              a={a}
              b={b}
              definitions={definitions}
              view={view}
            />
          )}
        </table>
      </div>
    </Surface>
  );
}

/**
 * Above the table, where it is seen first: the way to the other view (the full detail, or back to
 * the summary) and the evidence passport of exactly this pair. Mode and snapshot come from the
 * fetched profiles, and only when both agree: a passport must describe one consistent snapshot.
 */
function ResultActions({
  a,
  b,
  snapshotsDiffer,
  view,
}: {
  readonly a: RegionProfileDTO;
  readonly b: RegionProfileDTO;
  readonly snapshotsDiffer: boolean;
  readonly view: ComparisonView;
}) {
  const pair = [a.region.regionId, b.region.regionId] as const;
  return (
    <div className={styles.actions}>
      {view === 'summary' ? (
        <ButtonLink to={pairHref(COMPARISON_DETAIL_PATH, ...pair)} variant="secondary">
          Selengkapnya
        </ButtonLink>
      ) : (
        <ButtonLink to={pairHref(COMPARISON_PATH, ...pair)} variant="secondary">
          Kembali ke ringkasan
        </ButtonLink>
      )}
      {snapshotsDiffer ? (
        <p className={`kk-small ${styles.muted}`}>
          Paspor Bukti belum bisa dibuat karena kedua wilayah berasal dari snapshot atau mode berbeda.
        </p>
      ) : (
        <ButtonLink
          to={passportHref({
            kind: 'bandingkan',
            regionA: a.region.regionId,
            regionB: b.region.regionId,
            mode: a.dataMode,
            snapshotId: a.snapshotId,
          })}
        >
          Buat Paspor Bukti
        </ButtonLink>
      )}
    </div>
  );
}

function CatalogNote({
  catalog,
  onRetry,
}: {
  readonly catalog: ResourceState<unknown>;
  readonly onRetry: () => void;
}) {
  if (catalog.status === 'loading') {
    return (
      <p className={`kk-small ${styles.muted}`} role="status">
        Memuat arah baik atau buruk tiap indikator. Penilaian lebih baik atau lebih buruk ditahan sampai
        selesai.
      </p>
    );
  }
  if (catalog.status === 'error' || catalog.status === 'unconfigured') {
    return (
      <div className={styles.catalogError} role="alert">
        <span className="kk-small">
          Katalog indikator tidak dapat dimuat, jadi tidak ada wilayah yang dinilai lebih baik. Nilai dan
          selisih tetap ditampilkan.
        </span>
        {catalog.status === 'error' && (
          <Button variant="secondary" onClick={onRetry}>
            Coba muat katalog lagi
          </Button>
        )}
      </div>
    );
  }
  return null;
}

function groupByCategory(
  rows: readonly ComparisonRow[],
): readonly (readonly [string, readonly ComparisonRow[]])[] {
  const groups = new Map<string, ComparisonRow[]>();
  for (const row of rows) {
    const group = groups.get(row.category) ?? [];
    group.push(row);
    groups.set(row.category, group);
  }
  return [...groups.entries()];
}

function IndicatorGroup({
  title,
  rows,
  a,
  b,
  definitions,
  view,
}: {
  readonly title: string;
  readonly rows: readonly ComparisonRow[];
  readonly a: RegionProfileDTO;
  readonly b: RegionProfileDTO;
  readonly definitions: IndicatorCatalogDTO | null;
  readonly view: ComparisonView;
}) {
  return (
    <tbody>
      <tr>
        <th scope="colgroup" colSpan={4} className={styles.group}>
          {title}
        </th>
      </tr>
      {rows.map((row) => (
        <IndicatorRow
          key={row.indicatorId}
          row={row}
          nameA={shortName(a)}
          nameB={shortName(b)}
          definition={definitions?.items.find((item) => item.indicatorId === row.indicatorId)}
          directionKnown={definitions !== null}
          view={view}
        />
      ))}
    </tbody>
  );
}

function observedMax(row: ComparisonRow, definition: DataHubIndicatorDTO | undefined): number | null {
  const candidates = [definition?.stats?.max ?? null, row.a?.decimal ?? null, row.b?.decimal ?? null]
    .map((value) => (value === null ? Number.NaN : Number(value)))
    .filter((value) => Number.isFinite(value));
  return candidates.length === 0 ? null : Math.max(...candidates);
}

function IndicatorRow({
  row,
  nameA,
  nameB,
  definition,
  directionKnown,
  view,
}: {
  readonly row: ComparisonRow;
  readonly nameA: string;
  readonly nameB: string;
  readonly definition: DataHubIndicatorDTO | undefined;
  /** False while the catalog is missing: no better/worse reading is built then. */
  readonly directionKnown: boolean;
  /** `summary` keeps the name, values, difference and verdict; the rest is on the detail page. */
  readonly view: ComparisonView;
}) {
  const detailed = view === 'detail';
  const { assessment } = row;
  const isRegional = row.kind === 'regional';
  const unit = describeUnit(row.unit, observedMax(row, definition));
  const useRatio = unit.kind !== 'years' && unit.kind !== 'other';
  const reading =
    isRegional && directionKnown
      ? readComparison({
          indicatorLabel: row.label,
          polarity: definition?.polarity ?? 'unknown',
          nameA,
          nameB,
          assessment,
          unitLabel: unit.label,
          useRatio,
          formatNumber: (value, digits) => formatDecimalId(value.toFixed(digits)),
        })
      : null;
  const showBars = isRegional && assessment.allowed && hasOnlyNonNegative(row);
  const peak = showBars ? Math.max(Number(row.a?.decimal), Number(row.b?.decimal)) : null;
  const [outcomeA, outcomeB] = sideOutcomes(reading?.verdict);

  return (
    <tr data-blocked={assessment.allowed || !isRegional ? undefined : true}>
      <th scope="row" className={styles.indicator}>
        <span className="kk-body-strong">{row.label}</span>
        {detailed && <SourceLine row={row} />}
      </th>
      <td data-label={nameA}>
        <ValueCell side={row.a} unit={unit} peak={peak} tone="a" showFlag={detailed} outcome={outcomeA} />
      </td>
      <td data-label={nameB}>
        <ValueCell side={row.b} unit={unit} peak={peak} tone="b" showFlag={detailed} outcome={outcomeB} />
      </td>
      <td className={styles.difference} data-label="Hasil">
        {!isRegional ? (
          <>
            <span className="kk-body-strong">{NOT_DETERMINED}</span>
            {detailed && (
              <span className={`kk-small ${styles.muted}`}>
                Metrik ini menilai kelengkapan atau kesegaran data, bukan kondisi wilayah, jadi tanpa selisih
                dan tanpa penilaian lebih baik atau buruk.
              </span>
            )}
          </>
        ) : assessment.allowed ? (
          <>
            <span className="kk-body-strong">{describeDifference(row, nameA, nameB, unit, useRatio)}</span>
            {detailed && reading && <span className={`kk-small ${styles.muted}`}>{reading.sentence}</span>}
            {detailed && unit.warning && <span className={`kk-small ${styles.warning}`}>{unit.warning}</span>}
          </>
        ) : (
          <>
            <span className="kk-body-strong">{NOT_DETERMINED}</span>
            {detailed && (
              <ul role="list" className={`kk-small ${styles.reasons}`}>
                {assessment.blockers.map((blocker) => (
                  <li key={blocker.code}>{blocker.message}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

/** Bars scale each value against the larger one, which only reads right for non-negative figures. */
function hasOnlyNonNegative(row: ComparisonRow): boolean {
  return [row.a, row.b].every((side) => side?.decimal != null && Number(side.decimal) >= 0);
}

function yearOf(side: ComparisonSide | null): string {
  return side?.referenceYear == null ? '—' : String(side.referenceYear);
}

function describeProvenance(row: ComparisonRow): string {
  // The Data Hub's "UNKNOWN_AGENCY" placeholder is not a source name; it is not shown as one.
  const agencies = [
    ...new Set([row.a, row.b].flatMap((side) => (side?.provenanceKnown ? [side.agencyCode] : []))),
  ];
  const source = agencies.join(', ') || 'sumber tidak diketahui';
  const sameYear = yearOf(row.a) === yearOf(row.b);
  const years = sameYear ? yearOf(row.a) : `A ${yearOf(row.a)} · B ${yearOf(row.b)}`;
  return `${years} · ${source}`;
}

/**
 * One line: years · agency · dataset · link, separated by " · " in the text itself, so it reads right
 * whatever the layout (desktop column, mobile card) and for screen readers.
 */
function SourceLine({ row }: { readonly row: ComparisonRow }) {
  const sides = [row.a, row.b].flatMap((side) => (side ? [side] : []));
  if (sides.some((side) => !side.provenanceKnown)) {
    return (
      <span className={`kk-small ${styles.warning}`}>
        {describeProvenance(row)} · Dataset sumber tidak diketahui.
      </span>
    );
  }
  const datasets = [...new Set(sides.map((side) => side.datasetId))];
  const href = publicHttpUrl(
    sides.find((side) => publicHttpUrl(side.officialUrl) !== null)?.officialUrl ?? null,
  );
  return (
    <span className={`kk-small ${styles.muted}`}>
      {describeProvenance(row)} · Dataset {datasets.join(', ') || '—'} ·{' '}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer noopener">
          Sumber resmi
        </a>
      ) : (
        'tautan sumber tidak tersedia'
      )}
    </span>
  );
}

/** A side's condition on one indicator: better, worse, or not judged (`null`). */
type SideOutcome = 'better' | 'worse' | null;

/** Turns the comparison verdict into each side's outcome, coloured on its bar. */
function sideOutcomes(
  verdict: 'A_BETTER' | 'B_BETTER' | 'EQUAL' | 'NO_JUDGEMENT' | undefined,
): readonly [SideOutcome, SideOutcome] {
  if (verdict === 'A_BETTER') return ['better', 'worse'];
  if (verdict === 'B_BETTER') return ['worse', 'better'];
  return [null, null];
}

/** Said for a row whose figures cannot be compared yet (missing data, other year, unit, source). */
const NOT_DETERMINED = 'Untuk sementara hasil belum dapat ditentukan';

function describeDifference(
  row: ComparisonRow,
  nameA: string,
  nameB: string,
  unit: DisplayUnit,
  useRatio: boolean,
): string {
  const { difference } = row.assessment;
  if (!difference) return '';
  if (difference.higher === 'EQUAL') return 'Sama';
  const higherName = difference.higher === 'A' ? nameA : nameB;
  if (useRatio && difference.ratio !== null && difference.ratio >= SIMILAR_RATIO) {
    return `${higherName} ${formatDecimalId(difference.ratio.toFixed(1))}× lebih tinggi`;
  }
  const gap = formatDecimalId(Math.abs(difference.absolute).toFixed(2));
  return difference.ratio !== null && difference.ratio < SIMILAR_RATIO
    ? `Hampir sama (selisih ${gap} ${unit.label})`.trim()
    : `${higherName} lebih tinggi ${gap} ${unit.label}`.trim();
}

function ValueCell({
  side,
  unit,
  peak,
  tone,
  showFlag,
  outcome,
}: {
  readonly side: ComparisonSide | null;
  readonly unit: DisplayUnit;
  /** Larger of the two values when bars are drawn; `null` otherwise. */
  readonly peak: number | null;
  readonly tone: 'a' | 'b';
  /** The value's quality label (verified, imputed, derived); shown on the detail page. */
  readonly showFlag: boolean;
  /** Whether this side is in the better or worse condition, when the indicator's direction is known. */
  readonly outcome: SideOutcome;
}) {
  if (side === null || side.decimal === null) {
    return (
      <span className={`kk-small ${styles.muted}`}>
        {side?.valueStatus === 'SUPPRESSED'
          ? 'Nilai tidak dipublikasikan oleh sumber'
          : 'Data belum tersedia'}
      </span>
    );
  }
  const share = peak !== null && peak > 0 ? Math.min(100, (Number(side.decimal) / peak) * 100) : null;
  const flag = showFlag ? describeQualityFlag(side.qualityFlag) : null;
  return (
    <span className={styles.value}>
      {share !== null && (
        <span className={styles.track} aria-hidden="true">
          <span
            className={styles.bar}
            data-tone={tone}
            data-outcome={outcome ?? undefined}
            style={{ width: `${String(share)}%` }}
          />
        </span>
      )}
      <span className="kk-body-strong">
        {formatDecimalId(side.decimal)}
        {unit.label ? <span className={`kk-small ${styles.muted}`}> {unit.label}</span> : null}
        {outcome && (
          <span className="visually-hidden">
            {outcome === 'better' ? ', kondisi lebih baik' : ', kondisi kurang baik'}
          </span>
        )}
      </span>
      {flag && (
        <span className={`kk-small ${flag.caution ? styles.cautionFlag : styles.muted}`}>{flag.label}</span>
      )}
    </span>
  );
}
