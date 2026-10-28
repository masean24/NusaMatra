import { ButtonLink } from '@/components/ui/Button/Button';
import styles from './StaticPage.module.css';

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <title>Halaman tidak ditemukan — Nusa Matra</title>
      <h1 className="kk-h1">Halaman tidak ditemukan</h1>
      <p className={`kk-lead ${styles.muted}`}>Alamat ini tidak ada atau sudah dipindahkan.</p>
      <div className={styles.actions}>
        <ButtonLink to="/">Kembali ke beranda</ButtonLink>
        <ButtonLink to="/jelajahi" variant="secondary">
          Buka Jelajahi
        </ButtonLink>
      </div>
    </div>
  );
}
