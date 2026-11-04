import { ApiError, type DataMode } from '@/services/api';

/**
 * True when a failure means "there is no LIVE data for this request":
 *
 * - the API's LIVE 503 (`LIVE_UNAVAILABLE`);
 * - in LIVE mode, a DEMO payload answering a LIVE request (`MODE_MISMATCH`, e.g. from a shared
 *   cache): the payload is discarded, never shown.
 *
 * Such a failure is one fact about the page, not one error per request. A request that got no
 * readable answer is NOT one of these: it says nothing about the data, only about the connection
 * (`ApiError.isNetworkFailure`). The Data Hub's error responses carry CORS headers, so a real LIVE 503
 * can be read as such.
 */
export function isLiveBlockedError(error: unknown, dataMode: DataMode): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.isLiveUnavailable) return true;
  return dataMode === 'LIVE' && error.code === 'MODE_MISMATCH';
}
