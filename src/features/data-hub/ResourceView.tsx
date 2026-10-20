import type { ReactNode } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { DataHubErrorMessage } from './DataHubErrorMessage';
import type { ResourceState } from './useDataHubResource';

interface ResourceViewProps<T> {
  readonly state: ResourceState<T>;
  readonly onRetry?: (() => void) | undefined;
  readonly loadingTitle: string;
  readonly children: (data: T) => ReactNode;
}

/** Renders the distinct states of a Data Hub resource (docs/03 §6.9); only `success` shows data. */
export function ResourceView<T>({ state, onRetry, loadingTitle, children }: ResourceViewProps<T>) {
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
      return <DataHubErrorMessage error={state.error} onRetry={onRetry} />;
    case 'success':
      return <>{children(state.data)}</>;
  }
}
