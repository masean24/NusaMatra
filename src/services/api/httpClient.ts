// Nusa Matra Data Hub adapter.

import { ApiError, mapHttpErrorResponse } from './apiError';
import type { DataMode } from './wireTypes';

export interface HttpResponseContext {
  readonly status: number;
  readonly requestId: string | null;
  readonly dataFallback: string | null;
  readonly serverMode: string | null;
  readonly clientReceivedAt: string;
}

export interface RuntimeDecoder<T> {
  parse(input: unknown, context: HttpResponseContext): T;
}

export interface RequestOptions {
  readonly dataMode?: DataMode | undefined;
  readonly query?: Readonly<Record<string, string | number | boolean | null | undefined>> | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  /**
   * Browser cache policy. Time-critical feeds pass `no-cache`: the API sends
   * `Cache-Control: max-age=3600` even for data refreshed every minute.
   */
  readonly cache?: RequestCache | undefined;
}

export interface DataHubHttpClientConfig {
  /**
   * API origin such as "https://api.orangkeren.me" or "" for same-origin proxy. Supplied by the
   * caller (the app reads it once in `publicConfig`); this module never reads the environment.
   * If a trailing "/api/v1" or "/" is accidentally supplied, the constructor strips it
   * so "/api/v1" is never duplicated in request URLs.
   */
  readonly baseUrl: string;
  /** Used only when a request names no mode; the repository always names one. */
  readonly defaultDataMode?: DataMode | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
}

/**
 * Low-level HTTP transport for Nusa Matra Data Hub.
 * - Enforces relative "/api/v1/..." paths.
 * - Attaches X-Data-Mode header for strict server-side DEMO/LIVE gating.
 * - Handles AbortSignal, 422 nested errors, 503 LIVE_UNAVAILABLE, and malformed/HTML proxy responses.
 */
export class DataHubHttpClient {
  readonly baseUrl: string;
  readonly defaultDataMode: DataMode;
  private readonly fetchImpl: typeof fetch;

