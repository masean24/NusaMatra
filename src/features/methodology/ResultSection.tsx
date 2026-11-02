import type { CSSProperties } from 'react';
import { ConditionBadge, type ConditionTone } from '@/components/ui/ConditionBadge/ConditionBadge';
import {
  FAVORABLE_FROM_PERCENT,
  UNFAVORABLE_UP_TO_PERCENT,
  type ConditionVerdict,
} from '@/domain/indicators';
import { formatDecimalId } from '@/features/data-hub';
import { formatNumber } from './formatNumber';
import type { ReadyExample } from './indicatorExample';
import { IconCard, LoadableView, SectionHead } from './MethodParts';
import type { ScoreMethodData } from './useScoreMethod';
import styles from './Methodology.module.css';

const TONE_OF: Readonly<Record<ConditionVerdict, ConditionTone>> = {
  FAVORABLE: 'positive',
  UNFAVORABLE: 'negative',
  NEUTRAL: 'neutral',
  NO_JUDGEMENT: 'unknown',
};

/** Need percentile bounds of the Jelajahi verdicts, from the same constants the verdicts use. */
const FAVORABLE_UP_TO_NEED = 100 - FAVORABLE_FROM_PERCENT;
const UNFAVORABLE_FROM_NEED = 100 - UNFAVORABLE_UP_TO_PERCENT;

/** "Kabupaten Cianjur" → "Cianjur" for the marker label; a city keeps "Kota". */
const shortName = (regionName: string) => regionName.replace(/^Kabupaten\s+/, '');

/** The result of Langkah 2: rank, need percentile and the Jelajahi verdict for the example. */
export function ResultSection({ method }: { readonly method: ScoreMethodData }) {
  return (
    <section id="hasil" aria-labelledby="metode-posisi" className={styles.section}>
      <SectionHead
        id="metode-posisi"
        kicker="Hasil langkah 2"
        title="Peringkat, persentil, dan penilaian di Jelajahi"
      />
      <LoadableView part={method.example} loadingText="Memuat posisi wilayah contoh…">
        {(example) => (example.status === 'ready' ? <PositionCard example={example} /> : null)}
      </LoadableView>
      <ul role="list" className={`${styles.cardGrid} ${styles.cardGridTwo}`}>
        <IconCard icon="list" title="Peringkat">
          Urutan kabupaten/kota menurut skor kebutuhan satu indikator. Peringkat 1 adalah kebutuhan tertinggi.
        </IconCard>
        <IconCard icon="scale" title="Persentil kebutuhan">
          Persentase kabupaten/kota lain yang kebutuhannya lebih rendah. Persentil 80 berarti kebutuhannya
          lebih tinggi daripada sekitar 80% wilayah lain.
        </IconCard>
      </ul>
      <VerdictScale
        marker={
          method.example.status === 'ready' &&
          method.example.value.status === 'ready' &&
          method.example.value.percentile !== null
            ? {
                position: method.example.value.percentile,
                label: `${shortName(method.example.value.regionName)} · ${formatDecimalId(method.example.value.percentileText ?? '')}`,
              }
            : null
        }
      />
    </section>
  );
}

function PositionCard({ example }: { readonly example: ReadyExample }) {
  return (
    <article className={`glass glass--read ${styles.positionCard}`} aria-labelledby="metode-posisi-wilayah">
      <header className={styles.positionHead}>
        <h3 id="metode-posisi-wilayah" className="kk-h3">
          Posisi {example.regionName}
        </h3>
        <ConditionBadge tone={TONE_OF[example.reading.verdict]}>{example.reading.label}</ConditionBadge>
      </header>
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Skor kebutuhan</dt>
          <dd>
            <strong>{example.reportedText === null ? '—' : formatDecimalId(example.reportedText)}</strong>{' '}
            dari 100
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Persentil kebutuhan</dt>
          <dd>
            <strong>{example.percentileText === null ? '—' : formatDecimalId(example.percentileText)}</strong>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Peringkat</dt>
          <dd>
            <strong>{example.rank ?? '—'}</strong> dari {example.regionsWithData}
          </dd>
        </div>
      </dl>
      <ul role="list" className={styles.facts}>
        {example.percentile !== null && (
          <li>
            Kebutuhannya lebih tinggi daripada sekitar {formatNumber(example.percentile, 0)}% kabupaten/kota
            lain.
          </li>
        )}
        {example.rank !== null && <li>Peringkat 1 adalah kebutuhan tertinggi.</li>}
      </ul>
      <p className={styles.verdictLine}>
        <span className="kk-small">Penilaian di Jelajahi:</span>
        <ConditionBadge tone={TONE_OF[example.reading.verdict]}>{example.reading.label}</ConditionBadge>
      </p>
    </article>
  );
}

/** The three Jelajahi verdicts on the 0–100 need percentile, with the example region marked. */
function VerdictScale({
  marker,
}: {
  readonly marker: { readonly position: number; readonly label: string } | null;
}) {
  return (
    <article className={`glass glass--read ${styles.verdictCard}`} aria-labelledby="metode-arti">
      <h3 id="metode-arti" className="kk-body-strong">
        Arti penilaian di Jelajahi
      </h3>
      <div
        className={styles.verdictBar}
        style={
          {
            '--favorable-end': `${String(FAVORABLE_UP_TO_NEED)}%`,
            '--unfavorable-start': `${String(UNFAVORABLE_FROM_NEED)}%`,
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <span className={styles.verdictTrack} />
        {marker && (
          <span
            className={styles.verdictMarker}
            style={{ left: `${String(Math.min(100, Math.max(0, marker.position)))}%` }}
          >
            <span className={styles.rangeBubble}>{marker.label}</span>
          </span>
        )}
        <span className={styles.verdictTicks}>
          <span style={{ left: '0%' }}>0</span>
          <span style={{ left: `${String(FAVORABLE_UP_TO_NEED)}%` }}>{FAVORABLE_UP_TO_NEED}</span>
          <span style={{ left: `${String(UNFAVORABLE_FROM_NEED)}%` }}>{UNFAVORABLE_FROM_NEED}</span>
          <span style={{ left: '100%' }}>100</span>
        </span>
      </div>
      <ul role="list" className={styles.verdictRows}>
        <li>
          <ConditionBadge tone="positive">Relatif lebih baik</ConditionBadge>
          <span className="kk-small">persentil kebutuhan {FAVORABLE_UP_TO_NEED} atau kurang</span>
        </li>
        <li>
          <ConditionBadge tone="neutral">Di sekitar tengah</ConditionBadge>
          <span className="kk-small">
            di atas {FAVORABLE_UP_TO_NEED} dan di bawah {UNFAVORABLE_FROM_NEED}
          </span>
        </li>
        <li>
          <ConditionBadge tone="negative">Relatif kurang baik</ConditionBadge>
          <span className="kk-small">{UNFAVORABLE_FROM_NEED} atau lebih</span>
        </li>
      </ul>
      <p className={`kk-small ${styles.muted}`}>
        Penilaian ini membandingkan satu indikator sekali waktu, bukan seluruh kondisi wilayah. Tanpa data
        atau tanpa arah yang jelas, tertulis “Data belum tersedia” atau “Tidak dinilai”.
      </p>
    </article>
  );
}
