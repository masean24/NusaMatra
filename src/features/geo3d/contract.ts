/**
 * Host-side contract for the separately developed 3D geographic engine (handoff package:
 * `integrations/nusa-matra-3d-handoff`, host copy in `src/features/map-3d/`).
 *
 * The host owns navigation, theme, data fetching and region selection. The engine only renders
 * and reports what the user did; it never fetches data, changes routes or stores preferences.
 * These types are deliberately independent of the engine's own names, so a future engine
 * version is absorbed in `engineAdapters.tsx`, not across the app.
 */
import type { Ref } from 'react';

export type GeoDisplayMode = 'normal' | 'glass';
export type GeoDataMode = 'DEMO' | 'LIVE';

/** What the engine reports when the user picks a region. `regionId` is the canonical key. */
export interface GeoRegionSelection {
  readonly regionId: string;
  readonly displayName: string;
  readonly boundaryEditionId: string;
  readonly dataMode: GeoDataMode;
}

/** Imperative camera control exposed by the engine through `cameraRef`. */
export interface GeoCameraHandle {
  /** Fly to and highlight one region. */
  focusRegion: (regionId: string) => void;
  /** Return to the overview framing. */
  resetView: () => void;
  /** Closer (factor < 1) or farther (factor > 1) along the current line of sight, within the map's limits. */
  zoomBy: (factor: number) => void;
}

/** Props every engine component receives from the host. */
export interface GeoEngineBaseProps {
  readonly displayMode: GeoDisplayMode;
  readonly dataMode: GeoDataMode;
  readonly reducedMotion: boolean;
  readonly className?: string | undefined;
  /** Called once the WebGL renderer is up, so the host can fade out its placeholder. */
  readonly onReady?: (() => void) | undefined;
  /** Called on a rendering or data-validation failure; the host keeps its static fallback. */
  readonly onError?: ((error: unknown) => void) | undefined;
}

/** Landing hero diorama (Figma 3D-1). Always illustrative, even when the app runs LIVE. */
export type HeroDioramaProps = GeoEngineBaseProps;

/**
 * Landing hero map drawn with hexagons (the default hero engine). Illustrative and SIMULATED, like
 * the diorama it replaces; it tells the host when its entrance has finished so the pins, the
 * connector lines and the region cards can follow.
 */
export interface HeroHexMapProps extends GeoEngineBaseProps {
  readonly onEntranceSettled?: (() => void) | undefined;
}

/** Interactive 3D map for Peta Utama / Jelajahi (Figma 61:1183, 29:34). */
export interface Explore3DMapProps extends GeoEngineBaseProps {
  /**
   * Geography payload from the Data Hub, validated by the engine. `null` = no verified geography
   * yet: allowed only in DEMO, where the engine shows its labelled illustrative islands.
   */
  readonly geography: unknown;
  /** Controlled selection: the host owns it (it lives in the URL). */
  readonly selectedRegionId: string | null;
  readonly onRegionSelect: (selection: GeoRegionSelection) => void;
  readonly onRegionHover?: ((selection: GeoRegionSelection | null) => void) | undefined;
  readonly cameraRef?: Ref<GeoCameraHandle> | undefined;
  /** Clickable points over the map (e.g. epicentres). Updating them never rebuilds the regions. */
  readonly overlayPoints?: readonly GeoOverlayPoint[] | undefined;
  readonly selectedOverlayId?: string | null | undefined;
  readonly onOverlaySelect?: ((id: string) => void) | undefined;
  /** CSS pixels of the map covered on the left by a floating panel; the view is centred beside it. */
  readonly viewInsetLeft?: number | undefined;
}

/** A point drawn over the map. `size` is a symbol size in map units, never an area on the ground. */
export interface GeoOverlayPoint {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
  readonly size: number;
  /** Plain text for the hover label. */
  readonly label: string;
  /** New since the previous update: animated once. */
  readonly isNew: boolean;
}
