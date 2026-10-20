import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/ui/Button/Button';
import { Surface } from '@/components/ui/Surface/Surface';
import { ExplorationMapPanel } from '@/features/exploration';
import { REGION_SEARCH_PARAM } from '@/features/landing';
import { useStaggeredEnter } from '@/features/motion';
import { BackToHubLink } from '@/features/navigation';
import type { FeatureShell } from './featureShells';
import styles from './FeatureShellPage.module.css';

interface FeatureShellPageProps {
  readonly shell: FeatureShell;
}

/** An honest placeholder for a designed feature that is not built yet; never a fake feature. */
export function FeatureShellPage({ shell }: FeatureShellPageProps) {
  const [searchParams] = useSearchParams();
  const query = shell.path === '/jelajahi' ? searchParams.get(REGION_SEARCH_PARAM)?.trim() : undefined;
  const pageRef = useRef<HTMLDivElement>(null);
  useStaggeredEnter(pageRef, shell.path);

  return (
    <div ref={pageRef} className={styles.page} data-has-map={shell.hasMap || undefined}>
      <title>{`${shell.title} — Nusa Matra`}</title>
      {shell.path !== '/peta' && <BackToHubLink />}
      <h1 className="kk-h1">{shell.title}</h1>
      <p className={`kk-lead ${styles.summary}`}>{shell.summary}</p>

      {shell.hasMap && <ExplorationMapPanel />}

      {query && (
        <Surface radius="card" className={styles.panel} role="status">
          <h2 className="kk-h3">Pencarian “{query}”</h2>
          <p className="kk-body">
            Katalog kabupaten/kota belum terhubung, jadi hasil pencarian belum dapat ditampilkan. Pencarian
            akan aktif setelah data wilayah dari Data Hub tersedia.
          </p>
        </Surface>
      )}

      <Surface radius="card" className={styles.panel}>
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
        {shell.path !== '/peta' && (
          <ButtonLink to="/peta" variant="secondary">
            Buka Peta Utama
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
