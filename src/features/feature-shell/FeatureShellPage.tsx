import { ButtonLink } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import { ExplorationMapPanel } from '@/features/exploration';
import { FeaturePageFrame } from './FeaturePageFrame';
import type { FeatureShell } from './featureShells';
import styles from './FeatureShellPage.module.css';
import { t } from '@/lib/i18n';

interface FeatureShellPageProps {
  readonly shell: FeatureShell;
}

/** An honest placeholder for a designed feature that is not built yet; never a fake feature. */
export function FeatureShellPage({ shell }: FeatureShellPageProps) {
  return (
    <FeaturePageFrame shell={shell} wide={shell.hasMap === true}>
      {shell.hasMap && <ExplorationMapPanel />}

      <Surface radius="card" reading className={styles.panel}>
        <p className={styles.status}>{t('Sedang dikembangkan')}</p>
        <h2 className="kk-h3">{t('Yang akan bisa Anda lakukan di sini')}</h2>
        <ul className={styles.capabilities}>
          {shell.plannedCapabilities.map((capability) => (
            <li key={capability} className="kk-body">
              {capability}
            </li>
          ))}
        </ul>
        <p className={`kk-small ${styles.muted}`}>
          {t(
            'Halaman ini belum menampilkan data. Nusa Matra tidak akan menampilkan angka simulasi seolah-olah data resmi.',
          )}
        </p>
      </Surface>

      <div className={styles.actions}>
        <ButtonLink to="/">{t('Kembali ke beranda')}</ButtonLink>
        {shell.path !== '/jelajahi' && (
          <ButtonLink to="/jelajahi" variant="secondary">
            {t('Buka Jelajahi')}
          </ButtonLink>
        )}
      </div>
    </FeaturePageFrame>
  );
}
