import { ButtonLink } from '@/components/ui/Button/Button';
import { FRONTEND_MIN_REQUESTED_WEIGHT_PCT } from '@/domain/prioritization';
import { MethodIcon } from './MethodIcon';
import { IconCard, SectionHead } from './MethodParts';
import styles from './Methodology.module.css';
import { t } from '@/lib/i18n';

/** What happens when data is missing: nothing is filled in, and the screen says so. */
export function MissingDataSection() {
  return (
    <section id="catatan" aria-labelledby="metode-kosong" className={styles.section}>
      <SectionHead id="metode-kosong" kicker={t('Catatan')} title={t('Kalau data tidak lengkap')} />
      <ul role="list" className={`${styles.cardGrid} ${styles.cardGridTwo}`}>
        <IconCard icon="empty" title={t('Indikator tanpa data nasional')}>
          {t(
            'Indikator yang belum punya data nasional tidak dihitung. Bobotnya dibagi ke indikator lain, dan hal itu dituliskan di layar.',
          )}
        </IconCard>
        <IconCard icon="layers" title={t('Data sebagian')}>
          {t(
            'Wilayah yang tidak punya data untuk sebagian indikator tetap dihitung dari indikator yang ada, dengan bobot sendiri yang totalnya 10.000, lalu ditandai “Data sebagian”.',
          )}
        </IconCard>
        <IconCard
          icon="pause"
          title={t('Peringkat ditahan di bawah {0}%', String(FRONTEND_MIN_REQUESTED_WEIGHT_PCT))}
        >
          {t(
            'Lab Prioritas menahan peringkat bila data nasional untuk bobot pilihan Anda kurang dari {0}%. Ini kebijakan Nusa Matra agar peringkat tidak bertumpu pada data yang terlalu sedikit.',
            FRONTEND_MIN_REQUESTED_WEIGHT_PCT,
          )}
        </IconCard>
        <IconCard icon="zero" title={t('Tidak diberi nol')}>
          {t('Wilayah yang datanya tidak cukup tidak diberi skor, bukan diberi nol.')}
        </IconCard>
      </ul>
    </section>
  );
}

const REMEMBER = [
  t('Skor dan peringkat bersifat relatif terhadap wilayah lain, bukan penilaian mutlak.'),
  t(
    'Hasilnya bergantung pada indikator, bobot, dan data yang tersedia. Ini alat bantu menyaring prioritas, bukan rekomendasi kebijakan resmi, dan metodenya belum divalidasi lembaga yang berwenang.',
  ),
  t('Sumber, tahun, dan batasan setiap angka dapat diperiksa di Paspor Bukti.'),
] as const;

/** The closing card: the limits to keep in mind, and the ways on. */
export function ClosingSection({ passportTo }: { readonly passportTo: string | null }) {
  return (
    <section
      id="penutup"
      aria-labelledby="metode-batasan"
      className={`glass glass--read ${styles.section} ${styles.closing}`}
    >
      <p className={styles.kicker}>{t('Penutup')}</p>
      <h2 id="metode-batasan" className="kk-h3">
        {t('Yang perlu diingat')}
      </h2>
      <ul role="list" className={styles.checkList}>
        {REMEMBER.map((text) => (
          <li key={text}>
            <MethodIcon name="check" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        {passportTo && <ButtonLink to={passportTo}>{t('Buka Paspor Bukti')}</ButtonLink>}
        <ButtonLink to="/lab-prioritas" variant={passportTo ? 'secondary' : 'accent'}>
          {t('Coba Lab Prioritas')}
        </ButtonLink>
        <ButtonLink to="/jelajahi" variant="secondary">
          {t('Kembali ke Jelajahi')}
        </ButtonLink>
      </div>
    </section>
  );
}
