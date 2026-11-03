import { ConditionBadge } from '@/components/ui/ConditionBadge/ConditionBadge';
import { formatDecimalId } from '@/features/data-hub';
import { formatNumber } from './formatNumber';
import type { MissingExample, ReadyExample } from './indicatorExample';
import { IconCard, InfoNote, LoadableView, SectionHead } from './MethodParts';
import type { ScoreMethodData } from './useScoreMethod';
import styles from './Methodology.module.css';

/** Langkah 1: the raw official value, shown as the source states it. */
export function ValueStep({ method }: { readonly method: ScoreMethodData }) {
  return (
    <section id="langkah-1" aria-labelledby="metode-nilai" className={styles.section}>
      <SectionHead id="metode-nilai" kicker="Langkah 1" title="Nilai asli dari sumber resmi">
        Setiap skor berawal dari angka resmi kabupaten/kota, ditampilkan apa adanya dengan satuan dan tahun
        acuannya.
      </SectionHead>
      <LoadableView part={method.example} loadingText="Memuat nilai contoh dari Data Hub…">
        {(example) =>
          example.status === 'missing' ? (
            <p className={`kk-body ${styles.exampleNote}`}>
              {example.regionName} belum punya nilai <strong>{example.indicatorLabel}</strong> pada versi data
              ini.
            </p>
          ) : (
            <ValueCard example={example} />
          )
        }
      </LoadableView>
      <ul role="list" className={styles.cardGrid}>
        <IconCard icon="calendar" title="Tahun selalu disebutkan">
          Tahun antarindikator bisa berbeda karena mengikuti publikasi resmi terbaru, jadi tahun selalu
          ditulis di samping angka.
        </IconCard>
        <IconCard icon="empty" title="Data kosong tetap kosong">
          Tidak diisi nol dan tidak ditebak. Wilayah tanpa data untuk sebuah indikator tidak diberi skor untuk
          indikator itu.
        </IconCard>
        <IconCard icon="layers" title="Estimasi tingkat provinsi">
          Angka yang hanya terbit per provinsi dipakai untuk semua kabupaten/kota di provinsi itu dan diberi
          tanda estimasi, karena bukan pengukuran kabupaten/kota.
        </IconCard>
      </ul>
    </section>
  );
}

function ExampleChips({ regionName, label }: { readonly regionName: string; readonly label: string }) {
  return (
    <p className={styles.chipRow}>
      <span className={styles.chip} data-tone="sea">
        Contoh: {regionName}
      </span>
      <span className={styles.chip}>{label}</span>
    </p>
  );
}

function ValueCard({ example }: { readonly example: ReadyExample }) {
  return (
    <article className={`glass glass--read ${styles.valueCard}`} aria-label="Nilai asli contoh">
      <ExampleChips regionName={example.regionName} label="Nilai asli dari sumber" />
      <p className={styles.valueFigure}>
        <span>{example.valueText}</span>
        <span className={styles.valueUnit}>{example.unitText}</span>
      </p>
      <p className={styles.pillRow}>
        <span className={styles.pill}>{example.indicatorLabel}</span>
        <span className={styles.pill}>
          {example.referenceYear === null ? 'Tahun belum tersedia' : `Tahun ${String(example.referenceYear)}`}
        </span>
        <span className={styles.pill}>Sumber {example.agency}</span>
        {example.provinceEstimate && <span className={styles.pill}>Estimasi tingkat provinsi</span>}
      </p>
    </article>
  );
}

function MissingValue({ example }: { readonly example: MissingExample }) {
  return (
    <p className={`kk-body ${styles.exampleNote}`}>
      {example.regionName} belum punya data <strong>{example.indicatorLabel}</strong> pada versi data ini,
      jadi tidak diberi skor. Data yang kosong tidak diisi nol. Pilih indikator lain untuk melihat contohnya.
    </p>
  );
}

