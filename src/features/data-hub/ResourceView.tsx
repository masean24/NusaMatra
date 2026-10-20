import type { ReactNode } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { DataHubErrorMessage } from './DataHubErrorMessage';
import { isLiveBlockedError } from './liveBlocked';
import { useDataHub } from './useDataHub';
import type { ResourceState } from './useDataHubResource';
import styles from './ResourceView.module.css';

interface ResourceViewProps<T> {
  readonly state: ResourceState<T>;
  readonly onRetry?: (() => void) | undefined;
  readonly loadingTitle: string;
  readonly children: (data: T) => ReactNode;
}

/**
 * Renders the distinct states of a Data Hub resource (docs/03 §6.9); only `success` shows data.
 *
 * LIVE being blocked is stated once per page, by `DataHubBanner`. A panel whose own request failed
 * for that reason therefore shows a quiet note instead of repeating the unavailable card, which
 * would stack one card per request.
 */
export function ResourceView<T>({ state, onRetry, loadingTitle, children }: ResourceViewProps<T>) {
  const { dataMode } = useDataHub();

  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <StatusMessage kind="loading" title={loadingTitle} />;
    case 'unconfigured':
      return (
        <StatusMessage kind="unavailable" title="Data Hub belum dihubungkan">
          Alamat Data Hub belum diatur pada konfigurasi aplikasi, jadi tidak ada data yang bisa ditampilkan.
        </StatusMessage>
      );
    case 'error':
      return isLiveBlockedError(state.error, dataMode) ? (
        <p className={`kk-small ${styles.liveNote}`}>Tidak ada data LIVE untuk ditampilkan di sini.</p>
      ) : (
        <DataHubErrorMessage error={state.error} onRetry={onRetry} />
      );
    case 'success':
      return <>{children(state.data)}</>;
  }
}
