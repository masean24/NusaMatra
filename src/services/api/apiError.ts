// Nusa Matra Data Hub adapter.

export type ApiErrorCode =
  | 'INVALID_JSON'
  | 'NON_JSON_RESPONSE'
  | 'EMPTY_RESPONSE'
  | 'MALFORMED_ENVELOPE'
  | 'APPLICATION_ERROR_STATUS'
  | 'INVALID_SERVER_MODE'
  | 'MISSING_SNAPSHOT_ID'
  | 'MODE_MISMATCH'
  | 'LIVE_UNAVAILABLE'
  | 'WEIGHT_VALIDATION_ERROR'
  | 'WEIGHT_SUM_INVALID'
  | 'WEIGHTS_INVALID'
  | 'FIELD_VALIDATION_FAILED'
  | 'RESOURCE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'REQUEST_ABORTED'
  | 'HTTP_ERROR';

export interface ApiErrorMetadata {
  readonly serverMessage?: string | null;
  readonly fallbackHeader?: string | null;
  readonly serverModeHeader?: string | null;
  readonly validationLocations?: readonly string[];
  readonly cause?: unknown;
}

/**
 * Canonical transport and contract validation error for Nusa Matra Data Hub.
 * Note: serverRequestId is strictly null unless the backend returned an X-Request-ID header
 * or explicit problem+json requestId field (SOURCE 4 Errata #1).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly serverRequestId: string | null;
  readonly messageId: string;
  readonly serverMessage: string | null;
  readonly fallbackHeader: string | null;
  readonly serverModeHeader: string | null;
  readonly validationLocations: readonly string[];

  constructor(
    status: number,
    code: string,
    serverRequestId: string | null,
    messageId: string,
    metadata: ApiErrorMetadata = {},
  ) {
    super(
      metadata.serverMessage
        ? `${code} (HTTP ${status}): ${metadata.serverMessage}`
        : `${code} (HTTP ${status})`,
    );
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.serverRequestId = serverRequestId;
    this.messageId = messageId;
    this.serverMessage = metadata.serverMessage ?? null;
    this.fallbackHeader = metadata.fallbackHeader ?? null;
    this.serverModeHeader = metadata.serverModeHeader ?? null;
    this.validationLocations = metadata.validationLocations ?? [];

    if (metadata.cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        value: metadata.cause,
        enumerable: false,
        configurable: true,
      });
    }
  }

  get isLiveUnavailable(): boolean {
    return this.code === 'LIVE_UNAVAILABLE' || (this.status === 503 && this.fallbackHeader === 'UNAVAILABLE');
  }

  get isAborted(): boolean {
    return this.code === 'REQUEST_ABORTED';
  }

  get isValidationError(): boolean {
    return (
      this.status === 422 ||
      this.code === 'WEIGHT_VALIDATION_ERROR' ||
      this.code === 'WEIGHT_SUM_INVALID' ||
      this.code === 'WEIGHTS_INVALID' ||
      this.code === 'FIELD_VALIDATION_FAILED'
    );
  }
}

const NETWORK_UNAVAILABLE_COPY = 'Koneksi sedang bermasalah. Silakan coba lagi.';

/**
 * Localized Bahasa Indonesia user-facing copy lookup for error messageIds.
 * Matches docs/08-API-SPECIFICATION.md Section 15.3 plus LIVE 503 gate copy.
 */
export const INDONESIAN_ERROR_COPY: Readonly<Record<string, string>> = {
  'data.demo_disclaimer': 'Simulasi — bukan data atau rekomendasi resmi.',
  'data.live_unavailable':
    'Mode LIVE belum tersedia karena sumber data resmi belum diverifikasi dan dihubungkan. Tidak ada fallback otomatis ke data DEMO.',
  'data.no_observation': 'Data untuk wilayah dan periode ini belum tersedia.',
  'data.suppressed': 'Nilai tidak dipublikasikan oleh sumber.',
  'comparison.definition_incompatible': 'Indikator ini tidak dapat dibandingkan karena definisinya berbeda.',
  'comparison.year_warning': 'Tahun data berbeda. Baca catatan sebelum menyimpulkan.',
  'analysis.weight_sum_invalid': 'Total bobot harus 100% (10.000 basis poin).',
  'analysis.weights_invalid':
    'Konfigurasi bobot indikator tidak valid. Gunakan bilangan bulat positif dengan total 10.000 basis poin.',
  'analysis.model_not_approved': 'Metode analisis belum tersedia untuk data resmi.',
  'analysis.running': 'Menghitung hasil berdasarkan bobot terpilih…',
  'analysis.stale': 'Hasil sebelumnya — menunggu perhitungan terbaru.',
  'analysis.blocked': 'Sebagian wilayah tidak dapat dihitung karena data belum memenuhi syarat.',
  'quality.audit_not_run': 'Pemeriksaan kualitas data belum dijalankan.',
  'evidence.not_ready': 'Paspor Bukti masih disiapkan.',
  'network.unavailable': NETWORK_UNAVAILABLE_COPY,
  'request.aborted': 'Permintaan dibatalkan karena ada pembaruan pilihan.',
};

export function getIndonesianErrorCopy(error: unknown): string {
  if (error instanceof ApiError) {
    return INDONESIAN_ERROR_COPY[error.messageId] ?? NETWORK_UNAVAILABLE_COPY;
  }
  return NETWORK_UNAVAILABLE_COPY;
}

