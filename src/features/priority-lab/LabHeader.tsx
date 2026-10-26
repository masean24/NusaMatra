import { Link } from 'react-router';
import { DataHubErrorMessage, DataModeSwitch, useDataHub, useDataHubResource } from '@/features/data-hub';
import { publicConfig } from '@/lib/publicConfig';
import styles from './LabHeader.module.css';

/** Long snapshot ids keep their start and end; the full id stays in the accessible name. */
function shortSnapshotId(id: string): string {
  return id.length > 22 ? `${id.slice(0, 12)}…${id.slice(-6)}` : id;
}

/**
 * Breadcrumb, title and the data the page reads: a mode chip and the active snapshot, in place of the
 * large DEMO/LIVE switch, which stays available as a small control. The DEMO disclaimer itself lives in
 * the result's status panel ("Data simulasi (DEMO)"), so the chip is the only DEMO mark up here.
 */
export function LabHeader() {
  const { dataMode } = useDataHub();
  const snapshots = useDataHubResource('snapshots', (repository, mode, signal) =>
    repository.getSnapshots(mode, signal),
  );
  const snapshotId = snapshots.state.status === 'success' ? snapshots.state.data.meta.snapshotId : null;

  return (
    <header className={styles.header}>
      <nav aria-label="Jejak navigasi" className={styles.breadcrumb}>
        <ol role="list">
          <li>
            <Link to="/peta">Peta utama</Link>
          </li>
          <li>
            <span aria-current="page">Lab Prioritas</span>
          </li>
        </ol>
      </nav>
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <h1 className={styles.title}>Lab Prioritas</h1>
          <p className={styles.lead}>
            Atur bobot kriteria dan lihat bagaimana urutan wilayah bergeser — lengkap dengan alasan di balik
            setiap posisi.
          </p>
        </div>
        <div className={styles.meta} aria-label="Sumber data halaman ini">
          {/* LIVE is the only mode visitors see, so it is not labelled; DEMO always is. */}
          {(dataMode === 'DEMO' || publicConfig.modeSwitch) && (
            <span className={styles.chip} data-tone={dataMode === 'LIVE' ? 'live' : 'demo'}>
              <span className={styles.dot} aria-hidden="true" />
              {dataMode === 'LIVE' ? 'Data LIVE' : 'DEMO · data simulasi'}
            </span>
          )}
          {snapshotId && (
            <span className={styles.chip} title={snapshotId}>
              <span aria-hidden="true">Snapshot {shortSnapshotId(snapshotId)}</span>
              <span className="visually-hidden">Snapshot {snapshotId}</span>
            </span>
          )}
          {publicConfig.modeSwitch && (
            <details className={styles.modeControl}>
              <summary>Ganti data</summary>
              <div className={styles.modePanel}>
                <DataModeSwitch />
              </div>
            </details>
          )}
        </div>
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