  constructor(config: DataHubHttpClientConfig) {
    this.baseUrl = normalizeBaseOrigin(config.baseUrl);
    this.defaultDataMode = config.defaultDataMode ?? 'DEMO';
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async get<T>(path: string, decoder: RuntimeDecoder<T>, options: RequestOptions = {}): Promise<T> {
    return this.request(path, { method: 'GET' }, decoder, options);
  }

  async post<T>(
    path: string,
    body: unknown,
    decoder: RuntimeDecoder<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.request(
      path,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      decoder,
      options,
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    decoder: RuntimeDecoder<T>,
    options: RequestOptions,
  ): Promise<T> {
    validateRelativeApiPath(path);

    const activeMode: DataMode = options.dataMode ?? this.defaultDataMode;
    // The mode also goes into the URL, after the caller's query so it cannot be overridden. The API
    // answers with `Cache-Control: public` and `Vary: Origin` only, so a request differing just in
    // the X-Data-Mode header is served from the browser cache: a LIVE request got the cached DEMO
    // response (observed 2026-10-21). The API honours `?mode=` on every endpoint and lets it win
    // over the header, so one URL per mode keeps caches and requests apart.
    const queryString = buildQueryString({
      ...options.query,
      mode: activeMode.toLowerCase(),
    });
    const url = `${this.baseUrl}${path}${queryString}`;

    const mergedHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
      ...(options.headers ?? {}),
      'X-Data-Mode': activeMode, // Never let caller overrides bypass DEMO/LIVE gating.
    };

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        ...(options.cache ? { cache: options.cache } : {}),
        signal: options.signal ?? null,
        headers: mergedHeaders,
      });
    } catch (err: unknown) {
      if (isAbortError(err)) {
        throw new ApiError(0, 'REQUEST_ABORTED', null, 'request.aborted', {
          cause: err,
        });
      }
      throw new ApiError(0, 'NETWORK_ERROR', null, 'network.unavailable', {
        serverMessage: err instanceof Error ? err.message : 'Network failure',
        cause: err,
      });
    }

    const context: HttpResponseContext = {
      status: response.status,
      requestId: readHeader(response.headers, 'x-request-id'),
      dataFallback: readHeader(response.headers, 'x-data-fallback'),
      serverMode:
        readHeader(response.headers, 'x-nusamatra-mode') ?? readHeader(response.headers, 'x-data-mode'),
      clientReceivedAt: new Date().toISOString(),
    };

    const rawText = await readResponseTextSafely(response, context);

    if (!response.ok) {
      let parsedErrorBody: unknown = null;
      if (rawText.trim().length > 0) {
        try {
          parsedErrorBody = JSON.parse(rawText);
        } catch {
          parsedErrorBody = null;
        }
      }
      throw mapHttpErrorResponse(response.status, parsedErrorBody, {
        requestId: context.requestId,
        dataFallback: context.dataFallback,
        serverMode: context.serverMode,
      });
    }

    if (rawText.trim().length === 0) {
      throw new ApiError(response.status, 'EMPTY_RESPONSE', context.requestId, 'network.unavailable', {
        serverMessage: 'Received empty HTTP response body on 2xx status',
      });
    }

    const contentType = readHeader(response.headers, 'content-type') ?? '';
    if (
      contentType.includes('text/html') ||
      rawText.trimStart().startsWith('<!DOCTYPE') ||
      rawText.trimStart().startsWith('<html')
    ) {
      throw new ApiError(response.status, 'NON_JSON_RESPONSE', context.requestId, 'network.unavailable', {
        serverMessage: 'Expected application/json but received HTML response',
      });
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawText);
    } catch (err: unknown) {
      throw new ApiError(response.status, 'INVALID_JSON', context.requestId, 'network.unavailable', {
        serverMessage: 'Failed to parse JSON response body',
        cause: err,
      });
    }

    // Check if the server returned HTTP 200 with a header mode that violates the requested mode
    if (
      context.serverMode &&
      (context.serverMode === 'DEMO' || context.serverMode === 'LIVE') &&
      context.serverMode !== activeMode
    ) {
      throw new ApiError(
        409,
        'MODE_MISMATCH',
        context.requestId,
        activeMode === 'LIVE' ? 'data.live_unavailable' : 'data.demo_disclaimer',
        {
          serverModeHeader: context.serverMode,
          fallbackHeader: context.dataFallback,
          serverMessage: `Requested mode ${activeMode} but server header reported ${context.serverMode}`,
        },
      );
    }

    return decoder.parse(parsedPayload, context);
  }
}

/**
 * Strips trailing slashes and any accidental "/api/v1" suffix from baseUrl
 * so paths like "/api/v1/regions" never resolve to "/api/v1/api/v1/regions".
 */
export function normalizeBaseOrigin(rawBaseUrl: string): string {
  let cleaned = rawBaseUrl.trim().replace(/\/+$/, '');
  if (cleaned.endsWith('/api/v1')) {
    cleaned = cleaned.slice(0, -'/api/v1'.length).replace(/\/+$/, '');
  }
  return cleaned;
}

export function validateRelativeApiPath(path: string): void {
  if (!path.startsWith('/api/v1/') || path.startsWith('//')) {
    throw new Error(`DataHubHttpClient requires a relative "/api/v1/..." path, received: "${path}"`);
  }
}

export function buildQueryString(
  entries?: Readonly<Record<string, string | number | boolean | null | undefined>>,
): string {
  if (!entries) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function readResponseTextSafely(response: Response, context: HttpResponseContext): Promise<string> {
  try {
    return await response.text();
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw new ApiError(0, 'REQUEST_ABORTED', context.requestId, 'request.aborted', { cause: err });
    }
    throw new ApiError(response.status, 'NETWORK_ERROR', context.requestId, 'network.unavailable', {
      serverMessage: 'Failed reading HTTP response stream',
      cause: err,
    });
  }
}

function readHeader(headers: Headers, name: string): string | null {
  const val = headers.get(name);
  return val && val.trim().length > 0 ? val.trim() : null;
}

function isAbortError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'name' in err) {
    return (err as { name?: unknown }).name === 'AbortError';
  }
  return false;
}
