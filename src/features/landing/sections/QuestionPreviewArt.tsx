import { useState, type CSSProperties } from 'react';
import silhouetteUrl from '@/assets/landing/indonesia-silhouette.svg';
import type { QuestionId } from './howItWorksQuestions';
import styles from './QuestionPreviewArt.module.css';

/*
 * Static illustrations for the Guided Question Canvas. Every name and number here is an example
 * (the canvas labels each preview "Contoh"); none is read from the Data Hub. The silhouette is the
 * repository's Natural Earth coastline, simplified for a small picture.
 */

interface ExampleRegion {
  readonly key: 'A' | 'B' | 'C';
  /** Marker position over the silhouette, in % of its box. */
  readonly x: number;
  readonly y: number;
  readonly value: string;
}

const EXAMPLE_REGIONS: readonly ExampleRegion[] = [
  { key: 'A', x: 9, y: 21, value: '8,9%' },
  { key: 'B', x: 26.5, y: 75, value: '14,2%' },
  { key: 'C', x: 54, y: 56, value: '7,6%' },
];

function ExploreArt() {
  const [selected, setSelected] = useState<ExampleRegion['key']>('B');
  const region = EXAMPLE_REGIONS.find((item) => item.key === selected) ?? EXAMPLE_REGIONS[1];

  return (
    <div className={styles.explore}>
      <div className={styles.map} style={{ '--silhouette': `url("${silhouetteUrl}")` } as CSSProperties}>
        <span className={styles.land} aria-hidden="true" />
        {EXAMPLE_REGIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={styles.marker}
            style={{ left: `${String(item.x)}%`, top: `${String(item.y)}%` }}
            aria-pressed={item.key === selected}
            aria-label={`Wilayah contoh ${item.key}`}
            onClick={() => {
              setSelected(item.key);
            }}
          >
            {item.key}
          </button>
        ))}
      </div>
      <div className={styles.infoCard} aria-live="polite">
        <p className={styles.infoName}>Wilayah contoh {region?.key}</p>
        <p className={styles.infoLabel}>Penduduk miskin (P0)</p>
        <p className={styles.infoNumber}>{region?.value}</p>
        <p className={styles.infoSource}>Sumber: BPS · 2025</p>
      </div>
    </div>
  );
}

const COMPARE_ROWS = [
  { name: 'Penduduk miskin', a: 8.9, b: 14.2, unit: '%', better: 'a' },
  { name: 'Air minum layak', a: 91.4, b: 86.0, unit: '%', better: 'a' },
  { name: 'Lama sekolah', a: 8.1, b: 8.6, unit: ' th', better: 'b' },
] as const;

const formatExample = (value: number) => value.toLocaleString('id-ID', { minimumFractionDigits: 1 });

/** Two regions face each other: each row's bars grow outwards from the middle, the better one in jade. */
function CompareArt() {
  return (
    <div className={styles.compare}>
      <div className={styles.versus} aria-hidden="true">
        <span>Wilayah A</span>
        <b>vs</b>
        <span>Wilayah B</span>
      </div>
      <dl className={styles.compareRows}>
        {COMPARE_ROWS.map((row) => {
          const max = Math.max(row.a, row.b);
          return (
            <div key={row.name} className={styles.compareRow}>
              <dt>{row.name}</dt>
              {(['a', 'b'] as const).map((side) => (
                <dd key={side} data-side={side} data-better={row.better === side || undefined}>
                  <span className={styles.barValue}>
                    <span className="visually-hidden">{side.toUpperCase()}: </span>
                    {formatExample(row[side])}
                    {row.unit}
                  </span>
                  <span className={styles.bar} style={{ '--bar-fill': row[side] / max } as CSSProperties} />
                </dd>
              ))}
            </div>
          );
        })}
      </dl>
      <p className={styles.compareResult}>
        <span aria-hidden="true">✓</span> A lebih baik pada 2 dari 3 indikator
      </p>
    </div>
  );
}

const LAB_WEIGHTS = [
  { name: 'Kemiskinan', weight: 40, series: 'a' },
  { name: 'Air minum', weight: 35, series: 'b' },
  { name: 'Kesehatan', weight: 25, series: 'c' },
] as const;

const LAB_RANKING = [
  { key: 'C', score: 72 },
  { key: 'B', score: 64 },
  { key: 'A', score: 51 },
] as const;

/** One stacked weight bar (always 100%) above the ranking it produces. */
function LabArt() {
  return (
    <div className={styles.lab}>
      <div className={styles.weightsBlock}>
        <p className={styles.blockLabel}>Bobot · total 100%</p>
        <div className={styles.stack} aria-hidden="true">
          {LAB_WEIGHTS.map((item) => (
            <span key={item.name} data-series={item.series} style={{ flexGrow: item.weight }} />
          ))}
        </div>
        <ul role="list" className={styles.legend}>
          {LAB_WEIGHTS.map((item) => (
            <li key={item.name} data-series={item.series}>
              {item.name} <b>{item.weight}%</b>
            </li>
          ))}
        </ul>
      </div>
      <ol className={styles.ranking} aria-label="Urutan contoh">
        {LAB_RANKING.map((item, index) => (
          <li key={item.key}>
            <span className={styles.rank}>{index + 1}</span>
            <span className={styles.rankName}>Wilayah {item.key}</span>
            <span className={styles.rankTrack} aria-hidden="true">
              <span style={{ width: `${String(item.score)}%` }} />
            </span>
            <span className={styles.rankScore}>{item.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const PASSPORT_ROWS = [
  ['Sumber', 'BPS, BNPB'],
  ['Tahun data', '2025'],
  ['Model', 'Rata-rata berbobot'],
  ['Batasan', '2 indikator belum ada'],
] as const;

/** A small stack of papers: the passport sheet on top, its stamp landing in the corner. */
function PassportArt() {
  return (
    <div className={styles.passport}>
      <div className={styles.sheetBack} aria-hidden="true" />
      <div className={styles.sheet}>
        <p className={styles.sheetTitle}>
          <span>Paspor Bukti</span>
          <small>Contoh</small>
        </p>
        <dl className={styles.passportRows}>
          {PASSPORT_ROWS.map(([term, detail]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
        <span className={styles.stamp} aria-hidden="true">
          Tercatat
        </span>
      </div>
    </div>
  );
}

const ART: Record<QuestionId, () => React.JSX.Element> = {
  jelajahi: ExploreArt,
  bandingkan: CompareArt,
  lab: LabArt,
  paspor: PassportArt,
};

export function QuestionPreviewArt({ id }: { readonly id: QuestionId }) {
  const Art = ART[id];
  return <Art />;
}
