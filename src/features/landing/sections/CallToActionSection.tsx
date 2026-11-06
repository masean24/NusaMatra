import { Button } from '@/components/ui/Button/Button';
import { Reveal } from '@/features/motion';
import { RegionSearchForm } from '../components/RegionSearchForm';
import styles from './CallToActionSection.module.css';
import { t } from '@/lib/i18n';

/** Figma 41:421 "Ajakan". G11: the panel rises 32px; the search field shimmers once. */
export function CallToActionSection() {
  return (
    <section className={styles.section} aria-labelledby="ajakan-title">
      <Reveal className={styles.band} distance={32} duration={700}>
        <div className={styles.copy}>
          <h2 id="ajakan-title" className="kk-h1">
            {t('Mulai dari wilayah Anda')}
          </h2>
          <p className="kk-body">
            {t('Gratis, tanpa daftar. Ketik nama kabupaten/kota dan lihat kondisinya dalam hitungan detik.')}
          </p>
        </div>
        <RegionSearchForm
          className={styles.search}
          placeholder={t('Cari kabupaten/kota')}
          landmarkLabel={t('Cari wilayah, ajakan di akhir halaman')}
          shimmerOnce
          actions={<Button type="submit">{t('Mulai jelajahi')}</Button>}
        />
      </Reveal>
    </section>
  );
}
