import type { ReactNode } from 'react';
import { StatusMessage, type LoadingIcon } from '@/components/feedback/StatusMessage';
import { ApiError, getIndonesianErrorCopy } from '@/services/api';
import { DataHubErrorMessage } from './DataHubErrorMessage';
import { isLiveBlockedError } from './liveBlocked';
import { useDataHub } from './useDataHub';
import type { ResourceState } from './useDataHubResource';
import styles from './ResourceView.module.css';
import { t } from '@/lib/i18n';

interface ResourceViewProps<T> {
  readonly state: ResourceState<T>;
  readonly onRetry?: (() => void) | undefined;
  readonly loadingTitle: string;
  /** The loading mark (see StatusMessage); the turning ring unless a page asks for another. */
  readonly loadingIcon?: LoadingIcon | undefined;
  readonly children: (data: T) => ReactNode;
}

/**
 * Renders the distinct states of a Data Hub resource (docs/03 §6.9); only `success` shows data.
 *
 * LIVE being blocked, or the connection failing, is one fact about the page, and `DataHubBanner` states
 * it once. A panel whose own request failed for that reason therefore shows a quiet note instead of
 * repeating the card, which would stack one card per request. Its "Coba lagi" reloads everything that
 * failed.
 */
export function ResourceView<T>({
  state,
  onRetry,
  loadingTitle,
  loadingIcon,
  children,
}: ResourceViewProps<T>) {
  const { dataMode } = useDataHub();

  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <StatusMessage kind="loading" title={loadingTitle} loadingIcon={loadingIcon} />;
    case 'unconfigured':
      return (
        <StatusMessage kind="unavailable" title={t('Data Hub belum dihubungkan')}>
          {t(
            'Alamat Data Hub belum diatur pada konfigurasi aplikasi, jadi tidak ada data yang bisa ditampilkan.',
          )}
        </StatusMessage>
      );
    case 'error':
      if (isLiveBlockedError(state.error, dataMode)) {
        return <QuietNote onRetry={onRetry}>{t('Tidak ada data LIVE untuk ditampilkan di sini.')}</QuietNote>;
      }
      if (state.error instanceof ApiError && state.error.isNetworkFailure) {
        return <QuietNote onRetry={onRetry}>{getIndonesianErrorCopy(state.error)}</QuietNote>;
      }
      return <DataHubErrorMessage error={state.error} onRetry={onRetry} />;
    case 'success':
      return <>{children(state.data)}</>;
  }
}

function QuietNote({
  children,
  onRetry,
}: {
  readonly children: ReactNode;
  readonly onRetry: (() => void) | undefined;
}) {
  return (
    <p className={`kk-small ${styles.liveNote}`}>
      {children}
      {onRetry && (
        <>
          {' '}
          <button type="button" className={styles.retry} onClick={onRetry}>
            {t('Coba lagi')}
          </button>
        </>
      )}
    </p>
  );
}
