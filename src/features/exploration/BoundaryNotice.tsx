import { Chip } from '@/components/ui/Chip/Chip';
import { ResourceView, useDataHub, useDataHubResource } from '@/features/data-hub';
import { loadBoundaries } from './boundaryCache';
import { describeBoundaryReadiness } from './boundaryReadiness';
import styles from './BoundaryNotice.module.css';

/**
 * States what the Data Hub's boundary endpoint really returned. In DEMO the map is labelled
 * illustrative because Point geometry is never treated as a polygon; in LIVE the notice names the
 * official source of the polygons the map draws.
 */
export function BoundaryNotice() {
  const { dataMode } = useDataHub();
  const boundaries = useDataHubResource('boundaries-kabupaten', (repository, mode) =>
    loadBoundaries(repository, mode),
  );

  return (
    <div className={styles.notice}>
      {dataMode === 'DEMO' && (
        <Chip tone="warning">Geometri Ilustratif DEMO (Batas Poligon Resmi Belum Tersedia)</Chip>
      )}
      <ResourceView
        state={boundaries.state}
        onRetry={boundaries.retry}
        loadingTitle="Memeriksa data batas wilayah…"
      >
        {(envelope) => {
          const readiness = describeBoundaryReadiness(envelope.data);
          return (
            <>
              {dataMode === 'LIVE' && (
                <Chip tone={readiness.hasPolygons ? 'neutral' : 'warning'}>
                  {readiness.hasPolygons ? 'Batas wilayah resmi (BIG)' : 'Batas wilayah resmi belum tersedia'}
                </Chip>
              )}
              <p className={`kk-small ${styles.detail}`}>{readiness.detail}</p>
            </>
          );
        }}
      </ResourceView>
    </div>
  );
}
