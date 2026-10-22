import type { CompositeIntegrity, CompositeIssue } from '@/domain/prioritization';
import type { DataHubRegionDTO, ExploratoryCompositeResultDTO } from '@/services/api';
import {
  compareWeights,
  directionLabel,
  excludedRegions,
  percentLabel,
  regionLabel,
  type IndicatorOption,
} from './labModel';
import type { DirectionCheck } from './useDirectionCheck';
import styles from './PriorityLab.module.css';

/** The integrity issues in full: message, and the regions concerned by name. */
export function IssueList({
  issues,
  registry,
}: {
  readonly issues: readonly CompositeIssue[];
  readonly registry: readonly DataHubRegionDTO[];
}) {
  return (
    <ul role="list" className={styles.issueList}>
      {issues.map((issue) => (
        <li key={issue.code}>
          {issue.message}
          {issue.examples && issue.examples.length > 0 && (
            <> Contoh: {issue.examples.map((id) => regionLabel(id, registry)).join(', ')}.</>
          )}{' '}
          <span className={styles.code}>[{issue.code}]</span>
        </li>
      ))}
    </ul>
  );
}

interface LabDetailsProps {
  readonly options: readonly IndicatorOption[];
  /** Criteria currently chosen, for the source list. */
  readonly chosenIds: readonly string[];
  readonly result: ExploratoryCompositeResultDTO | null;
  readonly integrity: CompositeIntegrity | null;
  readonly registry: readonly DataHubRegionDTO[];
  readonly checks: readonly DirectionCheck[] | null;
}

/**
 * Everything a careful reader may want to verify, closed by default: sources, the weights actually
 * used, who is left out and why, what was checked, and the record a Paspor Bukti will keep.
 */
export function LabDetails({ options, chosenIds, result, integrity, registry, checks }: LabDetailsProps) {
  const optionOf = (id: string) => options.find((option) => option.id === id);
  const labelOf = (id: string) => optionOf(id)?.label ?? id;
  const excluded = result ? excludedRegions(registry, result) : [];
  const comparison = result ? compareWeights(result) : [];

  return (
    <details className={`${styles.card} ${styles.details}`}>
      <summary className={styles.detailsSummary}>Sumber, metodologi &amp; pemeriksaan</summary>
      <div className={styles.detailsGrid}>
        <section aria-labelledby="lab-sumber">
          <h3 id="lab-sumber" className={styles.detailsHeading}>
            Sumber data
          </h3>
          <ul role="list" className={styles.sourceList}>
            {chosenIds.map((id) => {
              const option = optionOf(id);
              return (
                <li key={id}>
                  <span className={styles.sourceName}>{labelOf(id)}</span>
                  <span className={styles.muted}>
                    {option?.agency ?? 'Sumber tidak disebutkan'}
                    {option?.referenceYear != null && ` · ${String(option.referenceYear)}`}
                    {option && ` · ${option.unit} · ${directionLabel(option.polarity)}`}
                    {option?.coverageCount != null &&
                      option.totalRegions != null &&
                      ` · data untuk ${String(option.coverageCount)} dari ${String(option.totalRegions)} wilayah`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {result && (
          <section aria-labelledby="lab-bobot">
            <h3 id="lab-bobot" className={styles.detailsHeading}>
              Bobot pilihan dan bobot dipakai
            </h3>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>
                Bobot pilihan Anda dan bobot yang benar-benar dipakai
              </caption>
              <thead>
                <tr>
                  <th scope="col">Kriteria</th>
                  <th scope="col">Pilihan Anda</th>
                  <th scope="col">Dipakai</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{labelOf(row.id)}</th>
                    <td>{percentLabel(row.chosen)}</td>
                    <td>{row.used === null ? 'Tidak dipakai (tanpa data)' : percentLabel(row.used)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {excluded.length > 0 && (
          <section aria-labelledby="lab-keluar">
            <h3 id="lab-keluar" className={styles.detailsHeading}>
              {excluded.length} wilayah tidak ikut dihitung
            </h3>
            <p className={styles.muted}>
              Data Hub tidak menyertakannya, biasanya karena salah satu kriteria terpilih belum punya data
              untuk wilayah itu. Wilayah ini tidak diberi skor, bukan diberi skor nol.
            </p>
            <ul role="list" className={styles.excludedList}>
              {excluded.map((region) => (
                <li key={region.regionId}>{region.displayName}</li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="lab-metode">
          <h3 id="lab-metode" className={styles.detailsHeading}>
            Cara menghitung dan memeriksa
          </h3>
          <ul role="list" className={styles.methodList}>
            <li>
              Data Hub mengubah setiap kriteria ke skala 0–100 (100 = kondisi terbaik di antara wilayah yang
              dihitung). Skor gabungan = jumlah skor kriteria × bobot.
            </li>
            <li>
              Bobot dikirim sebagai bilangan bulat dengan total tepat 10.000 (= 100%). Kriteria tanpa data
              tidak dihitung; bobotnya dibagi ke kriteria lain.
            </li>
            {integrity && (
              <li>
                Diperiksa di peramban: total bobot, bobot yang dipakai, rentang 0–100, setiap skor sama dengan
                jumlah komponennya (selisih terbesar {integrity.maxScoreError.toFixed(3)}), urutan peringkat,
                dan tidak ada data kosong yang dihitung nol.
              </li>
            )}
            {checks?.map(({ indicatorId, verdict }) => (
              <li key={indicatorId}>
                Arah skor {labelOf(indicatorId)}:{' '}
                {verdict.status === 'consistent'
                  ? `sesuai data sumber (${String(verdict.checked)} wilayah)`
                  : verdict.status === 'unverifiable'
                    ? `belum dapat diperiksa — ${verdict.reason}`
                    : `tidak sesuai — ${verdict.reason}`}
              </li>
            ))}
          </ul>
          {integrity && integrity.issues.length > 0 && (
            <IssueList issues={integrity.issues} registry={registry} />
          )}
        </section>

        {result && integrity && (
          <section aria-labelledby="lab-catatan">
            <h3 id="lab-catatan" className={styles.detailsHeading}>
              Catatan perhitungan (bahan Paspor Bukti)
            </h3>
            <dl className={styles.record}>
              <div>
                <dt>Snapshot</dt>
                <dd>{result.snapshotId}</dd>
              </div>
              <div>
                <dt>Mode data</dt>
                <dd>{result.dataMode}</dd>
              </div>
              <div>
                <dt>Cakupan</dt>
                <dd>
                  {result.filterProvinceId ? `Provinsi ${result.filterProvinceId}` : 'Seluruh Indonesia'} ·{' '}
                  {result.items.length} wilayah dihitung
                </dd>
              </div>
              <div>
                <dt>Bobot dipakai</dt>
                <dd>
                  {Object.entries(integrity.weightsUsed)
                    .filter(([, bps]) => bps > 0)
                    .map(([id, bps]) => `${labelOf(id)} ${percentLabel(bps)}`)
                    .join(', ')}
                </dd>
              </div>
            </dl>
            <p className={styles.muted}>
              Paspor Bukti (segera hadir) akan menyimpan catatan ini. Hasil di halaman ini belum disimpan dan
              belum punya ID permanen.
            </p>
          </section>
        )}
      </div>
    </details>
  );
}
