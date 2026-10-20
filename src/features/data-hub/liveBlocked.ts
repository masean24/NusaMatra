import { ApiError, type DataMode } from '@/services/api';

/**
 * True when a failure means "there is no LIVE data for this request":
 *
 * - the API's LIVE 503 (`LIVE_UNAVAILABLE`);
 * - in LIVE mode, a request the browser could not read: the API sends that 503 without CORS headers,
 *   so it surfaces as a network failure;
 * - in LIVE mode, a DEMO payload answering a LIVE request (`MODE_MISMATCH`, e.g. from a shared
 *   cache): the payload is discarded, never shown.
 *
 * Such a failure is one fact about the page, not one error per request.
 */
export function isLiveBlockedError(error: unknown, dataMode: DataMode): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.isLiveUnavailable) return true;
  return dataMode === 'LIVE' && (error.code === 'NETWORK_ERROR' || error.code === 'MODE_MISMATCH');
}
