import { ButtonLink } from '@/components/ui/Button/Button';
import styles from './StaticPage.module.css';
import { t } from '@/lib/i18n';

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <title>{t('Halaman tidak ditemukan — Nusa Matra')}</title>
      <h1 className="kk-h1">{t('Halaman tidak ditemukan')}</h1>
      <p className={`kk-lead ${styles.muted}`}>{t('Alamat ini tidak ada atau sudah dipindahkan.')}</p>
      <div className={styles.actions}>
        <ButtonLink to="/">{t('Kembali ke beranda')}</ButtonLink>
        <ButtonLink to="/jelajahi" variant="secondary">
          {t('Buka Jelajahi')}
        </ButtonLink>
      </div>
    </div>
  );
}