/** Langkah 2: the 0–100 need scale, both directions, then the example worked through. */
export function ScaleStep({
  method,
  exampleId,
}: {
  readonly method: ScoreMethodData;
  readonly exampleId: string;
}) {
  return (
    <section id="langkah-2" aria-labelledby="metode-skala" className={styles.section}>
      <SectionHead id="metode-skala" kicker="Langkah 2" title="Skala kebutuhan 0–100">
        Indikator punya satuan berbeda (persen, tahun, skor), jadi semuanya diletakkan pada satu skala yang
        sama. Patokannya nilai terendah dan tertinggi di antara semua kabupaten/kota yang punya data pada
        versi data aktif.
      </SectionHead>
      <div className={styles.formulas}>
        <article className={`glass glass--read ${styles.formulaCard}`} data-direction="high">
          <h3 className="kk-body-strong">Kalau angka tinggi berarti buruk</h3>
          <p className={`kk-small ${styles.muted}`}>Contoh: kemiskinan, stunting, risiko bencana</p>
          <p className={styles.formula}>skor = (nilai − terendah) ÷ (tertinggi − terendah) × 100</p>
          <MiniScale highIsNeed />
        </article>
        <article className={`glass glass--read ${styles.formulaCard}`} data-direction="low">
          <h3 className="kk-body-strong">Kalau angka tinggi berarti baik</h3>
          <p className={`kk-small ${styles.muted}`}>Contoh: IPM, harapan hidup, akses air minum</p>
          <p className={styles.formula}>skor = (tertinggi − nilai) ÷ (tertinggi − terendah) × 100</p>
          <MiniScale highIsNeed={false} />
        </article>
      </div>
      <InfoNote>
        Skor ini relatif. Angka 100 berarti paling membutuhkan di antara kabupaten/kota di Indonesia, bukan
        “buruk sekali” secara mutlak. Bila arah baik atau buruk sebuah indikator belum ditetapkan, skornya
        tidak dihitung.
      </InfoNote>

      <article
        id={exampleId}
        className={`glass glass--read ${styles.exampleCard} ${styles.anchor}`}
        aria-labelledby="metode-contoh"
      >
        <h3 id="metode-contoh" className="kk-h3">
          Contoh dengan angka sungguhan
        </h3>
        <LoadableView part={method.example} loadingText="Memuat nilai indikator…">
          {(example) =>
            example.status === 'missing' ? (
              <MissingValue example={example} />
            ) : (
              <WorkedRows example={example} />
            )
          }
        </LoadableView>
      </article>
    </section>
  );
}

/** Which end of the raw range gets 0 and which gets 100. */
function MiniScale({ highIsNeed }: { readonly highIsNeed: boolean }) {
  return (
    <div className={styles.miniScale}>
      <span className={styles.miniTrack} data-need-end={highIsNeed ? 'high' : 'low'} aria-hidden="true" />
      <span className={styles.miniLabels}>
        <span>terendah → {highIsNeed ? 0 : 100}</span>
        <span>tertinggi → {highIsNeed ? 100 : 0}</span>
      </span>
    </div>
  );
}

const DIRECTION_TEXT = {
  HIGH_VALUE_IS_NEED: 'Makin tinggi nilainya, makin besar kebutuhannya. Nilai tertinggi mendapat skor 100.',
  LOW_VALUE_IS_NEED:
    'Makin tinggi nilainya, makin baik kondisinya. Skalanya dibalik: nilai terendah mendapat skor 100.',
} as const;

