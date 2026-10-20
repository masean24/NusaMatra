import { ApiError } from '@/services/api';
import { isLiveBlockedError } from './liveBlocked';

const apiError = (status: number, code: string) => new ApiError(status, code, null, 'network.unavailable');

describe('isLiveBlockedError', () => {
  it('counts the API LIVE 503 as blocked in any mode', () => {
    const live503 = apiError(503, 'LIVE_UNAVAILABLE');
    expect(isLiveBlockedError(live503, 'LIVE')).toBe(true);
    expect(isLiveBlockedError(live503, 'DEMO')).toBe(true);
  });

  it('counts an unreadable response and a DEMO payload for a LIVE request as blocked, in LIVE only', () => {
    for (const code of ['NETWORK_ERROR', 'MODE_MISMATCH']) {
      expect(isLiveBlockedError(apiError(0, code), 'LIVE')).toBe(true);
      expect(isLiveBlockedError(apiError(0, code), 'DEMO')).toBe(false);
    }
  });

  it('leaves every other failure an ordinary error', () => {
    expect(isLiveBlockedError(apiError(500, 'HTTP_ERROR'), 'LIVE')).toBe(false);
    expect(isLiveBlockedError(apiError(404, 'RESOURCE_NOT_FOUND'), 'LIVE')).toBe(false);
    expect(isLiveBlockedError(new Error('boom'), 'LIVE')).toBe(false);
    expect(isLiveBlockedError(null, 'LIVE')).toBe(false);
  });
});
