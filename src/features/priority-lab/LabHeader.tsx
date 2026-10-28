import { DataHubErrorMessage, DataModeSwitch, useDataHub, useDataHubResource } from '@/features/data-hub';
import { BackButton } from '@/features/navigation';
import { publicConfig } from '@/lib/publicConfig';
import styles from './LabHeader.module.css';

/**
 * Back button, title, and (only where the mode switch is enabled, i.e. in tests) the data mode. The
 * Data Hub's reachability is checked here once, so an outage is reported above the workbench.
 */
export function LabHeader() {
  const { dataMode } = useDataHub();
  const snapshots = useDataHubResource('snapshots', (repository, mode, signal) =>
    repository.getSnapshots(mode, signal),
  );

  return (
    <header className={styles.header}>
      <BackButton />
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <h1 className={styles.title}>Lab Prioritas</h1>
          <p className={styles.lead}>
            Atur bobot kriteria dan lihat bagaimana urutan wilayah bergeser — lengkap dengan alasan di balik
            setiap posisi.
          </p>
        </div>
        {/* LIVE is the only mode visitors see, so it is not labelled; DEMO always is. */}
        {(dataMode === 'DEMO' || publicConfig.modeSwitch) && (
          <div className={styles.meta} aria-label="Sumber data halaman ini">
            <span className={styles.chip} data-tone={dataMode === 'LIVE' ? 'live' : 'demo'}>
              <span className={styles.dot} aria-hidden="true" />
              {dataMode === 'LIVE' ? 'Data LIVE' : 'DEMO · data simulasi'}
            </span>
            {publicConfig.modeSwitch && (
              <details className={styles.modeControl}>
                <summary>Ganti data</summary>
                <div className={styles.modePanel}>
                  <DataModeSwitch />
                </div>
              </details>
            )}
          </div>
        )}
      </div>
      {snapshots.state.status === 'error' && (
        <DataHubErrorMessage error={snapshots.state.error} onRetry={snapshots.retry} />
      )}
      {snapshots.state.status === 'unconfigured' && (
        <p className={styles.lead}>Alamat Data Hub belum diatur pada konfigurasi aplikasi.</p>
      )}
    </header>
  );
}
