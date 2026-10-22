import { useCallback, useEffect, useId, useState } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import { assessCompositeIntegrity, type CompositeIntegrity } from '@/domain/prioritization';
import { ResourceView, formatDecimalId, useDataHub, useDataHubResource } from '@/features/data-hub';
import {
  INDONESIAN_ERROR_COPY,
  type DataHubRegionDTO,
  type ExploratoryCompositeResultDTO,
  type ExploratoryRegionRankDTO,
} from '@/services/api';
import { integrityInputFromResult } from './compositeCheck';
import { weightsKey } from './criteria';
import {
  compareWeights,
  contributions,
  excludedRegions,
  percentLabel,
  rankMovement,
  type IndicatorOption,
} from './labModel';
import { useDirectionCheck, type DirectionCheck } from './useDirectionCheck';
import styles from './PriorityLab.module.css';

const PAGE_SIZE = 10;

/** The last result shown and the one before it; kept while new weights are calculated. */
interface ShownHistory {
  readonly current: ExploratoryCompositeResultDTO | null;
  readonly previous: ExploratoryCompositeResultDTO | null;
}

interface RankingResultsProps {
  readonly weights: Readonly<Record<string, number>>;
  readonly isSettling: boolean;
  readonly provinceId: string | null;
  readonly registry: readonly DataHubRegionDTO[];
  readonly options: readonly IndicatorOption[];
}

/** Runs the Data Hub's composite query for the settled weights and shows only what checks out. */
export function RankingResults({ weights, isSettling, provinceId, registry, options }: RankingResultsProps) {
  const { dataMode } = useDataHub();
  const ready = Object.keys(weights).length > 0;
  // The last result shown, kept while new weights are calculated, so rank moves can be described.
  const [history, setHistory] = useState<ShownHistory>({ current: null, previous: null });
  const recordShown = useCallback((result: ExploratoryCompositeResultDTO) => {
    setHistory((before) =>
      before.current === result ? before : { current: result, previous: before.current },
    );
  }, []);
  const ranking = useDataHubResource(
    `${weightsKey(weights)}|${provinceId ?? 'all'}`,
    (repository, mode, signal) =>
      repository.runExploratoryCompositeQuery({
        dataMode: mode,
        criteria: Object.entries(weights).map(([indicatorId, basisPoints]) => ({ indicatorId, basisPoints })),
        filterProvinceId: provinceId,
        signal,
      }),
    ready,
  );

  return (
    <Surface radius="card" className={styles.panel} aria-busy={isSettling}>
      <div className={styles.titleRow}>
        <h2 className="kk-h3">Hasil peringkat</h2>
        <Chip tone="warning">
          {dataMode === 'DEMO'
            ? 'Pratinjau Simulasi DEMO (Tanpa Run ID Imutabel)'
            : 'Data resmi LIVE · pratinjau, belum disimpan'}
        </Chip>
      </div>
      {dataMode === 'DEMO' && (
        <p className="kk-body-strong">{INDONESIAN_ERROR_COPY['data.demo_disclaimer']}</p>
      )}
      {!ready ? (
        <StatusMessage kind="empty" title="Belum ada kriteria">
          Pilih minimal satu kriteria berdata untuk menghitung peringkat.
        </StatusMessage>
      ) : isSettling ? (
        <StatusMessage kind="loading" title={INDONESIAN_ERROR_COPY['analysis.running'] ?? 'Menghitung…'} />
      ) : (
        <ResourceView
          state={ranking.state}
          onRetry={ranking.retry}
          loadingTitle={INDONESIAN_ERROR_COPY['analysis.running'] ?? 'Menghitung…'}
        >
          {(envelope) => (
            <CheckedResult
              result={envelope.data}
              requested={weights}
              registry={registry}
              options={options}
              history={history}
              onShown={recordShown}
            />
          )}
        </ResourceView>
      )}
      <p className={`kk-small ${styles.muted}`}>
        Cara membaca: skor 0–100 menunjukkan kondisi relatif pada kriteria yang Anda pilih. Skor lebih tinggi
        berarti kondisi lebih baik (misalnya kemiskinan atau risiko bencana lebih rendah, IPM lebih tinggi).
        Peringkat 1 adalah kondisi relatif terbaik, bukan wilayah yang paling perlu dibantu; pilih “Kondisi
        paling berat dulu” untuk melihat wilayah dengan kebutuhan relatif terbesar. Peringkat berubah bila
        kriteria atau bobotnya berubah, dan bukan penilaian mutlak atas suatu wilayah atau rekomendasi
        kebijakan.
      </p>
    </Surface>
  );
}

