import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import { ResourceView, categoryLabel, formatDecimalId, useDataHubResource } from '@/features/data-hub';
import type { RegionProfileDTO } from '@/services/api';
import { buildComparisonRows, type ComparisonRow, type ComparisonSide } from './comparisonRows';
import { RegionPicker } from './RegionPicker';
import { useComparisonParams } from './comparisonParams';
import styles from './RegionComparison.module.css';

const SIMILAR_RATIO = 1.05;

/** Bandingkan: two real regions, indicator by indicator, comparing only what is comparable. */
export function RegionComparison() {
  const { a, b, setA, setB, swap } = useComparisonParams();

  return (
    <div className={styles.comparison}>
      <div className={styles.pickers}>
        <RegionPicker slot="Wilayah A" selectedCode={a} onSelect={setA} />
        <Button variant="secondary" onClick={swap} disabled={a === null && b === null}>
          Tukar wilayah
        </Button>
        <RegionPicker slot="Wilayah B" selectedCode={b} onSelect={setB} />
      </div>
      {a !== null && b !== null ? (
        a === b ? (
          <StatusMessage kind="info" title="Pilih dua wilayah yang berbeda">
            Wilayah A dan B sama, jadi tidak ada yang dibandingkan.
          </StatusMessage>
        ) : (
          <ComparisonTable codeA={a} codeB={b} />
        )
      ) : (
        <StatusMessage kind="empty" title="Pilih dua wilayah">
          Cari dan pilih Wilayah A dan Wilayah B untuk melihat perbandingan indikatornya.
        </StatusMessage>
      )}
    </div>
  );
}

function ComparisonTable({ codeA, codeB }: { readonly codeA: string; readonly codeB: string }) {
  const profileA = useDataHubResource(`profile|${codeA}`, (repository, dataMode, signal) =>
    repository.getRegionDetail({ dataMode, regionId: codeA, signal }),
  );
  const profileB = useDataHubResource(`profile|${codeB}`, (repository, dataMode, signal) =>
    repository.getRegionDetail({ dataMode, regionId: codeB, signal }),
  );

  return (
    <ResourceView state={profileA.state} onRetry={profileA.retry} loadingTitle="Memuat Wilayah A…">
      {(envelopeA) => (
        <ResourceView state={profileB.state} onRetry={profileB.retry} loadingTitle="Memuat Wilayah B…">
          {(envelopeB) => <ComparisonResult a={envelopeA.data} b={envelopeB.data} />}
        </ResourceView>
      )}
    </ResourceView>
  );
}

function shortName(profile: RegionProfileDTO): string {
  return profile.region.shortName ?? profile.region.displayName;
}

