import { useCallback, useMemo, useRef, useState, type Ref, type RefObject } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { DEMO_GEO_REGIONS } from '@/data/fixtures/demoGeoRegions';
import {
  Explore3DMapSlot,
  type GeoCameraHandle,
  type GeoOverlayPoint,
  type GeoRegionSelection,
} from '@/features/geo3d';
import { ResourceView, useDataHub, useDataHubResource } from '@/features/data-hub';
import type { BoundaryCollectionDTO } from '@/services/api';
import { loadBoundaries } from './boundaryCache';
import { buildLiveGeography } from './liveGeography';
import { useRegionBrowserParams } from './regionCode';
import { useRegionSelection } from './regionSelection';
import styles from './ExplorationMapPanel.module.css';

/**
 * No verified geography exists until the Data Hub is connected. `null` tells the engine to show
 * its labelled DEMO illustration (allowed only in DEMO mode); no regions or values are invented.
 */
const NO_VERIFIED_GEOGRAPHY = null;

/**
 * Map workspace for Peta Utama and Jelajahi: the host owns selection, data and navigation.
 * DEMO shows the labelled illustration; LIVE draws only the official boundaries the Data Hub sent.
 */
export function ExplorationMapPanel({
  cameraRef,
  onLiveSelect,
  overlay,
  viewInsetLeft,
  immersive = false,
}: ExplorationMapPanelProps = {}) {
  const { dataMode } = useDataHub();
  return dataMode === 'LIVE' ? (
    <LiveMapWorkspace
      cameraRef={cameraRef}
      onSelect={onLiveSelect}
      overlay={overlay}
      viewInsetLeft={viewInsetLeft}
      immersive={immersive}
    />
  ) : (
    <DemoMapWorkspace cameraRef={cameraRef} viewInsetLeft={viewInsetLeft} immersive={immersive} />
  );
}

interface ExplorationMapPanelProps {
  /** Lets the page fly the camera to a region chosen elsewhere, zoom it and reset it. */
  readonly cameraRef?: Ref<GeoCameraHandle> | undefined;
  /** Called with the code and name of a region picked on the LIVE map, so the page can show its name at once. */
  readonly onLiveSelect?: ((code: string, name: string) => void) | undefined;
  /** Points over the LIVE map (the BMKG earthquake layer); updating them never rebuilds the regions. */
  readonly overlay?: MapOverlay | undefined;
  /** Pixels of the map covered on the left by a floating panel; the view is centred beside it. */
  readonly viewInsetLeft?: number | undefined;
  /**
   * Full-screen host (Jelajahi): the map fills its box edge to edge, and the DEMO list of
   * illustrative regions floats over it as a small disclosure instead of following below.
   */
  readonly immersive?: boolean | undefined;
}

