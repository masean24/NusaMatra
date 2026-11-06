import { useRouteError } from 'react-router';
import { Button, ButtonLink } from '@/components/ui/Button/Button';
import styles from './StaticPage.module.css';
import { t } from '@/lib/i18n';

/** A page's code could not be downloaded (lost connection, or a new version was just deployed). */
function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      error.message,
    )
  );
}

/**
 * Shown instead of the router's developer error screen when a page fails to load or render: a plain
 * explanation in Indonesian and a way to reload, never a stack trace.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const chunk = isChunkLoadError(error);
  return (
    <div className={styles.page} role="alert">
      <title>{t('Halaman gagal dimuat — Nusa Matra')}</title>
      <h1 className="kk-h1">{t('Halaman gagal dimuat')}</h1>
      <p className={`kk-lead ${styles.muted}`}>
        {chunk
          ? t(
              'Bagian halaman ini tidak dapat diunduh. Koneksi mungkin terputus, atau versi baru situs baru saja dipasang. Muat ulang untuk mencoba lagi.',
            )
          : t('Terjadi kesalahan saat menampilkan halaman ini. Muat ulang untuk mencoba lagi.')}
      </p>
      <div className={styles.actions}>
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          {t('Muat ulang')}
        </Button>
        <ButtonLink to="/" variant="secondary" reloadDocument>
          {t('Kembali ke beranda')}
        </ButtonLink>
      </div>
    </div>
  );
}
