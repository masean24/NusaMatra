import { Chip } from '@/components/ui/Chip/Chip';
import { Surface } from '@/components/ui/Surface/Surface';
import { publicConfig } from '@/lib/publicConfig';
import { INDONESIAN_ERROR_COPY } from '@/services/api';
import { DataHubErrorMessage } from './DataHubErrorMessage';
import { DataModeSwitch } from './DataModeSwitch';
import { useDataHub } from './useDataHub';
import { useDataHubResource } from './useDataHubResource';
import styles from './DataHubBanner.module.css';

/**
 * Says which data a page is showing only when there is something to say: DEMO (always labelled),
 * the mode switch where it is enabled (tests), or a Data Hub that cannot be reached. In LIVE with
 * everything working it renders nothing; the data version is not shown (owner decision 2026-10-27).
 * `compact` puts it on one toolbar row.
 */
export function DataHubBanner({ compact = false }: { readonly compact?: boolean }) {
  const { dataMode } = useDataHub();
  const snapshots = useDataHubResource('snapshots', (repository, mode, signal) =>
    repository.getSnapshots(mode, signal),
  );

  const disclaimer = INDONESIAN_ERROR_COPY['data.demo_disclaimer'];
  const showRow = dataMode === 'DEMO' || publicConfig.modeSwitch;
  const problem = snapshots.state.status === 'error' || snapshots.state.status === 'unconfigured';
  if (!showRow && !problem) return null;

  return (
    <Surface
      radius="card"
      className={styles.banner}
      data-compact={compact || undefined}
      aria-label="Sumber dan mode data"
    >
      {showRow && (
        <div className={styles.row}>
          <DataModeSwitch />
          {dataMode === 'DEMO' && <Chip tone="warning">DEMO</Chip>}
          {compact && dataMode === 'DEMO' && <span className="kk-small kk-body-strong">{disclaimer}</span>}
        </div>
      )}

      {!compact && dataMode === 'DEMO' && (
        <p className={`kk-body-strong ${styles.disclaimer}`}>{disclaimer}</p>
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