/**
 * Maps any HTTP error payload observed from FastAPI v0.1.0 into a structured ApiError:
 * 1. Top-level error object: 503 { status: "error", code: "LIVE_UNAVAILABLE", message: "..." }
 * 2. Nested FastAPI detail object: 422 { detail: { status: "error", code: "WEIGHT_VALIDATION_ERROR", message: "..." } }
 * 3. Standard FastAPI Pydantic array: 422 { detail: [{ loc: [...], msg: "...", type: "..." }] }
 * 4. RFC 9457 Problem JSON: { type, title, status, code, messageId, requestId }
 * 5. String detail or unknown fallback
 */
export function mapHttpErrorResponse(
  status: number,
  body: unknown,
  headers: {
    readonly requestId: string | null;
    readonly dataFallback: string | null;
    readonly serverMode: string | null;
  },
): ApiError {
  const baseMeta = {
    fallbackHeader: headers.dataFallback,
    serverModeHeader: headers.serverMode,
  };

  if (isRecord(body)) {
    // 1. Check nested { detail: { code, message, status } } (Observed in composite_invalid.json)
    if (isRecord(body.detail)) {
      const nestedCode = readString(body.detail.code);
      const nestedMessage = readString(body.detail.message) ?? readString(body.detail.msg);

      if (nestedCode) {
        const normalizedCode = normalizeErrorCode(status, nestedCode, nestedMessage);
        return new ApiError(
          status,
          normalizedCode,
          headers.requestId,
          inferMessageId(status, normalizedCode, nestedMessage),
          {
            ...baseMeta,
            serverMessage: nestedMessage,
          },
        );
      }
    }

    // 2. Check top-level { code, message, messageId, requestId } (Observed in regions_live.json 503 & RFC 9457)
    const topCode = readString(body.code);
    const topMessage = readString(body.message) ?? readString(body.detail) ?? readString(body.title);
    const bodyRequestId = readString(body.requestId) ?? headers.requestId;

    if (topCode) {
      const normalizedCode = normalizeErrorCode(status, topCode, topMessage);
      const explicitMessageId = readString(body.messageId);
      return new ApiError(
        status,
        normalizedCode,
        bodyRequestId,
        explicitMessageId ?? inferMessageId(status, normalizedCode, topMessage),
        {
          ...baseMeta,
          serverMessage: topMessage,
        },
      );
    }

    // 3. Check standard FastAPI validation error array: { detail: [{ loc, msg, type }] }
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const locations: string[] = [];
      const messages: string[] = [];

      for (const item of body.detail) {
        if (isRecord(item)) {
          if (Array.isArray(item.loc)) {
            locations.push(item.loc.map(String).join('.'));
          }
          const msg = readString(item.msg);
          if (msg) {
            messages.push(msg);
          }
        }
      }

      const combinedMsg = messages.join('; ') || null;
      const touchesWeights = locations.some((loc) => loc.includes('weights'));
      const mentions10000 = combinedMsg !== null && combinedMsg.includes('10000');

      const inferredCode: ApiErrorCode = touchesWeights
        ? mentions10000
          ? 'WEIGHT_SUM_INVALID'
          : 'WEIGHTS_INVALID'
        : 'FIELD_VALIDATION_FAILED';

      return new ApiError(
        status,
        inferredCode,
        headers.requestId,
        inferMessageId(status, inferredCode, combinedMsg),
        {
          ...baseMeta,
          serverMessage: combinedMsg,
          validationLocations: locations,
        },
      );
    }

    // 4. Plain string detail: { detail: "Not Found" }
    const detailString = readString(body.detail);
    if (detailString) {
      const code = inferCodeFromStatus(status, headers.dataFallback);
      return new ApiError(status, code, headers.requestId, inferMessageId(status, code, detailString), {
        ...baseMeta,
        serverMessage: detailString,
      });
    }
  }

  const fallbackCode = inferCodeFromStatus(status, headers.dataFallback);
  return new ApiError(
    status,
    fallbackCode,
    headers.requestId,
    inferMessageId(status, fallbackCode, null),
    baseMeta,
  );
}

function normalizeErrorCode(status: number, rawCode: string, message: string | null): string {
  if (rawCode === 'WEIGHT_VALIDATION_ERROR') {
    if (message && message.includes('10000')) {
      return 'WEIGHT_SUM_INVALID';
    }
    return 'WEIGHT_VALIDATION_ERROR';
  }
  if (rawCode === 'LIVE_UNAVAILABLE') {
    return 'LIVE_UNAVAILABLE';
  }
  if (status === 503 && rawCode === 'SERVICE_UNAVAILABLE') {
    return 'SERVICE_UNAVAILABLE';
  }
  return rawCode;
}

function inferCodeFromStatus(status: number, dataFallbackHeader: string | null): ApiErrorCode {
  if (status === 503 && dataFallbackHeader === 'UNAVAILABLE') {
    return 'LIVE_UNAVAILABLE';
  }
  if (status === 404) return 'RESOURCE_NOT_FOUND';
  if (status === 409) return 'MODE_MISMATCH';
  if (status === 422) return 'FIELD_VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  return 'HTTP_ERROR';
}

function inferMessageId(status: number, code: string, message: string | null): string {
  if (code === 'LIVE_UNAVAILABLE') {
    return 'data.live_unavailable';
  }
  if (code === 'WEIGHT_SUM_INVALID' || (code === 'WEIGHT_VALIDATION_ERROR' && message?.includes('10000'))) {
    return 'analysis.weight_sum_invalid';
  }
  if (code === 'WEIGHT_VALIDATION_ERROR' || code === 'WEIGHTS_INVALID') {
    return 'analysis.weights_invalid';
  }
  if (code === 'MODE_MISMATCH') {
    return 'data.demo_disclaimer';
  }
  if (status === 404 || code === 'RESOURCE_NOT_FOUND') {
    return 'data.no_observation';
  }
  return 'network.unavailable';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
