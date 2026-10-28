import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/ui/Icon/Icon';
import { Surface } from '@/components/ui/Surface/Surface';
import { epicentreSymbolSize } from '@/domain/hazards';
import { useDataHub } from '@/features/data-hub';
import {
  EarthquakeDetail,
  EarthquakeLayerControl,
  markerLabel,
  useEarthquakeFeed,
} from '@/features/earthquakes';
import { useMediaQuery } from '@/features/motion';
import { publicConfig } from '@/lib/publicConfig';
import type { GeoCameraHandle } from '@/features/geo3d';
import { BoundaryNotice } from './BoundaryNotice';
import { ExplorationMapPanel, type MapOverlay } from './ExplorationMapPanel';
import { MapControls } from './MapControls';
import { MapGestureHint } from './MapGestureHint';
import { RegionDetailPanel } from './RegionDetailPanel';
import { RegionExplorer } from './RegionExplorer';
import { useRegionBrowserParams } from './regionCode';
import styles from './ExploreWorkspace.module.css';

/** A swipe of at least this many pixels on the sheet handle opens or collapses it. */
const SWIPE_THRESHOLD_PX = 36;

/** Desktop uses open/collapsed; the phone sheet has a middle "peek" height with the summary in view. */
type PanelState = 'collapsed' | 'peek' | 'open';
const LEVELS: readonly PanelState[] = ['collapsed', 'peek', 'open'];
const PHONE_QUERY = '(width < 960px)';
/** Phones: the status cards fold into one disclosure so the map stays visible. */
const NARROW_QUERY = '(width < 600px)';

interface ExploreWorkspaceProps {
  /** The page's title, shown at the top of the sidebar (the page heading itself is the frame's). */
  readonly title?: string;
  /** Navigation back to the map hub, at the top of the sidebar. */
  readonly backLink?: ReactNode;
  /** Status controls over the map's top right, before the BMKG switch (the data-mode bar). */
  readonly status?: ReactNode;
  /** The indicator explorer, a section of the sidebar under the selected region. */
  readonly indicators?: ReactNode;
}

/**
 * Jelajahi as a map application: the real 3D map fills the viewport, and one floating sidebar
 * holds the search, the selected region (or earthquake) and the indicator explorer. The same panel
 * element is a floating column on desktop and a bottom sheet below 960px (CSS only), so nothing is
 * remounted when the layout or the selection changes, and the WebGL canvas is never recreated.
 * The map's view is centred on the whole screen and the sidebar floats over it, so folding the
 * sidebar never moves the map; only overlays laid on the map step clear of the sidebar.
 */
