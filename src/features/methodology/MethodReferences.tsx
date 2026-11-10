import { SectionHead } from './MethodParts';
import styles from './Methodology.module.css';
import { localized, t } from '@/lib/i18n';

/**
 * One work the method rests on. The citation stays in its original language in both IN and EN;
 * only what Nusa Matra uses it for is translated.
 */
interface Reference {
  /** Authors and year, as cited: "OECD & JRC (2008)". */
  readonly authors: string;
  readonly title: string;
  /** Journal, volume and pages, or publisher. */
  readonly source: string;
  readonly use: string;
  readonly href?: string;
}

/*
 * Every entry was checked against the publication itself (title, venue, volume, pages) on
 * 10 November 2026. Links point at a DOI or at the publisher's own copy.
 */
const METHOD_REFERENCES = localized((): readonly Reference[] => [
  {
    authors: 'OECD & Joint Research Centre – European Commission (2008)',
    title: 'Handbook on Constructing Composite Indicators: Methodology and User Guide',
    source: 'OECD Publishing, Paris',
    use: t(
      'Kerangka utama Langkah 2 dan 3: normalisasi min-max, penjumlahan berbobot, bobot setara, dan dampak membagi ulang bobot bila data kosong.',
    ),
    href: 'https://doi.org/10.1787/9789264043466-en',
  },
  {
    authors: 'Mazziotta, M., & Pareto, A. (2013)',
    title: 'Methods for constructing composite indices: One for all or all for one?',
    source: 'Rivista Italiana di Economia Demografia e Statistica, 67(2), 67–80',
    use: t(
      'Rumus min-max dan pembalikan arah untuk indikator yang makin tinggi makin baik (Langkah 2), serta sifat saling mengimbangi pada rata-rata berbobot (Langkah 3).',
    ),
    href: 'https://www.istat.it/en/files/2013/12/Rivista2013_Mazziotta_Pareto.pdf',
  },
  {
    authors: 'Malczewski, J. (1999)',
    title: 'GIS and Multicriteria Decision Analysis',
    source: 'John Wiley & Sons, New York',
    use: t(
      'Transformasi skala linear untuk kriteria biaya dan manfaat, dan kombinasi linear berbobot pada analisis keputusan berbasis peta.',
    ),
  },
  {
    authors: 'Kaliszewski, I., & Podkopaev, D. (2016)',
    title: 'Simple additive weighting—A metamodel for multiple criteria decision analysis methods',
    source: 'Expert Systems with Applications, 54, 155–161',
    use: t('Dasar penjumlahan berbobot (simple additive weighting) yang dipakai pada Langkah 3.'),
    href: 'https://doi.org/10.1016/j.eswa.2016.01.042',
  },
  {
    authors: 'Cinelli, M., Spada, M., Kim, W., Zhang, Y., & Burgherr, P. (2021)',
    title: 'MCDA Index Tool: An interactive software to develop indices and rankings',
    source: 'Environment Systems and Decisions, 41(1), 82–109',
    use: t(
      'Contoh perangkat lunak interaktif tempat pengguna memilih indikator, mengatur bobot, dan melihat peringkat berubah, seperti Lab Prioritas.',
    ),
    href: 'https://doi.org/10.1007/s10669-020-09784-x',
  },
]);

const INDICATOR_REFERENCES = localized((): readonly Reference[] => [
  {
    authors: 'Pemerintah Republik Indonesia (2021)',
    title: 'Peraturan Presiden Nomor 72 Tahun 2021 tentang Percepatan Penurunan Stunting',
    source: 'Jakarta',
    use: t(
      'Dasar memasangkan stunting dengan air minum layak dan sanitasi layak dalam satu fokus: meningkatkan akses air minum dan sanitasi adalah salah satu tujuan Strategi Nasional Percepatan Penurunan Stunting (Pasal 2 ayat 2 huruf f).',
    ),
    href: 'https://peraturan.bpk.go.id/download/168225/perpres%20nomor%2072%20tahun%202021.pdf',
  },
  {
    authors: 'Badan Nasional Penanggulangan Bencana (2023)',
    title: 'Indeks Risiko Bencana Indonesia (IRBI) Tahun 2022',
    source: 'BNPB, Jakarta. ISSN 2985-6922',
    use: t(
      'Dasar indikator risiko bencana: risiko tiap kabupaten/kota dihitung dari bahaya, kerentanan, dan kapasitas.',
    ),
    href: 'https://inarisk.bnpb.go.id/pdf/BUKU%20IRBI%202022.pdf',
  },
]);

function ReferenceList({ items }: { readonly items: readonly Reference[] }) {
  return (
    <ol role="list" className={styles.refList}>
      {items.map((item) => (
        <li key={item.title} className={styles.refItem}>
          <p className="kk-small">
            {item.authors}. <cite className={styles.refTitle}>{item.title}</cite>. {item.source}.
          </p>
          <p className={`kk-small ${styles.muted}`}>
            <span className={styles.refUse}>{t('Dipakai untuk:')}</span> {item.use}
          </p>
          {item.href && (
            <a
              className={`kk-small ${styles.relatedLink}`}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('Buka sumber')}
              <span className="visually-hidden"> {t('(membuka tab baru)')}</span>
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The literature and regulations the method and the preset focuses rest on. */
export function ReferencesSection() {
  return (
    <section id="referensi" aria-labelledby="metode-referensi" className={styles.section}>
      <SectionHead id="metode-referensi" kicker={t('Referensi')} title={t('Dasar metode dan rujukan')}>
        {t(
          'Rumus di halaman ini mengikuti literatur indikator komposit. Pemilihan indikator dalam tiap fokus Lab Prioritas merujuk pada regulasi nasional, sedangkan angka bobot preset adalah skenario awal yang dapat Anda ubah lewat penggeser, bukan bobot hasil konsensus pakar.',
        )}
      </SectionHead>
      <div className={`glass glass--read ${styles.refGroup}`}>
        <h3 className="kk-body-strong">{t('Metode indeks komposit')}</h3>
        <ReferenceList items={METHOD_REFERENCES()} />
      </div>
      <div className={`glass glass--read ${styles.refGroup}`}>
        <h3 className="kk-body-strong">{t('Dasar pemilihan indikator')}</h3>
        <ReferenceList items={INDICATOR_REFERENCES()} />
      </div>
      <p className={`kk-small ${styles.muted}`}>
        {t(
          'Sumber data tiap angka (BPS, BNPB, Kemenkes, Kemendikdasmen, BIG, dan BMKG) tercantum di Paspor Bukti dan di bagian Sumber data pada Beranda.',
        )}
      </p>
    </section>
  );
}
