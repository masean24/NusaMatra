import type { CSSProperties } from 'react';
import type { CompositeExample, ExampleCriterion } from './compositeExample';
import { formatNumber } from './formatNumber';
import { IconCard, InfoNote, LoadableView, SectionHead } from './MethodParts';
import type { ScoreMethodData } from './useScoreMethod';
import styles from './Methodology.module.css';
import { t } from '@/lib/i18n';

/** Reader-facing names of the example criteria (the catalog's names are long). */
const CRITERION_LABEL: Readonly<Record<ExampleCriterion, string>> = {
  soc_hdi: t('Indeks Pembangunan Manusia'),
  dis_multihazard_index: t('Indeks Risiko Bencana (IRBI) multi-bencana'),
  soc_poverty_rate: t('Persentase penduduk miskin'),
  hlt_stunting_prevalence: t('Prevalensi balita stunting'),
};

/** Each criterion's colour in the rows and the stacked bar (the brand palette, in order). */
const CRITERION_COLOUR: Readonly<Record<ExampleCriterion, string>> = {
  soc_hdi: 'var(--nm-sea)',
  dis_multihazard_index: 'var(--nm-accent)',
  soc_poverty_rate: 'var(--nm-sea-shallow)',
  hlt_stunting_prevalence: 'var(--nm-land-4)',
};

/** Rounded to two decimals, as the rows show them. */
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Langkah 3: the composite score of Lab Prioritas, worked through for the example region. */
export function CompositeSection({ method }: { readonly method: ScoreMethodData }) {
  return (
    <section id="langkah-3" aria-labelledby="metode-gabungan" className={styles.section}>
      <SectionHead id="metode-gabungan" kicker={t('Langkah 3')} title={t('Skor gabungan di Lab Prioritas')}>
        {t(
          'Di Lab Prioritas Anda memilih beberapa indikator dan bobotnya. Skor gabungan sebuah wilayah adalah jumlah skor kebutuhan setiap indikator dikali bobotnya.',
        )}
      </SectionHead>
      <p className={`${styles.formula} ${styles.formulaWide}`}>
        {t('skor gabungan = Σ (skor kebutuhan × bobot) ÷ 10.000')}
      </p>
      <ul role="list" className={`${styles.cardGrid} ${styles.cardGridTwo}`}>
        <IconCard icon="scale" title={t('Bobot selalu berjumlah 100%')}>
          {t(
            'Bobot disimpan sebagai bilangan bulat dengan total tepat 10.000 (sama dengan 100%). Saat satu penggeser digeser, bobot lain menyesuaikan sehingga totalnya tetap 100%.',
          )}
        </IconCard>
        <IconCard icon="list" title={t('Urutan apa adanya dari Data Hub')}>
          {t(
            'Wilayah diurutkan dari skor gabungan tertinggi. Skor dan peringkat dipakai apa adanya dari Data Hub, termasuk peringkat yang sama untuk skor yang sama.',
          )}
        </IconCard>
      </ul>
      <LoadableView part={method.composite} loadingText={t('Memuat skor kebutuhan keempat kriteria…')}>
        {(example) => <CompositeCard example={example} regionName={method.regionName} />}
      </LoadableView>
    </section>
  );
}

function CompositeCard({
  example,
  regionName,
}: {
  readonly example: CompositeExample;
  readonly regionName: string;
}) {
  const roundedSum = round2(example.rows.reduce((sum, row) => sum + round2(row.contribution ?? 0), 0));
  const roundingGap = example.total !== null && roundedSum !== round2(example.total);
  const first = example.rows[0];

  return (
    <article className={`glass glass--read ${styles.compositeCard}`} aria-labelledby="metode-gabungan-contoh">
      <h3 id="metode-gabungan-contoh" className="kk-body-strong">
        {t('Contoh bobot untuk {0}', regionName)}
      </h3>
      <div className={styles.tableScroll}>
        <table className={styles.compositeTable}>
          <caption className="visually-hidden">
            {t('Skor kebutuhan × bobot = sumbangan, untuk {0}', regionName)}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Kriteria')}</th>
              <th scope="col">{t('Skor kebutuhan')}</th>
              <th scope="col">{t('Bobot')}</th>
              <th scope="col">{t('Sumbangan')}</th>
            </tr>
          </thead>
          <tbody>
            {example.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <span
                    className={styles.swatch}
                    style={{ '--swatch': CRITERION_COLOUR[row.id] } as CSSProperties}
                    aria-hidden="true"
                  />
                  {CRITERION_LABEL[row.id]}
                </th>
                <td>{row.needScore === null ? t('Data belum tersedia') : formatNumber(row.needScore)}</td>
                <td>{formatNumber(row.basisPoints / 100)}%</td>
                <td>{row.contribution === null ? '—' : formatNumber(row.contribution)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t('Skor gabungan')}</th>
              <td />
              <td>100%</td>
              <td>
                <strong>{example.total === null ? '—' : formatNumber(example.total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {example.total !== null && (
        <div className={styles.stack} aria-hidden="true">
          <div className={styles.stackTrack}>
            {example.rows.map((row) => (
              <span
                key={row.id}
                className={styles.stackPart}
                style={
                  {
                    width: `${String(row.contribution ?? 0)}%`,
                    '--swatch': CRITERION_COLOUR[row.id],
                  } as CSSProperties
                }
              />
            ))}
            <span className={styles.stackMarker} style={{ left: `${String(example.total)}%` }}>
              <span className={styles.rangeBubble}>{t('{0} dari 100', formatNumber(example.total))}</span>
            </span>
          </div>
          <div className={styles.rangeLabels}>
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      )}

      {example.missing.length > 0 ? (
        <InfoNote>
          {t(
            '{0} belum punya data untuk {1}. Nilainya tidak dianggap nol: di Lab Prioritas bobotnya dibagi ke kriteria lain dan wilayahnya ditandai “Data sebagian”, jadi total di atas tidak dihitung di sini.',
            regionName,
            example.missing.map((id) => CRITERION_LABEL[id]).join(', '),
          )}
        </InfoNote>
      ) : (
        <InfoNote>
          {t(
            'Contoh baris pertama: {0} × {1}% = {2}. Jumlah keempat sumbangan adalah skor gabungan yang dipakai untuk mengurutkan wilayah.',
            formatNumber(first?.needScore ?? 0),
            formatNumber((first?.basisPoints ?? 0) / 100),
            formatNumber(first?.contribution ?? 0),
          )}
          {roundingGap &&
            t(
              ' Jumlah sumbangan yang sudah dibulatkan ({0}) bisa selisih sedikit dari skor gabungan ({1}), karena skor gabungan dihitung dari angka sebelum dibulatkan.',
              formatNumber(roundedSum),
              formatNumber(example.total),
            )}
        </InfoNote>
      )}
    </article>
  );
}