interface CheckedResultProps {
  readonly result: ExploratoryCompositeResultDTO;
  readonly requested: Readonly<Record<string, number>>;
  readonly registry: readonly DataHubRegionDTO[];
  readonly options: readonly IndicatorOption[];
  readonly history: ShownHistory;
  readonly onShown: (result: ExploratoryCompositeResultDTO) => void;
}

/**
 * LIVE: a ranking that fails a blocking check is withheld, and the direction of every component
 * is verified against the published values before anything is shown.
 * DEMO: the simulated list is still shown, with any problem flagged above it.
 */
function CheckedResult({ result, requested, registry, options, history, onShown }: CheckedResultProps) {
  const { dataMode } = useDataHub();
  const scopeCount = result.filterProvinceId
    ? registry.filter((region) => region.parentRegionId === result.filterProvinceId).length
    : registry.length;
  const integrity = assessCompositeIntegrity(
    integrityInputFromResult(result, scopeCount > 0 ? scopeCount : null, requested),
  );
  const live = dataMode === 'LIVE';
  const direction = useDirectionCheck(live && integrity.ok ? result : null, integrity.weightsUsed, options);

  if (!integrity.ok && live) return <IntegrityProblem integrity={integrity} withheld />;
  if (live && direction.state.status === 'loading') {
    return <StatusMessage kind="loading" title="Memeriksa arah skor terhadap data sumber…" />;
  }
  const checks = direction.state.status === 'success' ? direction.state.data : null;
  const wrongDirection = checks?.filter((check) => check.verdict.status === 'inconsistent') ?? [];
  if (live && wrongDirection.length > 0) {
    return <DirectionProblem checks={wrongDirection} options={options} />;
  }

  return (
    <>
      {!integrity.ok && <IntegrityProblem integrity={integrity} withheld={false} />}
      <CalculationNotes
        result={result}
        integrity={integrity}
        registry={registry}
        options={options}
        checks={checks}
        checkFailed={live && direction.state.status === 'error'}
        onRetryCheck={direction.retry}
      />
      <RankingList
        result={result}
        integrity={integrity}
        options={options}
        previous={history.current === result ? history.previous : history.current}
        onShown={onShown}
      />
      <EvidenceRecord result={result} integrity={integrity} options={options} />
    </>
  );
}

function IntegrityProblem({
  integrity,
  withheld,
}: {
  readonly integrity: CompositeIntegrity;
  readonly withheld: boolean;
}) {
  const blocking = integrity.issues.filter((issue) => issue.severity === 'block');
  return (
    <StatusMessage
      kind="error"
      title={
        withheld
          ? 'Peringkat ditahan: hasil perhitungan tidak konsisten'
          : 'Hasil perhitungan tidak konsisten'
      }
    >
      <ul role="list">
        {blocking.map((issue) => (
          <li key={issue.code}>
            {issue.message}
            {issue.examples &&
              issue.examples.length > 0 &&
              ` Contoh kode wilayah: ${issue.examples.join(', ')}.`}
          </li>
        ))}
      </ul>
      Data Hub perlu memperbaikinya; antarmuka tidak menghitung ulang atau menutup selisih ini.
    </StatusMessage>
  );
}

function DirectionProblem({
  checks,
  options,
}: {
  readonly checks: readonly DirectionCheck[];
  readonly options: readonly IndicatorOption[];
}) {
  return (
    <StatusMessage kind="error" title="Peringkat ditahan: arah skor tidak sesuai data sumber">
      <ul role="list">
        {checks.map(({ indicatorId, verdict }) => (
          <li key={indicatorId}>
            {options.find((option) => option.id === indicatorId)?.label ?? indicatorId}:{' '}
            {verdict.status === 'inconsistent' ? verdict.reason : ''}
            {verdict.status === 'inconsistent' && ` Contoh kode wilayah: ${verdict.examples.join(', ')}.`}
          </li>
        ))}
      </ul>
      Skor yang arahnya terbalik akan menukar wilayah terbaik dengan yang terberat, jadi hasil ini tidak
      ditampilkan.
    </StatusMessage>
  );
}

