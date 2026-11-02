import { StatusMessage } from '@/components/feedback/StatusMessage';
import { ButtonLink } from '@/components/ui/Button/Button';
import styles from './EvidencePassport.module.css';

/** Where to go to make a Paspor Bukti; shown whenever a link cannot produce one. */
function EntryLinks() {
  return (
    <span className={styles.actionRow}>
      <ButtonLink to="/jelajahi" variant="secondary">
        Buka Jelajahi
      </ButtonLink>
      <ButtonLink to="/bandingkan" variant="secondary">
        Buka Bandingkan
      </ButtonLink>
      <ButtonLink to="/lab-prioritas" variant="secondary">
        Buka Lab Prioritas
      </ButtonLink>
    </span>
  );
}

/** The three places a Paspor Bukti is made, and what each one records. */
const PASSPORT_SOURCES = [
  {
    to: '/jelajahi',
    feature: 'Jelajahi',
    kind: 'Paspor satu wilayah',
    how: 'Pilih kabupaten/kota, lalu tekan kartu “Paspor Bukti wilayah ini” di profilnya.',
  },
  {
    to: '/bandingkan',
    feature: 'Bandingkan',
    kind: 'Paspor perbandingan dua wilayah',
    how: 'Pilih Wilayah A dan Wilayah B, lalu tekan “Buat Paspor Bukti” di atas tabel.',
  },
  {
    to: '/lab-prioritas',
    feature: 'Lab Prioritas',
    kind: 'Paspor peringkat',
    how: 'Hitung peringkat, buka satu wilayah di daftar, lalu tekan “Buka Paspor Bukti”.',
  },
] as const;

/** A passport booklet crossed out: there is no record to show yet. */
function CrossedPassportArt() {
  return (
    <svg className={styles.entryArt} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="94" className={styles.entryHalo} />
      <g transform="rotate(-6 100 100)">
        <rect x="48" y="26" width="104" height="148" rx="14" className={styles.entryBook} />
        <rect x="48" y="26" width="14" height="148" rx="7" className={styles.entrySpine} />
        <circle cx="107" cy="80" r="22" className={styles.entryEmblem} />
        <path d="M85 80h44M107 58c-9 7-9 37 0 44M107 58c9 7 9 37 0 44" className={styles.entryEmblem} />
        <path d="M80 128h54M88 142h38" className={styles.entryTitle} />
      </g>
      <path d="M44 44 156 156M156 44 44 156" className={styles.entryCrossHalo} />
      <path d="M44 44 156 156M156 44 44 156" className={styles.entryCross} />
    </svg>
  );
}

/**
 * The page opened without a link (from the navbar): there is nothing to assemble, so it shows a
 * crossed-out passport and explains that a Paspor Bukti is always made from a feature, with the way
 * to each of the three.
 */
export function PassportEntry() {
  return (
    <section className={`glass ${styles.entry}`} aria-labelledby="paspor-belum-ada">
      <CrossedPassportArt />
      <div className={styles.entryBody}>
        <h2 id="paspor-belum-ada" className="kk-h3">
          Belum ada Paspor Bukti untuk ditampilkan
        </h2>
        <p className={`kk-body ${styles.entryLead}`}>
          Paspor Bukti selalu dibuat dari satu analisis: profil satu wilayah, perbandingan dua wilayah, atau
          peringkat di Lab Prioritas. Isinya sumber, tahun, kelas bukti, dan batasan setiap angka pada
          analisis itu. Halaman ini dibuka langsung dari menu, jadi belum ada analisis yang dirangkum.
        </p>
        <p className="kk-body-strong">Buat Paspor Bukti dari salah satu fitur berikut:</p>
        <ol role="list" className={styles.entrySteps}>
          {PASSPORT_SOURCES.map((source) => (
            <li key={source.to} className={styles.entryStep}>
              <span className="kk-small">{source.feature}</span>
              <span className="kk-body-strong">{source.kind}</span>
              <span className={`kk-small ${styles.entryHow}`}>{source.how}</span>
              <ButtonLink to={source.to} variant="secondary">
                Buka {source.feature}
              </ButtonLink>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function InvalidLink({ message }: { readonly message: string }) {
  return (
    <StatusMessage
      kind="unavailable"
      title="Paspor Bukti tidak dapat dibuat dari tautan ini"
      action={<EntryLinks />}
    >
      {message} Tidak ada laporan yang dibuat atau ditampilkan.
    </StatusMessage>
  );
}