export function ExploreWorkspace({ title, backLink, status, indicators }: ExploreWorkspaceProps = {}) {
  const { dataMode } = useDataHub();
  const { query, selectedCode, selectCode } = useRegionBrowserParams();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // On a phone the sheet starts out of the way so the map is seen first, unless the link already
  // carries a search or a region (for example from the landing search).
  const [panelState, setPanelState] = useState<PanelState>(() => {
    const onPhone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
    if (!onPhone) return 'open';
    if (query) return 'open';
    return selectedCode ? 'peek' : 'collapsed';
  });
  const shown: PanelState = !isPhone && panelState === 'peek' ? 'open' : panelState;
  const [knownNames, setKnownNames] = useState<Readonly<Record<string, string>>>({});
  // The camera handle arrives once the 3D engine is running; the map buttons wait for it.
  const cameraRef = useRef<GeoCameraHandle | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const handleCamera = useCallback((handle: GeoCameraHandle | null) => {
    cameraRef.current = handle;
    setCameraReady(handle !== null);
  }, []);
  const swipeStart = useRef<number | null>(null);
  const swiped = useRef(false);

  const remember = useCallback((code: string, name: string) => {
    setKnownNames((current) => (current[code] === name ? current : { ...current, [code]: name }));
  }, []);

  // How much of the map the floating sidebar covers on the left (0 on phones, where it is a sheet),
  // so overlays on the map (labels, the DEMO list) sit clear of it; the map view itself ignores it.
  const [mapInset, setMapInset] = useState(0);
  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const stage = stageRef.current;
    const panel = workspace?.querySelector<HTMLElement>('[data-explore-panel]');
    if (isPhone || !workspace || !stage || !panel) {
      setMapInset(0);
      return;
    }
    // Layout boxes, not the painted ones: the sidebar's entrance slide must not shift the map's centre.
    const measure = () => {
      setMapInset(Math.max(0, panel.offsetLeft + panel.offsetWidth - stage.offsetLeft));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(stage);
    return () => {
      observer.disconnect();
    };
  }, [isPhone]);

  // BMKG earthquake layer: off by default, LIVE only, its selection separate from the region's.
  const [quakeLayerOn, setQuakeLayerOn] = useState(false);
  const [selectedQuakeId, setSelectedQuakeId] = useState<string | null>(null);

  // Keyboard users lose their place when the control they used is replaced by the profile (or the
  // profile by the search), so focus is handed on explicitly. Only after their own action: a link
  // that opens with a region already selected must not pull focus.
  const panelBodyRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'profile' | 'search' | null>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const body = panelBodyRef.current;
    if (!body) return;
    if (target === 'profile' && !selectedCode) return;
    if (target === 'search' && selectedCode) return;
    pendingFocus.current = null;
    const element =
      target === 'profile'
        ? body.querySelector<HTMLElement>('[data-panel-heading]')
        : body.querySelector<HTMLElement>('input[type="search"]');
    element?.focus({ preventScroll: true });
  }, [selectedCode]);

  // A newly opened region or earthquake starts at the top of the panel, not where a long result
  // list had been scrolled to (on a phone's "peek" the top lines are all that shows).
  useLayoutEffect(() => {
    const body = panelBodyRef.current;
    if (body) body.scrollTop = 0;
  }, [selectedCode, selectedQuakeId]);

  // Picking a region shows its profile, so an earthquake detail left open must not cover it.
  const handleMapSelect = useCallback(
    (code: string, name: string) => {
      remember(code, name);
      setSelectedQuakeId(null);
      setPanelState(isPhone ? 'peek' : 'open');
    },
    [remember, isPhone],
  );

  // A pick from the search clears the search text, so the profile it opens is what the panel shows.
  const handleListSelect = useCallback(
    (code: string, name: string) => {
      remember(code, name);
      setSelectedQuakeId(null);
      pendingFocus.current = 'profile';
      selectCode(code, { clearQuery: true });
      setPanelState(isPhone ? 'peek' : 'open');
      if (dataMode === 'LIVE') cameraRef.current?.focusRegion(code);
    },
    [remember, selectCode, dataMode, isPhone],
  );
  const quakes = useEarthquakeFeed(quakeLayerOn);
  // Only the verdict's `display` matters here. The assessment object is re-made as time passes, and
  // depending on it would hand the map a new points list (and re-seed the overlay) on every tick.
  const quakeDisplay = quakes.assessment?.display ?? null;
  const quakeEvents = useMemo(
    () => (quakes.feed && quakeDisplay !== null && quakeDisplay !== 'WITHHELD' ? quakes.feed.events : []),
    [quakes.feed, quakeDisplay],
  );
  const selectedQuake = quakeEvents.find((event) => event.id === selectedQuakeId) ?? null;

  const toggleQuakeLayer = useCallback((next: boolean) => {
    setQuakeLayerOn(next);
    if (!next) setSelectedQuakeId(null);
  }, []);

  const handleQuakeSelect = useCallback(
    (id: string) => {
      setSelectedQuakeId(id);
      setPanelState(isPhone ? 'peek' : 'open');
    },
    [isPhone],
  );

  const overlay = useMemo<MapOverlay | undefined>(
    () =>
      quakeEvents.length === 0
        ? undefined
        : {
            points: quakeEvents.map((event) => ({
              id: event.id,
              lon: event.longitude,
              lat: event.latitude,
              size: epicentreSymbolSize(event.magnitude),
              label: markerLabel(event),
              isNew: quakes.newIds.has(event.id),
            })),
            selectedId: selectedQuakeId,
            onSelect: handleQuakeSelect,
          },
    [quakeEvents, quakes.newIds, selectedQuakeId, handleQuakeSelect],
  );

  const step = (direction: 1 | -1) => {
    setPanelState((current) => {
      const index = LEVELS.indexOf(current);
      return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, index + direction))] ?? current;
    });
  };
  const toggle = () => {
    if (!isPhone) {
      setPanelState((current) => (current === 'open' ? 'collapsed' : 'open'));
    } else {
      setPanelState((current) =>
        current === 'open' ? 'collapsed' : (LEVELS[LEVELS.indexOf(current) + 1] ?? current),
      );
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    swipeStart.current = event.clientY;
  };
  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null) return;
    const delta = event.clientY - start;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      swiped.current = true; // the click that follows a swipe must not toggle as well
      step(delta < 0 ? 1 : -1);
    }
  };

  const collapsed = shown === 'collapsed';
  // The name sits in the bar only while the panel is folded; unfolded, the profile heading already shows it.
  const label = selectedQuake
    ? 'Detail gempa'
    : !selectedCode
      ? 'Cari wilayah'
      : collapsed
        ? (knownNames[selectedCode] ?? `Wilayah kode ${selectedCode}`)
        : 'Profil wilayah';

  const intro = (backLink ?? title) && (
    <div key="intro" className={styles.intro}>
      {backLink}
      {title && (
        // The page heading is the frame's (for screen readers); this is its visible echo.
        <p className={`kk-h3 ${styles.title}`} aria-hidden="true">
          {title}
        </p>
      )}
    </div>
  );
  // Search and filters: the whole list until a region (or earthquake) is open, then just the field.
  const search = (
    <div key="search" className={styles.section}>
      <RegionExplorer
        bare
        compact={Boolean(selectedCode) || selectedQuake !== null}
        onSelect={handleListSelect}
      />
    </div>
  );
  // The open region, or an earthquake shown over it (closing it brings the region back).
  const focus =
    selectedQuake && quakes.assessment ? (
      <div key="focus" className={styles.section}>
        <EarthquakeDetail
          event={selectedQuake}
          assessment={quakes.assessment}
          origin={quakes.feed?.origin}
          onClose={() => {
            setSelectedQuakeId(null);
          }}
        />
      </div>
    ) : selectedCode ? (
      <div key="focus" className={styles.section}>
        <RegionDetailPanel
          regionId={selectedCode}
          fallbackName={knownNames[selectedCode] ?? null}
          onClose={() => {
            pendingFocus.current = 'search';
            selectCode(null);
          }}
        />
      </div>
    ) : null;
  const regionFirst = isPhone && focus !== null;
  // The data mode banner, the BMKG layer and where the boundaries come from.
  const statusCards = (
    <>
      {status}
      <div className={`glass ${styles.statusCard}`}>
        <EarthquakeLayerControl
          enabled={quakeLayerOn}
          available={dataMode === 'LIVE'}
          onToggle={toggleQuakeLayer}
          state={quakes}
          selectedId={selectedQuake?.id ?? null}
          onSelect={handleQuakeSelect}
        />
      </div>
      {/* Where the map's boundaries come from: always in view, its explanation on demand. */}
      <div className={`glass ${styles.statusCard}`}>
        <BoundaryNotice compact />
      </div>
    </>
  );

  return (
    <div
      ref={workspaceRef}
      className={styles.workspace}
      data-panel={collapsed ? 'collapsed' : 'open'}
      data-sheet={shown}
      data-selected={selectedCode ? true : undefined}
      style={{ '--explore-map-inset': `${String(mapInset)}px` } as CSSProperties}
    >
      {/* The real 3D map, filling the workspace behind every floating control. */}
      <div ref={stageRef} className={styles.mapStage}>
        <MapGestureHint />
        {/*
         * The view is centred on the whole screen: the sidebar floats over the map like the status
         * cards do, so folding it never moves the map (no viewInsetLeft).
         */}
        <ExplorationMapPanel
          cameraRef={handleCamera}
          onLiveSelect={handleMapSelect}
          overlay={overlay}
          immersive
        />
      </div>

      <div className={styles.status} role="region" aria-label="Status data peta">
        {isNarrow ? (
          // Phones: the cards would cover the map, so they fold into one control that names the
          // data mode. Every card is still there, unchanged, one tap away.
          <details className={styles.statusDisclosure}>
            <summary className={`glass ${styles.statusSummary}`}>
              {/* LIVE is the only mode visitors see, so it is not labelled; DEMO always is. */}
              {(dataMode === 'DEMO' || publicConfig.modeSwitch) && (
                <span className={styles.modeBadge} data-mode={dataMode}>
                  {dataMode}
                </span>
              )}
              <span className="kk-small">
                {dataMode === 'DEMO' ? 'Simulasi' : 'Data resmi'}
                {quakeLayerOn ? ' · Gempa BMKG aktif' : ''}
              </span>
              <span className={styles.summaryHint}>Info data</span>
            </summary>
            <div className={styles.statusBody}>{statusCards}</div>
          </details>
        ) : (
          statusCards
        )}
      </div>

      <div className={styles.controls}>
        <MapControls cameraRef={cameraRef} ready={cameraReady} />
      </div>

      <Surface
        as="aside"
        radius="card"
        reading
        className={styles.panel}
        aria-label="Informasi wilayah"
        data-state={shown}
        data-explore-panel
      >
        <button
          type="button"
          className={styles.bar}
          aria-expanded={!collapsed}
          aria-controls="panel-wilayah"
          onClick={() => {
            if (swiped.current) swiped.current = false;
            else toggle();
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
        >
          <span className={styles.grip} aria-hidden="true" />
          <span className={styles.barLabel}>
            <span className="kk-body-strong">{label}</span>
            <span className={`kk-small ${styles.barHint}`}>
              {collapsed ? 'Buka panel' : shown === 'peek' ? 'Ketuk untuk memperluas' : 'Ciutkan panel'}
            </span>
          </span>
          <span className={styles.chevron} data-open={!collapsed || undefined} aria-hidden="true">
            <Icon name="chevronLeft" size={20} />
          </span>
        </button>

        <div id="panel-wilayah" ref={panelBodyRef} className={styles.body} hidden={collapsed}>
          {/*
           * Desktop reads top-down: where you are, search, the open region, its indicators. On a phone
           * the sheet's first lines are all a "peek" shows, so an open region comes first and the
           * navigation goes last. The DOM order changes with it, so focus order matches what is seen.
           */}
          {!isPhone && intro}
          {regionFirst ? (
            <>
              {focus}
              {search}
            </>
          ) : (
            <>
              {search}
              {focus}
            </>
          )}
          {indicators && (
            <div key="indicators" className={styles.section}>
              {indicators}
            </div>
          )}
          {isPhone && intro}
        </div>
      </Surface>
    </div>
  );
}
