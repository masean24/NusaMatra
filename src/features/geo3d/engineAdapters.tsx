import { useImperativeHandle, useRef } from 'react';
import {
  Explore3DMap as EngineExplore3DMap,
  HeroDiorama as EngineHeroDiorama,
  type NusaMatra3DMapHandle,
  type RegionSelection,
} from '@/features/map-3d';
import type { Explore3DMapProps, GeoRegionSelection, HeroDioramaProps } from './contract';

/*
 * Optional engine props are spread only when defined: the engine's prop types predate the host's
 * `exactOptionalPropertyTypes` setting, so an explicit `undefined` would not type-check.
 *
 * Maps the host contract onto the engine's API. This is the only file that knows the engine's
 * prop and handle names, so an engine update is absorbed here. Loaded lazily from the registry,
 * which keeps three.js out of the initial bundle.
 */

function toSelection(region: RegionSelection): GeoRegionSelection {
  return {
    regionId: region.regionId,
    displayName: region.displayName,
    boundaryEditionId: region.boundaryEditionId,
    dataMode: region.dataMode,
  };
}

export function HeroDioramaAdapter({
  displayMode,
  dataMode,
  reducedMotion,
  className,
  onReady,
  onError,
}: HeroDioramaProps) {
  return (
    <EngineHeroDiorama
      displayMode={displayMode}
      dataMode={dataMode}
      reducedMotion={reducedMotion}
      {...(className ? { className } : {})}
      {...(onReady ? { onReady } : {})}
      {...(onError ? { onError } : {})}
    />
  );
}

export function Explore3DMapAdapter({
  displayMode,
  dataMode,
  reducedMotion,
  className,
  onReady,
  onError,
  geography,
  selectedRegionId,
  onRegionSelect,
  onRegionHover,
  cameraRef,
}: Explore3DMapProps) {
  const engineRef = useRef<NusaMatra3DMapHandle>(null);

  // Expose the host camera contract on top of the engine's own handle.
  useImperativeHandle(
    cameraRef,
    () => ({
      focusRegion: (regionId: string) => {
        engineRef.current?.focusRegion(regionId);
      },
      resetView: () => {
        engineRef.current?.resetCamera();
      },
    }),
    [],
  );

  return (
    <EngineExplore3DMap
      ref={engineRef}
      displayMode={displayMode}
      dataMode={dataMode}
      reducedMotion={reducedMotion}
      geography={geography ?? undefined}
      selectedRegionId={selectedRegionId}
      onSelectRegion={(region) => {
        onRegionSelect(toSelection(region));
      }}
      {...(onRegionHover
        ? {
            onHoverRegion: (region: RegionSelection | null) => {
              onRegionHover(region ? toSelection(region) : null);
            },
          }
        : {})}
      {...(className ? { className } : {})}
      {...(onReady ? { onReady } : {})}
      {...(onError ? { onError } : {})}
    />
  );
}