function ComparisonResult({ a, b }: { readonly a: RegionProfileDTO; readonly b: RegionProfileDTO }) {
  const rows = buildComparisonRows(a, b);
  if (rows.length === 0) {
    return (
      <StatusMessage kind="empty" title="Belum ada data indikator untuk dibandingkan">
        Data Hub belum memuat indikator untuk {a.region.displayName} maupun {b.region.displayName} pada
        snapshot ini.
      </StatusMessage>
    );
  }
  const comparable = rows.filter((row) => row.assessment.allowed);
  const blocked = rows.length - comparable.length;
  const groups = groupByCategory(rows);

  return (
    <Surface radius="card" className={styles.result}>
      <h2 className="kk-h3">
        {a.region.displayName} dan {b.region.displayName}
      </h2>
      <p className="kk-body" role="status">
        Dari {rows.length} indikator, {comparable.length} dapat dibandingkan
        {blocked > 0
          ? ` dan ${String(blocked)} tidak dibandingkan karena data kosong, satuan atau definisi berbeda, atau nilai diimputasi.`
          : '.'}{' '}
        Angka yang lebih tinggi tidak selalu berarti lebih baik: itu bergantung pada indikatornya.
      </p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="visually-hidden">
            Perbandingan indikator {a.region.displayName} dan {b.region.displayName}
          </caption>
          <thead>
            <tr>
              <th scope="col">Indikator · tahun · sumber</th>
              <th scope="col">{shortName(a)}</th>
              <th scope="col">{shortName(b)}</th>
              <th scope="col">Perbedaan</th>
            </tr>
          </thead>
          {groups.map(([category, items]) => (
            <tbody key={category}>
              <tr>
                <th scope="colgroup" colSpan={4} className={styles.group}>
                  {categoryLabel(category)}
                </th>
              </tr>
              {items.map((row) => (
                <IndicatorRow key={row.indicatorId} row={row} nameA={shortName(a)} nameB={shortName(b)} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Surface>
  );
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

function IndicatorRow({
  row,
  nameA,
  nameB,
}: {
  readonly row: ComparisonRow;
  readonly nameA: string;
  readonly nameB: string;
}) {
  const { assessment } = row;
  const peak = Math.max(Number(row.a?.decimal ?? 0), Number(row.b?.decimal ?? 0));

  return (
    <tr data-blocked={assessment.allowed ? undefined : true}>
      <th scope="row" className={styles.indicator}>
        <span className="kk-body-strong">{row.label}</span>
        <span className={`kk-small ${styles.muted}`}>{describeProvenance(row)}</span>
      </th>
      <td>
        <ValueCell side={row.a} unit={row.unit} peak={assessment.allowed ? peak : null} tone="a" />
      </td>
      <td>
        <ValueCell side={row.b} unit={row.unit} peak={assessment.allowed ? peak : null} tone="b" />
      </td>
      <td className={styles.difference}>
        {assessment.allowed ? (
          <span className="kk-body-strong">{describeDifference(row, nameA, nameB)}</span>
        ) : (
          <>
            <span className="kk-body-strong">Tidak dibandingkan</span>
            <ul role="list" className={`kk-small ${styles.reasons}`}>
              {assessment.blockers.map((blocker) => (
                <li key={blocker.code}>{blocker.message}</li>
              ))}
            </ul>
          </>
        )}
        {assessment.warnings.map((warning) => (
          <span key={warning.code} className={`kk-small ${styles.warning}`}>
            {warning.message}
          </span>
        ))}
      </td>
    </tr>
  );
}

function describeProvenance(row: ComparisonRow): string {
  const years = [row.a, row.b].map((side) =>
    (side?.referenceYear ?? null) === null ? '—' : String(side?.referenceYear),
  );
  const agencies = [...new Set([row.a, row.b].flatMap((side) => (side ? [side.agencyCode] : [])))];
  return `${years.join(' · ')} · ${agencies.join(', ') || 'sumber tidak diketahui'}`;
}

function describeDifference(row: ComparisonRow, nameA: string, nameB: string): string {
  const { difference } = row.assessment;
  if (!difference) return '';
  if (difference.higher === 'EQUAL') return 'Sama';
  const higherName = difference.higher === 'A' ? nameA : nameB;
  if (difference.ratio !== null && difference.ratio >= SIMILAR_RATIO) {
    return `${higherName} ${formatDecimalId(difference.ratio.toFixed(1))}× lebih tinggi`;
  }
  const gap = formatDecimalId(Math.abs(difference.absolute).toFixed(2));
  return difference.ratio !== null
    ? `Hampir sama (selisih ${gap} ${row.unit})`
    : `${higherName} lebih tinggi ${gap} ${row.unit}`;
}

function ValueCell({
  side,
  unit,
  peak,
  tone,
}: {
  readonly side: ComparisonSide | null;
  readonly unit: string;
  /** Larger of the two values when the pair is comparable (bars are drawn then); `null` otherwise. */
  readonly peak: number | null;
  readonly tone: 'a' | 'b';
}) {
  if (side === null || side.decimal === null) {
    return <span className={`kk-small ${styles.muted}`}>Data belum tersedia</span>;
  }
  const share = peak !== null && peak > 0 ? Math.min(100, (Number(side.decimal) / peak) * 100) : null;
  return (
    <span className={styles.value}>
      {share !== null && (
        <span className={styles.track} aria-hidden="true">
          <span className={styles.bar} data-tone={tone} style={{ width: `${String(share)}%` }} />
        </span>
      )}
      <span className="kk-body-strong">
        {formatDecimalId(side.decimal)}
        {unit ? <span className={`kk-small ${styles.muted}`}> {unit}</span> : null}
      </span>
    </span>
  );
}
