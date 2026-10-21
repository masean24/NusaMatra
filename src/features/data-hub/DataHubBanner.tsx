import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import { INDONESIAN_ERROR_COPY } from '@/services/api';
import { DataHubErrorMessage } from './DataHubErrorMessage';
import { DataModeSwitch } from './DataModeSwitch';
import { useDataHub } from './useDataHub';
import { useDataHubResource } from './useDataHubResource';
import styles from './DataHubBanner.module.css';

/**
 * Says which data a page is showing: the mode, the active snapshot and, in DEMO, that nothing here
 * is official. The snapshot comes from the Data Hub for the chosen mode, so LIVE shows the blocked
 * state instead of a DEMO snapshot.
 */
export function DataHubBanner() {
  const { dataMode } = useDataHub();
  const snapshots = useDataHubResource('snapshots', (repository, mode, signal) =>
    repository.getSnapshots(mode, signal),
  );

  return (
    <Surface radius="card" className={styles.banner} aria-label="Sumber dan mode data">
      <div className={styles.row}>
        <DataModeSwitch />
        {dataMode === 'DEMO' && <Chip tone="warning">DEMO</Chip>}
        {snapshots.state.status === 'success' && (
          <span className={`kk-small ${styles.snapshot}`}>
            Snapshot <strong>{snapshots.state.data.meta.snapshotId}</strong>
          </span>
        )}
      </div>

      {dataMode === 'DEMO' && (
        <p className={`kk-body-strong ${styles.disclaimer}`}>
          {INDONESIAN_ERROR_COPY['data.demo_disclaimer']}
        </p>
      )}

      {snapshots.state.status === 'success' &&
        snapshots.state.data.data.some((s) => s.isChecksumPlaceholder) && (
          <p className={`kk-small ${styles.note}`}>
            Checksum snapshot masih berupa placeholder dan belum diverifikasi, jadi belum dapat dipakai
            sebagai bukti keutuhan data.
          </p>
        )}

      {snapshots.state.status === 'error' && (
        <DataHubErrorMessage error={snapshots.state.error} onRetry={snapshots.retry} />
      )}
      {snapshots.state.status === 'unconfigured' && (
        <p className={`kk-small ${styles.note}`}>Alamat Data Hub belum diatur pada konfigurasi aplikasi.</p>
      )}
    </Surface>
  );
}
