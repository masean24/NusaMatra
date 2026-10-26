import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Chip } from '@/components/ui/Chip/Chip';
import { ResourceView, useDataHub, useDataHubResource } from '@/features/data-hub';
import { ApiError } from '@/services/api';
import { loadBoundaries } from './boundaryCache';
import { describeBoundaryReadiness } from './boundaryReadiness';
import styles from './BoundaryNotice.module.css';

/**
 * States what the Data Hub's boundary endpoint really returned. In DEMO the map is labelled
 * illustrative because Point geometry is never treated as a polygon; in LIVE the notice names the
 * official source of the polygons the map draws. `compact` (over the Jelajahi map): the label stays
 * in view and the full explanation opens on demand.
 */
export function BoundaryNotice({ compact = false }: { readonly compact?: boolean }) {
  const { dataMode } = useDataHub();
  const boundaries = useDataHubResource('boundaries-kabupaten', (repository, mode) =>
    loadBoundaries(repository, mode),
  );

  return (
    <div className={styles.notice} data-compact={compact || undefined}>
      {dataMode === 'DEMO' && (
        <Chip tone="warning">Geometri Ilustratif DEMO (Batas Poligon Resmi Belum Tersedia)</Chip>
      )}
      {dataMode === 'DEMO' &&
      boundaries.state.status === 'error' &&
      isModeMismatch(boundaries.state.error) ? (
        // DEMO only: the request succeeded, but the Data Hub labelled the boundaries as official
        // (REAL_OFFICIAL). The mode guard rejects them (they are never drawn); a retry would get the
        // same answer, so none is offered, and nothing is called "failed to load". In LIVE a mode
        // conflict stays with ResourceView, which reports LIVE as blocked.
        <StatusMessage kind="unavailable" title="Batas wilayah tidak dipakai di mode ini">
          Data Hub mengirim batas berlabel resmi (BIG) untuk mode DEMO. Karena labelnya tidak cocok dengan
          mode, batas itu tidak dipakai dan peta DEMO tetap ilustratif.
        </StatusMessage>
      ) : (
        <ResourceView
          state={boundaries.state}
          onRetry={boundaries.retry}
          loadingTitle="Memeriksa data batas wilayah…"
        >
          {(envelope) => {
            const readiness = describeBoundaryReadiness(envelope.data);
            const detail = <p className={`kk-small ${styles.detail}`}>{readiness.detail}</p>;
            return (
              <>
                {dataMode === 'LIVE' && (
                  <Chip tone={readiness.hasPolygons ? 'neutral' : 'warning'}>
                    {readiness.hasPolygons
                      ? 'Batas wilayah resmi (BIG)'
                      : 'Batas wilayah resmi belum tersedia'}
                  </Chip>
                )}
                {compact ? (
                  <details className={styles.more}>
                    <summary className="kk-small">Tentang batas wilayah</summary>
                    {detail}
                  </details>
                ) : (
                  detail
                )}
              </>
            );
          }}
        </ResourceView>
      )}
    </div>
  );
}

/** The Data Hub answered, but the geometry's own mode label contradicts the response's mode. */
function isModeMismatch(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MODE_MISMATCH';
}
