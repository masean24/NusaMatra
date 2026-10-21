import { Chip } from '@/components/ui/Chip/Chip';
import { ResourceView, useDataHubResource } from '@/features/data-hub';
import { describeBoundaryReadiness } from './boundaryReadiness';
import styles from './BoundaryNotice.module.css';

/**
 * Labels the 3D map as illustrative and states what the Data Hub's boundary endpoint really
 * returned. Nothing here is passed to the map: Point geometry is never treated as a polygon.
 */
export function BoundaryNotice() {
  const boundaries = useDataHubResource('boundaries-kabupaten', (repository, dataMode, signal) =>
    repository.getBoundaries({ dataMode, adminLevel: 'REGENCY', signal }),
  );

  return (
    <div className={styles.notice}>
      <Chip tone="warning">Geometri Ilustratif DEMO (Batas Poligon Resmi Belum Tersedia)</Chip>
      <ResourceView
        state={boundaries.state}
        onRetry={boundaries.retry}
        loadingTitle="Memeriksa data batas wilayah…"
      >
        {(envelope) => (
          <p className={`kk-small ${styles.detail}`}>{describeBoundaryReadiness(envelope.data).detail}</p>
        )}
      </ResourceView>
    </div>
  );
}
