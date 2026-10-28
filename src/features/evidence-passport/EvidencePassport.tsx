import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { isLiveBlockedError, useDataHub } from '@/features/data-hub';
import { ApiError, getIndonesianErrorCopy, type DataMode } from '@/services/api';
import { buildCompositeRecord } from './buildCompositeRecord';
import { buildEvidenceRecord } from './buildEvidenceRecord';
import { CompositeDocument } from './CompositeDocument';
import { EvidenceDocument } from './EvidenceDocument';
import {
  parseEvidenceQuery,
  regionIdsOf,
  type ComparisonEvidenceQuery,
  type LabEvidenceQuery,
  type RegionEvidenceQuery,
} from './evidenceQuery';
import { BackButton } from '@/features/navigation';
import { InvalidLink } from './PassportMessages';
import { useCompositeSources, useEvidenceSources } from './useEvidenceSources';
import type { SourcesState } from './useSourceLoader';

/** Why a pinned passport could not be made, by error code; `null` for any other failure. */
function snapshotFailureCopy(code: string): { readonly title: string; readonly body: string } | null {
  switch (code) {
    case 'SNAPSHOT_NOT_FOUND':
      return {
        title: 'Versi data pada tautan tidak tersedia',
        body: 'Data Hub tidak lagi menyimpan versi data yang disebut tautan ini (versi data lama dapat hilang setelah pembaruan server).',
      };
    case 'SNAPSHOT_NOT_REPRODUCIBLE':
      return {
        title: 'Versi data pada tautan tidak dapat direproduksi',
        body: 'Data Hub menyatakan versi data pada tautan ini tidak dapat direproduksi, dan versi data itu bukan lagi versi data aktif.',
      };
    case 'SNAPSHOT_MODE_MISMATCH':
      return {
        title: 'Versi data pada tautan berasal dari mode lain',
        body: 'Versi data pada tautan ini milik mode data yang berbeda (DEMO/LIVE).',
      };
    case 'SNAPSHOT_MISMATCH':
    case 'SNAPSHOT_DIGEST_MISMATCH':
      return {
        title: 'Respons tidak berasal dari versi data yang dikunci',
        body: 'Salah satu respons Data Hub membawa ID versi data atau sidik isi data (SHA-256) yang berbeda dari versi data yang dikunci, jadi tidak dipakai.',
      };
    default:
      return null;
  }
}

function LoadFailure({
  error,
  mode,
  onRetry,
}: {
  readonly error: unknown;
  readonly mode: DataMode;
  readonly onRetry: () => void;
}) {
  const retry = (
    <Button variant="secondary" onClick={onRetry}>
      Coba lagi
    </Button>
  );
  if (isLiveBlockedError(error, mode)) {
    return (
      <StatusMessage
        kind="unavailable"
        title="Data LIVE tidak dapat dimuat, Paspor Bukti tidak dibuat"
        action={retry}
      >
        Data Hub tidak memberi jawaban LIVE yang dapat dibaca. Paspor tidak dibuat dari data DEMO sebagai
        pengganti.
      </StatusMessage>
    );
  }
  const snapshotFailure = error instanceof ApiError ? snapshotFailureCopy(error.code) : null;
  if (snapshotFailure) {
    return (
      <StatusMessage kind="error" title={snapshotFailure.title} action={retry}>
        {snapshotFailure.body} Paspor tidak beralih diam-diam ke snapshot terbaru.
      </StatusMessage>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <StatusMessage kind="empty" title="Wilayah tidak ditemukan" action={retry}>
        Data Hub tidak mengenal salah satu kode wilayah pada tautan ini untuk snapshot yang aktif.
      </StatusMessage>
    );
  }
  if (!(error instanceof ApiError) || error.code === 'MALFORMED_ENVELOPE') {
    return (
      <StatusMessage kind="error" title="Respons Data Hub ditolak" action={retry}>
        Respons Data Hub tidak sesuai kontrak data yang diharapkan, jadi tidak dipakai. Paspor Bukti tidak
        dibuat dari respons yang tidak dapat dipercaya.
      </StatusMessage>
    );
  }
  return (
    <StatusMessage kind="error" title="Paspor Bukti belum dapat dibuat" action={retry}>
      {getIndonesianErrorCopy(error)}
    </StatusMessage>
  );
}

