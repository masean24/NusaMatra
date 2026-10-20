import type { ReactNode } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { ApiError, getIndonesianErrorCopy } from '@/services/api';
import { useDataHub } from './useDataHub';

interface DataHubErrorMessageProps {
  readonly error: unknown;
  readonly onRetry?: (() => void) | undefined;
}

/**
 * One place that words every Data Hub failure. LIVE being unavailable is a blocked state, not an
 * error to retry blindly: nothing is shown in its place, and returning to DEMO is the user's own
 * choice, never an automatic fallback.
 */
export function DataHubErrorMessage({ error, onRetry }: DataHubErrorMessageProps) {
  const { dataMode, setDataMode } = useDataHub();

  const switchToDemo =
    dataMode === 'LIVE' ? (
      <Button
        variant="secondary"
        onClick={() => {
          setDataMode('DEMO');
        }}
      >
        Beralih ke data DEMO
      </Button>
    ) : undefined;

  if (error instanceof ApiError && error.isLiveUnavailable) {
    return (
      <LiveBlocked title="LIVE Belum Tersedia" action={switchToDemo}>
        {getIndonesianErrorCopy(error)}
      </LiveBlocked>
    );
  }

  // The API's LIVE 503 carries no CORS headers (checked 2026-10-21), so a browser reports it as a
  // network failure and the LIVE_UNAVAILABLE body is unreadable. In LIVE mode that still means
  // "no LIVE data": blocked, with nothing substituted.
  if (dataMode === 'LIVE' && error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return (
      <LiveBlocked
        title="LIVE Tidak Dapat Dimuat"
        action={
          <>
            {onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                Coba lagi
              </Button>
            )}
            {switchToDemo}
          </>
        }
      >
        Server tidak mengirim jawaban yang dapat dibaca untuk mode LIVE, kemungkinan karena data LIVE belum
        diverifikasi dan dihubungkan. Tidak ada fallback otomatis ke data DEMO.
      </LiveBlocked>
    );
  }

  return (
    <StatusMessage
      kind="error"
      title="Data belum dapat dimuat"
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Coba lagi
          </Button>
        ) : undefined
      }
    >
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
