import { ButtonLink } from '@/components/ui/Button/Button';
import {
  FRONTEND_MIN_REQUESTED_WEIGHT_PCT,
  type CompositeIntegrity,
  type CompositeIssue,
} from '@/domain/prioritization';
import { passportHref } from '@/features/evidence-passport';
import type { DataHubRegionDTO, ExploratoryCompositeResultDTO } from '@/services/api';
import {
  SCORE_MEANING,
  compareWeights,
  directionLabel,
  directionVerdictText,
  excludedRegions,
  indicatorCoverageText,
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
  /** The weights the calculation was REQUESTED with (integer bp, total 10 000): what a Paspor Bukti reproduces. */
  readonly requestedWeights: Readonly<Record<string, number>>;
  /**
   * The result passed every check (integrity, and in LIVE the direction check) and is not withheld, so a
   * Paspor Bukti may be made from it. False for a blocked, non-rankable or still-unchecked result.
   */
  readonly passportAllowed: boolean;
}

/**
 * Everything a careful reader may want to verify, closed by default: sources, the weights actually
 * used, who is left out and why, what was checked, and the record a Paspor Bukti will keep.
 */
export function LabDetails({
  options,
  chosenIds,
  result,
  integrity,
  registry,
  checks,
  requestedWeights,
  passportAllowed,
}: LabDetailsProps) {
  const optionOf = (id: string) => options.find((option) => option.id === id);
  const labelOf = (id: string) => optionOf(id)?.label ?? id;
  const excluded = result ? excludedRegions(registry, result) : [];
  const comparison = result ? compareWeights(result) : [];

  return (
    <section className={`glass glass--read ${styles.card} ${styles.details}`} aria-labelledby="lab-rincian">
      <h2 id="lab-rincian" className={styles.cardTitle}>
        Sumber, metodologi &amp; pemeriksaan
      </h2>
      <details className={styles.accordion}>
        <summary>Cara membaca skor</summary>
        <div className={styles.accordionBody}>
          <p className={styles.muted}>{SCORE_MEANING}</p>
          <ul role="list" className={styles.methodList}>
            <li>
              Data Hub mengubah setiap kriteria ke skala kebutuhan 0–100 (100 = kebutuhan tertinggi di antara
              wilayah yang dihitung; nilai mentah yang lebih baik memberi skor lebih rendah). Skor gabungan =
              jumlah skor kriteria × bobot wilayah itu. Peringkat 1 = prioritas tertinggi; peringkat dan
              peringkat nasional dipakai apa adanya dari Data Hub, termasuk peringkat yang sama untuk skor
              yang sama.
            </li>
            <li>
              Bobot dikirim sebagai bilangan bulat dengan total tepat 10.000 (= 100%). Kriteria tanpa data
              nasional tidak dihitung; bobotnya dibagi ke kriteria lain. Tiap wilayah punya bobot sendiri
              (total 10.000) atas kriteria yang datanya ada; wilayah berdata sebagian diberi tanda.
            </li>
          </ul>
        </div>
      </details>
      <details className={styles.accordion}>
        <summary>Data sebagian</summary>
        <div className={styles.accordionBody}>
          <ul role="list" className={styles.methodList}>
            <li>
              Dua ukuran cakupan yang berbeda: <strong>ketersediaan data nasional</strong> atas bobot pilihan
              Anda{' '}
              {integrity?.requestedWeightAvailabilityPct == null
                ? '(tidak dilaporkan)'
                : `(${integrity.requestedWeightAvailabilityPct.toFixed(0)}%)`}{' '}
              dan <strong>cakupan per wilayah</strong> (bagian bobot yang punya data di wilayah itu). Syarat
              minimal {String(FRONTEND_MIN_REQUESTED_WEIGHT_PCT)}% ketersediaan nasional adalah kebijakan
              antarmuka Nusa Matra, bukan aturan Data Hub.
            </li>
          </ul>
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
                    <th scope="col">Dipakai (bobot global)</th>
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
                Wilayah ini tidak tercantum di peringkat maupun di daftar “data belum cukup” dari Data Hub.
                Mereka tidak diberi skor, bukan diberi skor nol.
              </p>
              <ul role="list" className={styles.excludedList}>
                {excluded.map((region) => (
                  <li key={region.regionId}>{region.displayName}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </details>
      <details className={styles.accordion}>
        <summary>Sumber data</summary>
        <div className={styles.accordionBody}>
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
                      {option &&
                        indicatorCoverageText(option) !== null &&
                        ` · data untuk ${indicatorCoverageText(option) ?? ''}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </details>
      <details className={styles.accordion}>
        <summary>Pemeriksaan konsistensi</summary>
        <div className={styles.accordionBody}>
          <ul role="list" className={styles.methodList}>
            {integrity && (
              <li>
                Diperiksa di peramban: total bobot, bobot yang dipakai, arah skor, rentang 0–100, setiap skor
                sama dengan jumlah komponennya menurut bobot wilayahnya (selisih terbesar{' '}
                {integrity.maxScoreError.toFixed(3)}, batas pembulatan 0,01 + 0,005 per komponen), urutan
                peringkat dan peringkat nasional, ambang cakupan, dan tidak ada data kosong yang dihitung nol.
              </li>
            )}
            {checks?.map(({ indicatorId, verdict }) => (
              <li key={indicatorId}>
                Arah skor {labelOf(indicatorId)}:{' '}
                {directionVerdictText(verdict, (regionId) => regionLabel(regionId, registry))}
              </li>
            ))}
          </ul>

          {integrity && integrity.issues.length > 0 && (
            <IssueList issues={integrity.issues} registry={registry} />
          )}
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
                  <dt>Arah skor</dt>
                  <dd>
                    {result.scoreDirection === 'higher_is_need'
                      ? 'Skor tinggi = kebutuhan intervensi tinggi (peringkat 1 = prioritas tertinggi)'
                      : 'Tidak dinyatakan Data Hub'}
                  </dd>
                </div>
                <div>
                  <dt>Layak nasional</dt>
                  <dd>
                    {result.totalEligibleNational === null
                      ? 'Tidak dilaporkan'
                      : `${String(result.totalEligibleNational)} wilayah (di Data Hub); ${String(result.items.length)} diperingkat di tampilan ini`}
                    {result.insufficient.length > 0 &&
                      ` · ${String(result.insufficient.length)} data belum cukup`}
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
              {passportAllowed ? (
                <p className={styles.passportCta}>
                  <ButtonLink
                    variant="secondary"
                    to={passportHref({
                      kind: 'lab',
                      weights: requestedWeights,
                      provinceId: result.filterProvinceId,
                      mode: result.dataMode,
                      snapshotId: result.snapshotId,
                    })}
                  >
                    Buat Paspor Bukti
                  </ButtonLink>
                </p>
              ) : (
                <p className={styles.muted}>Paspor Bukti tidak dibuat karena peringkat ditahan.</p>
              )}
            </section>
          )}
        </div>
      </details>
    </section>
  );
}