function WorkedRows({ example }: { readonly example: ReadyExample }) {
  const { range, needEnd } = example;
  return (
    <>
      <ExampleChips regionName={example.regionName} label={example.indicatorLabel} />
      <div className={styles.rows}>
        <div className={styles.row}>
          <h4 className={styles.rowLabel}>Nilai asli</h4>
          <p className="kk-body">
            <strong>
              {example.valueText}
              {example.unitText}
            </strong>{' '}
            untuk {example.indicatorLabel} di {example.regionName}
          </p>
        </div>

        <div className={styles.row}>
          <h4 className={styles.rowLabel}>Rentang nasional</h4>
          {range === null ? (
            <p className="kk-body">
              Data Hub tidak menyertakan nilai terendah dan tertinggi untuk indikator ini.
            </p>
          ) : (
            <div className={styles.rowBody}>
              <p className="kk-body">
                Terendah <strong>{formatNumber(range.min)}</strong>
                {example.unitText} dan tertinggi <strong>{formatNumber(range.max)}</strong>
                {example.unitText}, dari {example.regionsWithData} kabupaten/kota yang punya data.
              </p>
              <RangeTrack
                start={formatNumber(range.min)}
                end={formatNumber(range.max)}
                position={positionOf(example.value, range.min, range.max)}
                bubble={`${example.valueText}${example.unitText}`}
                needEnd={needEnd === 'LOW_VALUE_IS_NEED' ? 'low' : 'high'}
                tone="sea"
              />
              {example.reported !== null && (
                <RangeTrack
                  start="0 (kebutuhan terendah)"
                  end="100 (tertinggi)"
                  position={positionOf(example.reported, 0, 100)}
                  bubble={`skor ${formatNumber(example.reported)}`}
                  needEnd="high"
                  tone="accent"
                />
              )}
            </div>
          )}
        </div>

        <div className={styles.row}>
          <h4 className={styles.rowLabel}>Arah indikator</h4>
          <p className="kk-body">
            {needEnd === null
              ? 'Arah baik atau buruk indikator ini belum ditetapkan, jadi skor kebutuhannya tidak dihitung.'
              : DIRECTION_TEXT[needEnd]}
          </p>
        </div>

        {needEnd !== null && range !== null && (
          <div className={styles.row}>
            <h4 className={styles.rowLabel}>Rumus diisi</h4>
            <div className={styles.rowBody}>
              <p className={styles.formula}>
                {needEnd === 'HIGH_VALUE_IS_NEED'
                  ? `(${formatNumber(example.value)} − ${formatNumber(range.min)}) ÷ (${formatNumber(range.max)} − ${formatNumber(range.min)}) × 100`
                  : `(${formatNumber(range.max)} − ${formatNumber(example.value)}) ÷ (${formatNumber(range.max)} − ${formatNumber(range.min)}) × 100`}
                {example.computed !== null && (
                  <>
                    {' = '}
                    <strong>{formatNumber(example.computed)}</strong>
                  </>
                )}
              </p>
              {example.reportedText !== null &&
                (example.matches ? (
                  <ConditionBadge tone="positive">
                    {`Sama dengan skor kebutuhan dari Data Hub: ${formatDecimalId(example.reportedText)}.`}
                  </ConditionBadge>
                ) : (
                  <p className={`kk-small ${styles.muted}`}>
                    Data Hub melaporkan {formatDecimalId(example.reportedText)}; angka Data Hub itulah yang
                    dipakai di situs.
                  </p>
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function positionOf(value: number, min: number, max: number): number {
  return max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 50;
}

/** A range with the region's place on it, its value in a bubble above the marker. */
function RangeTrack({
  start,
  end,
  position,
  bubble,
  needEnd,
  tone,
}: {
  readonly start: string;
  readonly end: string;
  readonly position: number;
  readonly bubble: string;
  readonly needEnd: 'high' | 'low';
  readonly tone: 'sea' | 'accent';
}) {
  return (
    <div className={styles.range} aria-hidden="true">
      <div className={styles.rangeTrack} data-need-end={needEnd}>
        <span className={styles.rangeMarker} data-tone={tone} style={{ left: `${String(position)}%` }}>
          <span className={styles.rangeBubble}>{bubble}</span>
        </span>
      </div>
      <div className={styles.rangeLabels}>
        <span>{start}</span>
        <span>{end}</span>
      </div>
    </div>
  );
}