/** Breadcrumb and page title for every state without a record (the record's hero has its own). */
function WithoutRecord({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <BackButton />
      <h1 className="kk-h1">Paspor Bukti</h1>
      {children}
    </>
  );
}

/** The message for every state except "ready"; `null` when there is data to render. */
function stateMessage(state: SourcesState<unknown>, mode: DataMode, onRetry: () => void): ReactNode {
  const message = stateBody(state, mode, onRetry);
  return message === null ? null : <WithoutRecord>{message}</WithoutRecord>;
}

function stateBody(state: SourcesState<unknown>, mode: DataMode, onRetry: () => void): ReactNode {
  switch (state.status) {
    case 'idle':
      return <></>;
    case 'unconfigured':
      return (
        <StatusMessage kind="unavailable" title="Data Hub belum dihubungkan">
          Alamat Data Hub belum diatur pada konfigurasi aplikasi, jadi Paspor Bukti tidak dapat dibuat.
        </StatusMessage>
      );
    case 'loading':
      return <StatusMessage kind="loading" title="Merangkai Paspor Bukti dari Data Hub…" />;
    case 'error':
      return <LoadFailure error={state.error} mode={mode} onRetry={onRetry} />;
    case 'ready':
      return null;
  }
}

/**
 * The link may name a mode; otherwise the app's current mode. Either way the record shows the mode
 * the Data Hub answered with, never the mode in the link.
 */
function useRequestedMode(query: { readonly mode?: DataMode | null | undefined }): DataMode {
  const { dataMode } = useDataHub();
  return query.mode ?? dataMode;
}

/** Region and comparison passports: fetch, assemble in the browser, render. */
function LoadedPassport({ query }: { readonly query: RegionEvidenceQuery | ComparisonEvidenceQuery }) {
  const mode = useRequestedMode(query);
  const { state, retry } = useEvidenceSources(regionIdsOf(query), mode, query.snapshotId, true);
  const record = useMemo(
    () => (state.status === 'ready' ? buildEvidenceRecord(query, state.sources) : null),
    [state, query],
  );
  return stateMessage(state, mode, retry) ?? (record ? <EvidenceDocument record={record} /> : null);
}

/** Lab passports: the same composite query Lab Prioritas makes, then the shared integrity check. */
function LoadedLabPassport({ query }: { readonly query: LabEvidenceQuery }) {
  const mode = useRequestedMode(query);
  const { state, retry } = useCompositeSources(
    query.weights,
    query.provinceId ?? null,
    mode,
    query.snapshotId,
    true,
  );
  const record = useMemo(
    () => (state.status === 'ready' ? buildCompositeRecord(query, state.sources) : null),
    [state, query],
  );
  return stateMessage(state, mode, retry) ?? (record ? <CompositeDocument record={record} /> : null);
}

/**
 * Paspor Bukti page body. Reads its request from the address (see `passportHref`), then fetches and
 * assembles the evidence itself; nothing in the address is trusted as data.
 */
export function EvidencePassport() {
  const [params] = useSearchParams();
  const parsed = useMemo(() => parseEvidenceQuery(params), [params]);

  if (!parsed.ok) {
    return (
      <WithoutRecord>
        <InvalidLink message={parsed.message} />
      </WithoutRecord>
    );
  }
  if (parsed.query.kind === 'lab') return <LoadedLabPassport key={params.toString()} query={parsed.query} />;
  return <LoadedPassport key={params.toString()} query={parsed.query} />;
}