interface CalculationNotesProps {
  readonly result: ExploratoryCompositeResultDTO;
  readonly integrity: CompositeIntegrity;
  readonly registry: readonly DataHubRegionDTO[];
  readonly options: readonly IndicatorOption[];
  readonly checks: readonly DirectionCheck[] | null;
  readonly checkFailed: boolean;
  readonly onRetryCheck: () => void;
}

/** What was actually calculated: chosen vs. used weights, what was left out, and what was checked. */
function CalculationNotes({
  result,
  integrity,
  registry,
  options,
  checks,
  checkFailed,
  onRetryCheck,
}: CalculationNotesProps) {
  const labelOf = (id: string) => options.find((option) => option.id === id)?.label ?? id;
  const rows = compareWeights(result);
  const leftOut = rows.filter((row) => row.used === null);
  const excluded = excludedRegions(registry, result);
  const coverageGap = integrity.issues.find((issue) => issue.code === 'REGISTRY_COUNT_MISMATCH');
  const lowest = Object.keys(integrity.weightsUsed)
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is IndicatorOption => option?.coverageCount != null)
    .sort((a, b) => (a.coverageCount ?? 0) - (b.coverageCount ?? 0))[0];

  return (
    <section className={styles.notes} aria-label="Cara skor dihitung">
      <p className="kk-body">
        Dihitung oleh Data Hub untuk <strong>{result.items.length} wilayah</strong>
        {result.filterProvinceId ? ` di provinsi ${result.filterProvinceId}` : ''} · snapshot{' '}
        {result.snapshotId}.
      </p>

      {leftOut.length > 0 && (
        <div className={styles.callout} role="note">
          <p className="kk-body-strong">
            {leftOut.length} kriteria belum punya data, jadi bobotnya dialihkan ke kriteria lain.
          </p>
          <p className="kk-small">
            {leftOut.map((row) => labelOf(row.id)).join(', ')} tidak bisa dihitung karena data resminya belum
            tersedia. Supaya total tetap 100%, bobotnya dibagi ke kriteria berdata sesuai perbandingan bobot
            yang Anda pilih. Hasil ini karena itu tidak memasukkan{' '}
            {leftOut.length === 1 ? 'kriteria tersebut' : 'kriteria-kriteria tersebut'}.
          </p>
        </div>
      )}

      <table className={styles.weightTable}>
        <caption className="kk-small">Bobot pilihan Anda dan bobot yang benar-benar dipakai</caption>
        <thead>
          <tr>
            <th scope="col">Kriteria</th>
            <th scope="col">Pilihan Anda</th>
            <th scope="col">Dipakai</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{labelOf(row.id)}</th>
              <td>{percentLabel(row.chosen)}</td>
              <td>{row.used === null ? 'Tidak dipakai (tanpa data)' : percentLabel(row.used)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {coverageGap && excluded.length > 0 && (
        <details className={styles.excluded}>
          <summary className="kk-small">
            {excluded.length} wilayah tidak masuk peringkat — lihat daftar
          </summary>
          <p className="kk-small">
            Data Hub tidak menyertakan wilayah ini dalam perhitungan
            {lowest
              ? `; kriteria terpilih dengan data paling sedikit adalah ${lowest.label} (${String(lowest.coverageCount)} dari ${String(lowest.totalRegions ?? '?')} wilayah)`
              : ''}
            . Wilayah ini tidak diberi skor, bukan diberi skor nol.
          </p>
          <ul role="list" className={styles.excludedList}>
            {excluded.map((region) => (
              <li key={region.regionId} className="kk-small">
                {region.displayName} ({region.regionId})
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className={styles.method}>
        <summary className="kk-small">Metodologi dan pemeriksaan</summary>
        <ul role="list" className="kk-small">
          <li>
            Setiap kriteria diubah ke skala 0–100 oleh Data Hub (100 = kondisi terbaik di antara wilayah yang
            dihitung). Skor gabungan = jumlah dari skor kriteria × bobot yang dipakai.
          </li>
          <li>
            Bobot dikirim sebagai bilangan bulat yang totalnya tepat 10.000 (= 100%). Bila ada kriteria tanpa
            data, Data Hub menskalakan ulang bobot sisanya ke 10.000.
          </li>
          <li>
            Diperiksa di peramban: total bobot, kesesuaian bobot efektif, rentang skor 0–100, setiap skor
            gabungan sama dengan jumlah berbobot komponennya (selisih terbesar{' '}
            {integrity.maxScoreError.toFixed(3)}), urutan peringkat, dan tidak ada data kosong yang dihitung
            sebagai nol.
          </li>
          {checks && (
            <li>
              Arah skor dibandingkan dengan nilai sumber:{' '}
              {checks
                .map(
                  ({ indicatorId, verdict }) =>
                    `${labelOf(indicatorId)} — ${verdict.status === 'consistent' ? `sesuai (${String(verdict.checked)} wilayah)` : verdict.status === 'unverifiable' ? `belum dapat diperiksa: ${verdict.reason}` : 'tidak sesuai'}`,
                )
                .join('; ')}
              .
            </li>
          )}
        </ul>
        {checkFailed && (
          <p className="kk-small">
            Nilai sumber untuk memeriksa arah skor gagal dimuat.{' '}
            <Button variant="secondary" onClick={onRetryCheck}>
              Periksa lagi
            </Button>
          </p>
        )}
      </details>
    </section>
  );
}

type Order = 'best' | 'hardest';

function RankingList({
  result,
  integrity,
  options,
  previous,
  onShown,
}: {
  readonly result: ExploratoryCompositeResultDTO;
  readonly integrity: CompositeIntegrity;
  readonly options: readonly IndicatorOption[];
  /** The result shown before this one, to describe rank moves. */
  readonly previous: ExploratoryCompositeResultDTO | null;
  readonly onShown: (result: ExploratoryCompositeResultDTO) => void;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [order, setOrder] = useState<Order>('best');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const searchId = useId();

  // Rank movement against the result shown before this one (same scope only).
  const moves = rankMovement(previous, result);
  useEffect(() => {
    onShown(result);
  }, [result, onShown]);

  const scored = result.items.filter((item) => item.rankPosition !== null);
  const ordered = order === 'best' ? scored : [...scored].reverse();
  const needle = query.trim().toLowerCase();
  const matching = needle
    ? ordered.filter((item) => item.regionDisplayName.toLowerCase().includes(needle))
    : ordered;
  const rows = matching.slice(0, shown);

  return (
    <section className={styles.results} aria-label="Daftar peringkat">
      <div className={styles.resultControls}>
        <div className={styles.orderToggle} role="group" aria-label="Urutan tampilan">
          {(['best', 'hardest'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={styles.preset}
              aria-pressed={order === value}
              onClick={() => {
                setOrder(value);
                setShown(PAGE_SIZE);
              }}
            >
              {value === 'best' ? 'Kondisi terbaik dulu' : 'Kondisi paling berat dulu'}
            </button>
          ))}
        </div>
        <label htmlFor={searchId} className="kk-small">
          Cari wilayah dalam peringkat
        </label>
        <input
          id={searchId}
          type="search"
          className={styles.search}
          value={query}
          placeholder="Nama kabupaten/kota"
          onChange={(event) => {
            setQuery(event.target.value);
            setShown(PAGE_SIZE);
          }}
        />
      </div>
      <p className="kk-small" role="status">
        Menampilkan {rows.length} dari{' '}
        {needle ? `${String(matching.length)} hasil pencarian` : `${String(scored.length)} wilayah`}
        {result.dataMode === 'DEMO' ? ' · nama wilayah pada dataset DEMO bersifat sintetis' : ''}
      </p>
      {rows.length === 0 && (
        <p className="kk-body">Tidak ada wilayah dalam peringkat ini yang cocok dengan “{query}”.</p>
      )}
      <ol className={styles.ranking}>
        {rows.map((item) => (
          <RankRow
            key={item.regionId}
            item={item}
            move={moves.get(item.regionId) ?? null}
            open={openId === item.regionId}
            onToggle={() => {
              setOpenId((current) => (current === item.regionId ? null : item.regionId));
            }}
            weightsUsed={integrity.weightsUsed}
            breakdownVerified={integrity.ok}
            options={options}
          />
        ))}
      </ol>
      {shown < matching.length && (
        <Button
          variant="secondary"
          onClick={() => {
            setShown((current) => current + PAGE_SIZE);
          }}
        >
          Tampilkan {Math.min(PAGE_SIZE, matching.length - shown)} lagi
        </Button>
      )}
    </section>
  );
}

function RankRow({
  item,
  move,
  open,
  onToggle,
  weightsUsed,
  breakdownVerified,
  options,
}: {
  readonly item: ExploratoryRegionRankDTO;
  readonly move: number | null;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly weightsUsed: Readonly<Record<string, number>>;
  readonly breakdownVerified: boolean;
  readonly options: readonly IndicatorOption[];
}) {
  const panelId = `rincian-${item.regionId}`;
  const score = item.compositeScoreDecimal === null ? null : Number(item.compositeScoreDecimal);
  const labelOf = (id: string) => options.find((option) => option.id === id)?.label ?? id;

  return (
    <li className={styles.rank}>
      <span className={`kk-number ${styles.position}`}>{item.rankPosition ?? '—'}</span>
      <span className={styles.name}>
        <span className="kk-body-strong">{item.regionDisplayName}</span>
        <span className={`kk-small ${styles.muted}`}>
          Kode {item.regionId}
          {move !== null && move !== 0 && (
            <span className={styles.move}>
              {' '}
              · {move > 0 ? `naik ${String(move)}` : `turun ${String(-move)}`} dari perhitungan sebelumnya
            </span>
          )}
        </span>
      </span>
      <span className={styles.scoreCell}>
        <span className="kk-body-strong">
          {score === null ? 'Tidak dapat dihitung' : formatDecimalId(String(score))}
        </span>
        {score !== null && (
          <span className={styles.scoreBar} aria-hidden="true">
            <span style={{ width: `${String(Math.max(0, Math.min(100, score)))}%` }} />
          </span>
        )}
      </span>
      <button
        type="button"
        className={styles.why}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        {open ? 'Tutup rincian' : 'Mengapa skor ini?'}
      </button>
      {open && (
        <div id={panelId} className={styles.breakdown}>
          {breakdownVerified ? (
            <table>
              <caption className="kk-small">
                Sumbangan setiap kriteria ke skor {item.regionDisplayName}. Sumbangan = skor kriteria × bobot;
                jumlahnya bisa berbeda 0,01–0,02 dari skor gabungan karena pembulatan.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Kriteria</th>
                  <th scope="col">Skor 0–100</th>
                  <th scope="col">Bobot</th>
                  <th scope="col">Sumbangan</th>
                </tr>
              </thead>
              <tbody>
                {contributions(item, weightsUsed).map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{labelOf(row.id)}</th>
                    <td>{formatDecimalId(String(row.score))}</td>
                    <td>{percentLabel(row.weight)}</td>
                    <td>{formatDecimalId(row.points.toFixed(2))} poin</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>
                    Skor gabungan
                  </th>
                  <td>{score === null ? '—' : formatDecimalId(String(score))}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="kk-small">
              Rincian tidak ditampilkan karena skor gabungan tidak cocok dengan komponennya.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** What a future Paspor Bukti will record for this result; shown now, nothing is stored yet. */
function EvidenceRecord({
  result,
  integrity,
  options,
}: {
  readonly result: ExploratoryCompositeResultDTO;
  readonly integrity: CompositeIntegrity;
  readonly options: readonly IndicatorOption[];
}) {
  const labelOf = (id: string) => options.find((option) => option.id === id)?.label ?? id;
  return (
    <details className={styles.method}>
      <summary className="kk-small">Catatan perhitungan (bahan Paspor Bukti)</summary>
      <dl className={`kk-small ${styles.record}`}>
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
      <p className="kk-small">
        Paspor Bukti (segera hadir) akan menyimpan catatan ini bersama sumber dan batasannya. Hasil di halaman
        ini belum disimpan dan tidak memiliki ID permanen.
      </p>
    </details>
  );
}
