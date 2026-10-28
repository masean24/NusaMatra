import { ButtonLink } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import { ExplorationMapPanel } from '@/features/exploration';
import { FeaturePageFrame } from './FeaturePageFrame';
import type { FeatureShell } from './featureShells';
import styles from './FeatureShellPage.module.css';

interface FeatureShellPageProps {
  readonly shell: FeatureShell;
}

/** An honest placeholder for a designed feature that is not built yet; never a fake feature. */
export function FeatureShellPage({ shell }: FeatureShellPageProps) {
  return (
    <FeaturePageFrame shell={shell} wide={shell.hasMap === true}>
      {shell.hasMap && <ExplorationMapPanel />}

      <Surface radius="card" reading className={styles.panel}>
        <p className={styles.status}>Sedang dikembangkan</p>
        <h2 className="kk-h3">Yang akan bisa Anda lakukan di sini</h2>
        <ul className={styles.capabilities}>
          {shell.plannedCapabilities.map((capability) => (
            <li key={capability} className="kk-body">
              {capability}
            </li>
          ))}
        </ul>
        <p className={`kk-small ${styles.muted}`}>
          Halaman ini belum menampilkan data. Nusa Matra tidak akan menampilkan angka simulasi seolah-olah
          data resmi.
        </p>
      </Surface>

      <div className={styles.actions}>
        <ButtonLink to="/">Kembali ke beranda</ButtonLink>
        {shell.path !== '/jelajahi' && (
          <ButtonLink to="/jelajahi" variant="secondary">
            Buka Jelajahi
          </ButtonLink>
        )}
      </div>
    </FeaturePageFrame>
  );
}