/** Hands a camera handle to the page's ref as well as to the panel's own. */
function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/** Clickable points over the map and their selection, owned by the page. */
export interface MapOverlay {
  readonly points: readonly GeoOverlayPoint[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

/** LIVE: the 3D map is fed BIG polygons, and its selection is the same `?kode=` the region list uses. */
function LiveMapWorkspace({
  cameraRef: sharedCameraRef,
  onSelect,
  overlay,
  viewInsetLeft,
  immersive,
}: {
  readonly cameraRef: Ref<GeoCameraHandle> | undefined;
  readonly onSelect: ((code: string, name: string) => void) | undefined;
  readonly overlay: MapOverlay | undefined;
  readonly viewInsetLeft: number | undefined;
  readonly immersive: boolean;
}) {
  const { selectedCode, selectCode } = useRegionBrowserParams();
  const boundaries = useDataHubResource('boundaries-kabupaten', (repository, dataMode) =>
    loadBoundaries(repository, dataMode),
  );
  // The panel steers the camera on a map click; the page keeps the same handle for its own buttons.
  const cameraRef = useRef<GeoCameraHandle | null>(null);
  const handleCamera = useCallback(
    (handle: GeoCameraHandle | null) => {
      cameraRef.current = handle;
      assignRef(sharedCameraRef, handle);
    },
    [sharedCameraRef],
  );
  // A click flies to the region; a second click on the selected region unselects it and returns
  // to the overview.
  const handleSelect = useCallback(
    (code: string, name: string) => {
      if (code === selectedCode) {
        selectCode(null);
        cameraRef.current?.resetView();
        return;
      }
      selectCode(code);
      cameraRef.current?.focusRegion(code);
      onSelect?.(code, name);
    },
    [selectedCode, selectCode, onSelect],
  );

  return (
    <div className={styles.workspace} data-immersive={immersive || undefined}>
      {boundaries.state.status === 'loading' ? (
        // The map's own size, so the page does not jump when the map replaces this.
        <div className={`${styles.map} ${styles.loadingFrame}`}>
          <StatusMessage kind="loading" title="Mengunduh batas wilayah resmi…">
            Sekitar 5 MB dari BIG lewat Data Hub; hanya sekali per sesi.
          </StatusMessage>
        </div>
      ) : (
        <ResourceView
          state={boundaries.state}
          onRetry={boundaries.retry}
          loadingTitle="Memuat batas wilayah resmi…"
        >
          {(envelope) => (
            <LiveMap
              boundaries={envelope.data}
              snapshotId={envelope.meta.snapshotId}
              selectedCode={selectedCode}
              onSelect={handleSelect}
              cameraRef={handleCamera}
              overlay={overlay}
              viewInsetLeft={viewInsetLeft}
            />
          )}
        </ResourceView>
      )}
    </div>
  );
}

interface LiveMapProps {
  readonly boundaries: BoundaryCollectionDTO;
  readonly snapshotId: string;
  readonly selectedCode: string | null;
  readonly onSelect: (code: string, name: string) => void;
  readonly cameraRef: Ref<GeoCameraHandle>;
  readonly overlay: MapOverlay | undefined;
  readonly viewInsetLeft: number | undefined;
}

/**
 * The geography object is what the 3D engine validates and turns into meshes, so its identity must
 * only change when the boundaries do. Rebuilt on every selection it re-created all 514 regions'
 * geometry per click (~2,000 buffer uploads, ~0.5 s).
 */
function LiveMap({
  boundaries,
  snapshotId,
  selectedCode,
  onSelect,
  cameraRef,
  overlay,
  viewInsetLeft,
}: LiveMapProps) {
  const geography = useMemo(() => buildLiveGeography(boundaries, snapshotId), [boundaries, snapshotId]);
  const handleSelect = useCallback(
    (selection: GeoRegionSelection) => {
      onSelect(selection.regionId, selection.displayName);
    },
    [onSelect],
  );

  return geography ? (
    <Explore3DMapSlot
      dataMode="LIVE"
      geography={geography}
      selectedRegionId={selectedCode}
      onRegionSelect={handleSelect}
      cameraRef={cameraRef}
      overlayPoints={overlay?.points}
      selectedOverlayId={overlay?.selectedId ?? null}
      onOverlaySelect={overlay?.onSelect}
      viewInsetLeft={viewInsetLeft}
      className={styles.map}
    />
  ) : (
    <StatusMessage kind="unavailable" title="Batas wilayah resmi tidak dapat dipakai">
      Data Hub tidak mengirim poligon batas resmi untuk snapshot ini, jadi peta tidak ditampilkan. Pilih
      wilayah dari daftar.
    </StatusMessage>
  );
}

function DemoMapWorkspace({
  cameraRef: sharedCameraRef,
  viewInsetLeft,
  immersive,
}: {
  readonly cameraRef: Ref<GeoCameraHandle> | undefined;
  readonly viewInsetLeft: number | undefined;
  readonly immersive: boolean;
}) {
  const { selectedRegionId, selectRegion, clearRegion } = useRegionSelection();
  const [lastSelection, setLastSelection] = useState<GeoRegionSelection | null>(null);
  const cameraRef: RefObject<GeoCameraHandle | null> = useRef<GeoCameraHandle>(null);
  // The panel steers the camera from its own list; the page drives the same camera's zoom and reset.
  const handleCamera = useCallback(
    (handle: GeoCameraHandle | null) => {
      cameraRef.current = handle;
      assignRef(sharedCameraRef, handle);
    },
    [sharedCameraRef],
  );

  // The URL only carries the id; the readable name is known for selections made in this visit.
  const selectedName =
    lastSelection && lastSelection.regionId === selectedRegionId
      ? lastSelection.displayName
      : selectedRegionId;

  const handleSelect = (selection: GeoRegionSelection) => {
    setLastSelection(selection);
    selectRegion(selection.regionId);
  };

  // Keyboard and screen-reader alternative to clicking the map (handoff requirement).
  const handleListSelect = (regionId: string, displayName: string) => {
    handleSelect({ regionId, displayName, boundaryEditionId: 'demo', dataMode: 'DEMO' });
    cameraRef.current?.focusRegion(regionId);
  };

  const handleClear = () => {
    clearRegion();
    cameraRef.current?.resetView();
  };

  // A map click flies to the region; a second click on the selected one unselects it and zooms out.
  const handleMapSelect = (selection: GeoRegionSelection) => {
    if (selection.regionId === selectedRegionId) {
      handleClear();
      return;
    }
    handleSelect(selection);
    cameraRef.current?.focusRegion(selection.regionId);
  };

  const selection = (
    <>
      <Chip>Mode data: simulasi (DEMO)</Chip>
      <fieldset className={styles.regionList}>
        <legend className="kk-body-strong">Pilih wilayah ilustratif</legend>
        <ul role="list" className={styles.regionItems}>
          {DEMO_GEO_REGIONS.map((region) => (
            <li key={region.regionId}>
              <button
                type="button"
                className={styles.regionButton}
                aria-pressed={region.regionId === selectedRegionId}
                onClick={() => {
                  handleListSelect(region.regionId, region.displayName);
                }}
              >
                {region.displayName}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      {selectedRegionId ? (
        <StatusMessage
          kind="unavailable"
          title={`${selectedName ?? selectedRegionId} dipilih`}
          action={
            <Button variant="secondary" onClick={handleClear}>
              Hapus pilihan
            </Button>
          }
        >
          Ini wilayah ilustratif untuk demonstrasi. Data indikator belum tersedia karena katalog wilayah resmi
          belum terhubung.
        </StatusMessage>
      ) : (
        <StatusMessage kind="empty" title="Belum ada wilayah dipilih">
          Klik salah satu pulau di peta 3D, atau pilih dari daftar di atas.
        </StatusMessage>
      )}
    </>
  );

  return (
    <div className={styles.workspace} data-immersive={immersive || undefined}>
      <Explore3DMapSlot
        dataMode="DEMO"
        className={styles.map}
        geography={NO_VERIFIED_GEOGRAPHY}
        selectedRegionId={selectedRegionId}
        onRegionSelect={handleMapSelect}
        cameraRef={handleCamera}
        viewInsetLeft={viewInsetLeft}
      />
      {immersive ? (
        // Over a full-screen map the list folds into a small labelled disclosure in a corner.
        <details className={styles.selectionFloat}>
          <summary className={styles.selectionSummary}>
            <span className="kk-body-strong">Wilayah ilustratif (DEMO)</span>
            <span className="kk-small">{selectedName ?? 'belum dipilih'}</span>
          </summary>
          <div className={styles.selection}>{selection}</div>
        </details>
      ) : (
        <div className={styles.selection}>{selection}</div>
      )}
    </div>
  );
}
