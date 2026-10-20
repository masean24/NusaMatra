import { useRef, useState } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { Button } from '@/components/ui/Button/Button';
import { Chip } from '@/components/ui/Chip/Chip';
import { DEMO_GEO_REGIONS } from '@/data/fixtures/demoGeoRegions';
import { Explore3DMapSlot, type GeoCameraHandle, type GeoRegionSelection } from '@/features/geo3d';
import { publicConfig } from '@/lib/publicConfig';
import { useRegionSelection } from './regionSelection';
import styles from './ExplorationMapPanel.module.css';

/**
 * No verified geography exists until the Data Hub is connected. `null` tells the engine to show
 * its labelled DEMO illustration (allowed only in DEMO mode); no regions or values are invented.
 */
const NO_VERIFIED_GEOGRAPHY = null;

/** Map workspace for Peta Utama and Jelajahi: the host owns selection, data and navigation. */
export function ExplorationMapPanel() {
  const { selectedRegionId, selectRegion, clearRegion } = useRegionSelection();
  const [lastSelection, setLastSelection] = useState<GeoRegionSelection | null>(null);
  const cameraRef = useRef<GeoCameraHandle>(null);

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

  return (
    <div className={styles.workspace}>
      <Explore3DMapSlot
        geography={NO_VERIFIED_GEOGRAPHY}
        selectedRegionId={selectedRegionId}
        onRegionSelect={handleSelect}
        cameraRef={cameraRef}
      />
      <div className={styles.selection}>
        {publicConfig.dataMode === 'DEMO' && <Chip>Mode data: simulasi (DEMO)</Chip>}
        {publicConfig.dataMode === 'DEMO' && (
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
        )}
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
            Ini wilayah ilustratif untuk demonstrasi. Data indikator belum tersedia karena katalog wilayah
            resmi belum terhubung.
          </StatusMessage>
        ) : (
          <StatusMessage kind="empty" title="Belum ada wilayah dipilih">
            Klik salah satu pulau di peta 3D, atau pilih dari daftar di atas.
          </StatusMessage>
        )}
      </div>
    </div>
  );
}
