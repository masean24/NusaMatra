import type { ReactNode } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { ApiError, getIndonesianErrorCopy } from '@/services/api';
import { isLiveBlockedError } from './liveBlocked';
import { useDataHub } from './useDataHub';
import styles from './DataHubErrorMessage.module.css';

interface DataHubErrorMessageProps {
  readonly error: unknown;
  readonly onRetry?: (() => void) | undefined;
}

/**
 * One place that words every Data Hub failure. LIVE having no data is a blocked state, not an
 * error to retry blindly: nothing is shown in its place, and returning to DEMO is the user's own
 * choice, never an automatic fallback.
 *
 * The page's single primary LIVE message comes from here via `DataHubBanner`; panels use
 * `ResourceView`, which shows a quiet note for the same failure.
 */
export function DataHubErrorMessage({ error, onRetry }: DataHubErrorMessageProps) {
  const { dataMode, setDataMode } = useDataHub();

  const retry = onRetry ? (
    <Button variant="secondary" onClick={onRetry}>
      Coba lagi
    </Button>
  ) : undefined;

  if (isLiveBlockedError(error, dataMode) && error instanceof ApiError) {
    const switchToDemo = (
      <Button
        variant="secondary"
        onClick={() => {
          setDataMode('DEMO');
        }}
      >
        Beralih ke data DEMO
      </Button>
    );

    // The API's LIVE 503 carries no CORS headers (checked 2026-10-21), so a browser reports it as a
    // network failure and the LIVE_UNAVAILABLE body is unreadable. It still means "no LIVE data".
    if (error.code === 'NETWORK_ERROR') {
      return (
        <LiveBlocked
          title="LIVE Tidak Dapat Dimuat"
          action={
            <span className={styles.actions}>
              {retry}
              {switchToDemo}
            </span>
          }
        >
          Server tidak mengirim jawaban yang dapat dibaca untuk mode LIVE, kemungkinan karena data LIVE belum
          diverifikasi dan dihubungkan. Tidak ada fallback otomatis ke data DEMO.
        </LiveBlocked>
      );
    }

    if (error.code === 'MODE_MISMATCH') {
      return (
        <LiveBlocked title="LIVE Belum Tersedia" action={switchToDemo}>
          Server menjawab permintaan LIVE dengan data DEMO, jadi data itu dibuang dan tidak ditampilkan. Tidak
          ada fallback otomatis ke data DEMO.
        </LiveBlocked>
      );
    }

    return (
      <LiveBlocked title="LIVE Belum Tersedia" action={switchToDemo}>
        {getIndonesianErrorCopy(error)}
      </LiveBlocked>
    );
  }

  return (
    <StatusMessage kind="error" title="Data belum dapat dimuat" action={retry}>
      {getIndonesianErrorCopy(error)}
    </StatusMessage>
  );
}

function LiveBlocked({
  title,
  action,
  children,
}: {
  readonly title: string;
  readonly action: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <StatusMessage kind="unavailable" title={title} action={action}>
      {children}
    </StatusMessage>
  );
}
