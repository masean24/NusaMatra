import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/ui/Icon/Icon';
import { Surface } from '@/components/ui/Surface/Surface';
import { epicentreSymbolSize, magnitudeBand } from '@/domain/hazards';
import { useDataHub } from '@/features/data-hub';
import {
  calloutEvents,
  EarthquakeCallout,
  EarthquakeDetail,
  EarthquakeLayerControl,
  EarthquakeLayerDetails,
  EarthquakeLayerSwitch,
  EarthquakeLegend,
  EarthquakeList,
  MAGNITUDE_TONES,
  markerLabel,
  newestFirst,
  useEarthquakeFeed,
} from '@/features/earthquakes';
import { MapViewToggle } from '@/features/graphics-quality';
import { useMediaQuery } from '@/features/motion';
import { publicConfig } from '@/lib/publicConfig';
import type { GeoCameraHandle } from '@/features/geo3d';
import { BoundaryNotice } from './BoundaryNotice';
import { ExplorationMapPanel, type MapOverlay } from './ExplorationMapPanel';
import { MapControls } from './MapControls';
import { MapGestureHint } from './MapGestureHint';
import { MapHeader } from './MapHeader';
import { RegionDetailPanel } from './RegionDetailPanel';
import { RegionExplorer } from './RegionExplorer';
import { useRegionBrowserParams } from './regionCode';
import type { SheetState } from './sheetSnap';
import { useSheetDrag } from './useSheetDrag';
import styles from './ExploreWorkspace.module.css';
import { forLanguage, t } from '@/lib/i18n';
import { useLanguage } from '@/lib/i18n/useLanguage';

/** Desktop uses open/collapsed; the phone sheet has a middle "peek" height with the summary in view. */
const LEVELS: readonly SheetState[] = ['collapsed', 'peek', 'open'];
const PHONE_QUERY = '(width < 960px)';

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
 * element is a floating column on desktop and a bottom sheet that follows the finger below 960px, so
 * nothing is remounted when the layout or the selection changes, and the WebGL canvas is never
 * recreated. There, as in a map app, a search field and chips float over the top of the map.
 * The map's view is centred on the whole screen and the sidebar floats over it, so folding the
 * sidebar never moves the map; only overlays laid on the map step clear of the sidebar.
 */
export function ExploreWorkspace({ title, backLink, status, indicators }: ExploreWorkspaceProps = {}) {
  const { dataMode } = useDataHub();
  const { query, selectedCode, selectCode } = useRegionBrowserParams();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Phones: the sheet and the map buttons cover the lower half, so a chosen region lands above them.
  const visibleFrameRef = useRef<HTMLDivElement>(null);
  // On a phone the sheet starts out of the way so the map is seen first, unless the link already
  // carries a search or a region (for example from the landing search).
  const [panelState, setPanelState] = useState<SheetState>(() => {
    const onPhone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
    if (!onPhone) return 'open';
    if (query) return 'open';
    return selectedCode ? 'peek' : 'collapsed';
  });
  const shown: SheetState = !isPhone && panelState === 'peek' ? 'open' : panelState;
  const [knownNames, setKnownNames] = useState<Readonly<Record<string, string>>>({});
  // The camera handle arrives once the 3D engine is running; the map buttons wait for it.
  const cameraRef = useRef<GeoCameraHandle | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const handleCamera = useCallback((handle: GeoCameraHandle | null) => {
    cameraRef.current = handle;
    setCameraReady(handle !== null);
  }, []);
  useSheetDrag({ enabled: isPhone, hostRef: workspaceRef, onSnap: setPanelState });

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
  const [quakeListOpen, setQuakeListOpen] = useState(false);
  // The event a visitor came back from, so the list returns to that row.
  const [lastQuakeId, setLastQuakeId] = useState<string | null>(null);
  const statusDisclosureRef = useRef<HTMLDetailsElement>(null);

  // Keyboard users lose their place when the control they used is replaced by the profile (or the
  // profile by the search), so focus is handed on explicitly. Only after their own action: a link
  // that opens with a region already selected must not pull focus.
  const panelBodyRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'profile' | 'search' | 'quake' | null>(null);

  // A newly opened region or earthquake starts at the top of the panel, not where a long result
  // list had been scrolled to (on a phone's "peek" the top lines are all that shows).
  useLayoutEffect(() => {
    const body = panelBodyRef.current;
    if (body) body.scrollTop = 0;
  }, [selectedCode, selectedQuakeId]);

  // Picking a region shows its profile, so the earthquake panel must not cover it.
  const handleMapSelect = useCallback(
    (code: string, name: string) => {
      remember(code, name);
      setSelectedQuakeId(null);
      setQuakeListOpen(false);
      setPanelState(isPhone ? 'peek' : 'open');
    },
    [remember, isPhone],
  );

  // A pick from the search clears the search text, so the profile it opens is what the panel shows.
  const handleListSelect = useCallback(
    (code: string, name: string) => {
      remember(code, name);
      setSelectedQuakeId(null);
      setQuakeListOpen(false);
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
  const sortedQuakes = useMemo(() => newestFirst(quakeEvents), [quakeEvents]);
  const selectedQuake = quakeEvents.find((event) => event.id === selectedQuakeId) ?? null;
  // What the panel shows of the earthquakes: one event, the list, or nothing (the region's content).
  const quakeView = selectedQuake ? 'detail' : quakeListOpen && quakeEvents.length > 0 ? 'list' : null;

  // Keyboard users lose their place when the control they used is replaced, so focus is handed on
  // explicitly, and only after their own action: a link that opens with a region must not pull focus.
  useEffect(() => {
    const target = pendingFocus.current;
    const body = panelBodyRef.current;
    if (!target || !body) return;
    if (target === 'profile' && (!selectedCode || quakeView)) return;
    if (target === 'search' && (selectedCode || quakeView)) return;
    if (target === 'quake' && !quakeView) return;
    pendingFocus.current = null;
    const selector = {
      profile: '[data-panel-heading]',
      search: 'input[type="search"]',
      quake: '[data-quake-heading]',
    }[target];
    body.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }, [selectedCode, quakeView, selectedQuakeId]);

  /** Back to what the panel shows without an earthquake: the region, or the whole country. */
  const returnCamera = useCallback(() => {
    if (selectedCode) cameraRef.current?.focusRegion(selectedCode);
    else cameraRef.current?.resetView();
  }, [selectedCode]);

  const closeQuakePanel = useCallback(() => {
    setSelectedQuakeId(null);
    setQuakeListOpen(false);
    setLastQuakeId(null);
    pendingFocus.current = selectedCode ? 'profile' : 'search';
    returnCamera();
    if (isPhone) setPanelState(selectedCode ? 'peek' : 'collapsed');
  }, [selectedCode, returnCamera, isPhone]);

  const toggleQuakeLayer = useCallback(
    (next: boolean) => {
      setQuakeLayerOn(next);
      if (next) return;
      if (selectedQuakeId) returnCamera();
      setSelectedQuakeId(null);
      setQuakeListOpen(false);
      setLastQuakeId(null);
    },
    [selectedQuakeId, returnCamera],
  );

  const handleQuakeSelect = useCallback(
    (id: string) => {
      const event = quakeEvents.find((candidate) => candidate.id === id);
      if (event) cameraRef.current?.focusPoint(event.longitude, event.latitude);
      setSelectedQuakeId(id);
      pendingFocus.current = 'quake';
      if (statusDisclosureRef.current) statusDisclosureRef.current.open = false;
      setPanelState(isPhone ? 'peek' : 'open');
    },
    [quakeEvents, isPhone],
  );

  const openQuakeList = useCallback(() => {
    if (selectedQuakeId) {
      // Back from an event: its row takes the focus (EarthquakeList), and the map shows them all again.
      setLastQuakeId(selectedQuakeId);
      returnCamera();
    } else {
      pendingFocus.current = 'quake';
    }
    setSelectedQuakeId(null);
    setQuakeListOpen(true);
    if (statusDisclosureRef.current) statusDisclosureRef.current.open = false;
    setPanelState('open');
  }, [selectedQuakeId, returnCamera]);

  // Anything to know about the quake data opens the card that says it: a chip alone would stay silent.
  const quakeProblem =
    quakeLayerOn &&
    (quakes.status === 'error' ||
      quakes.assessment?.isStale === true ||
      (quakes.assessment !== null && quakes.assessment.display !== 'OFFICIAL'));
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isPhone && quakeProblem && statusDisclosureRef.current) statusDisclosureRef.current.open = true;
  }, [isPhone, quakeProblem]);

  // The info card folds away on a tap anywhere else, so it never stays over the map.
  useEffect(() => {
    if (!isPhone) return;
    const onPointerDown = (event: PointerEvent) => {
      const disclosure = statusDisclosureRef.current;
      if (!disclosure?.open || !(event.target instanceof Node)) return;
      if (!statusRef.current?.contains(event.target)) disclosure.open = false;
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isPhone]);

  const handleSearchFocus = useCallback(() => {
    setPanelState('open');
    if (statusDisclosureRef.current) statusDisclosureRef.current.open = false;
  }, []);

  const currentLanguage = useLanguage();
  const overlay = useMemo<MapOverlay | undefined>(
    () =>
      forLanguage(currentLanguage, () =>
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
                color: MAGNITUDE_TONES()[magnitudeBand(event.magnitude)].color,
              })),
              callouts: calloutEvents(quakeEvents, selectedQuakeId).map((event) => ({
                id: event.id,
                content: (
                  <EarthquakeCallout
                    event={event}
                    selected={event.id === selectedQuakeId}
                    onSelect={handleQuakeSelect}
                  />
                ),
              })),
              selectedId: selectedQuakeId,
              onSelect: handleQuakeSelect,
            },
      ),
    [currentLanguage, quakeEvents, quakes.newIds, selectedQuakeId, handleQuakeSelect],
  );

  const toggle = () => {
    if (!isPhone) {
      setPanelState((current) => (current === 'open' ? 'collapsed' : 'open'));
    } else {
      setPanelState((current) =>
        current === 'open' ? 'collapsed' : (LEVELS[LEVELS.indexOf(current) + 1] ?? current),
      );
    }
  };

  const collapsed = shown === 'collapsed';
  // The name sits in the bar only while the panel is folded; unfolded, the profile heading already shows it.
  const label =
    quakeView === 'detail'
      ? t('Detail gempa')
      : quakeView === 'list'
        ? t('Gempa BMKG') // the list's own heading already says "Daftar gempa"
        : isPhone && query.trim()
          ? t('Hasil pencarian')
          : !selectedCode
            ? isPhone
              ? t('Daftar wilayah') // the search itself is the field over the map
              : t('Cari wilayah')
            : collapsed
              ? (knownNames[selectedCode] ?? t('Wilayah kode {0}', selectedCode))
              : t('Profil wilayah');

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
  // Search and filters: the whole list until a region is open, then just the field.
  const search = (
    <div key="search" className={styles.section}>
      <RegionExplorer bare compact={Boolean(selectedCode)} fieldless={isPhone} onSelect={handleListSelect} />
    </div>
  );
  const focus = selectedCode ? (
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
  const regionFirst = isPhone && focus !== null && query.trim() === '';
  // The earthquakes take the whole panel: the list and an event open in the same place, and the eye
  // stays there while the map flies to the epicentre. The region's content waits underneath.
  const selectedQuakeIndex = selectedQuake ? sortedQuakes.indexOf(selectedQuake) : -1;
  const previousQuake = sortedQuakes[selectedQuakeIndex - 1];
  const nextQuake = sortedQuakes[selectedQuakeIndex + 1];
  const quakePanel =
    selectedQuake && quakes.assessment ? (
      <EarthquakeDetail
        key={selectedQuake.id}
        event={selectedQuake}
        assessment={quakes.assessment}
        origin={quakes.feed?.origin}
        navigation={{
          index: selectedQuakeIndex,
          total: sortedQuakes.length,
          onBack: openQuakeList,
          onPrevious: previousQuake
            ? () => {
                handleQuakeSelect(previousQuake.id);
              }
            : null,
          onNext: nextQuake
            ? () => {
                handleQuakeSelect(nextQuake.id);
              }
            : null,
        }}
        onClose={closeQuakePanel}
      />
    ) : quakeView === 'list' ? (
      <EarthquakeList
        events={sortedQuakes}
        lastOpenedId={lastQuakeId}
        onSelect={handleQuakeSelect}
        onClose={closeQuakePanel}
      />
    ) : null;
  const layerSwitch = {
    enabled: quakeLayerOn,
    available: dataMode === 'LIVE',
    onToggle: toggleQuakeLayer,
    state: quakes,
    listOpen: quakeView !== null,
    onToggleList: quakeView === null ? openQuakeList : closeQuakePanel,
  };
  // Where the map's boundaries come from: always in view, its explanation on demand.
  const boundaryCard = (
    <div className={`glass ${styles.statusCard}`}>
      <BoundaryNotice compact />
    </div>
  );

  return (
    <div
      ref={workspaceRef}
      className={styles.workspace}
      data-panel={collapsed ? 'collapsed' : 'open'}
      data-sheet={shown}
      data-selected={selectedCode ? true : undefined}
      data-quake-layer={quakeEvents.length > 0 ? true : undefined}
      style={{ '--explore-map-inset': `${String(mapInset)}px` } as CSSProperties}
    >
      {/* The real 3D map, filling the workspace behind every floating control. */}
      <div ref={stageRef} className={styles.mapStage}>
        {isPhone && <div ref={visibleFrameRef} className={styles.visibleFrame} aria-hidden="true" />}
        {/* On a phone it would sit right over the chosen region, so it waits until none is chosen. */}
        {!(isPhone && selectedCode) && <MapGestureHint />}
        {/*
         * The view is centred on the whole screen: the sidebar floats over the map like the status
         * cards do, so folding it never moves the map (no viewInsetLeft).
         */}
        <ExplorationMapPanel
          cameraRef={handleCamera}
          onLiveSelect={handleMapSelect}
          overlay={overlay}
          visibleFrameRef={visibleFrameRef}
          immersive
        />
        {quakeEvents.length > 0 && <EarthquakeLegend className={styles.quakeLegend} />}
      </div>

      {isPhone && (
        <MapHeader
          placeholder={(selectedCode ? knownNames[selectedCode] : null) ?? t('Cari kabupaten/kota')}
          onSearchFocus={handleSearchFocus}
        />
      )}

      <div ref={statusRef} className={styles.status} role="region" aria-label={t('Status data peta')}>
        {isPhone ? (
          // As in a map app: the layer is a chip over the map, and the cards that would cover it fold
          // into one more chip. Every one of them is still there, one tap away.
          <div className={styles.chips}>
            <EarthquakeLayerSwitch {...layerSwitch} chips />
            <details ref={statusDisclosureRef} className={styles.statusDisclosure}>
              <summary className={styles.statusSummary}>
                {/* LIVE is the only mode visitors see, so it is not labelled; DEMO always is. */}
                {(dataMode === 'DEMO' || publicConfig.modeSwitch) && (
                  <span className={styles.modeBadge} data-mode={dataMode}>
                    {dataMode}
                  </span>
                )}
                {t('Info data')}
                {quakeProblem && (
                  <span
                    className={styles.problemDot}
                    role="img"
                    aria-label={t('Ada catatan tentang data gempa')}
                  />
                )}
              </summary>
              <div className={styles.statusBody}>
                {status}
                <div className={`glass ${styles.statusCard}`}>
                  <EarthquakeLayerDetails
                    enabled={quakeLayerOn}
                    available={dataMode === 'LIVE'}
                    state={quakes}
                  />
                </div>
                {boundaryCard}
              </div>
            </details>
          </div>
        ) : (
          <>
            {status}
            <div className={`glass ${styles.statusCard}`}>
              <EarthquakeLayerControl {...layerSwitch} />
            </div>
            {boundaryCard}
          </>
        )}
      </div>

      <div className={styles.controls} data-sheet-follower>
        <MapViewToggle />
        <MapControls cameraRef={cameraRef} ready={cameraReady} />
      </div>

      <Surface
        as="aside"
        radius="card"
        reading
        className={styles.panel}
        aria-label={t('Informasi wilayah')}
        data-state={shown}
        data-explore-panel
      >
        <button
          type="button"
          className={styles.bar}
          aria-expanded={!collapsed}
          aria-controls="panel-wilayah"
          data-sheet-handle
          onClick={toggle}
        >
          <span className={styles.grip} aria-hidden="true" />
          <span className={styles.barLabel}>
            <span className="kk-body-strong">{label}</span>
            <span className={`kk-small ${styles.barHint}`}>
              {collapsed
                ? t('Buka panel')
                : shown === 'peek'
                  ? t('Ketuk untuk memperluas')
                  : t('Ciutkan panel')}
            </span>
          </span>
          <span className={styles.chevron} data-open={!collapsed || undefined} aria-hidden="true">
            <Icon name="chevronLeft" size={20} />
          </span>
        </button>

        {/* The sheet's content stays laid out while folded (CSS hides it), so a drag can bring it up. */}
        <div
          id="panel-wilayah"
          ref={panelBodyRef}
          className={styles.body}
          hidden={collapsed && !isPhone}
          data-sheet-body
        >
          {/*
           * Desktop reads top-down: where you are, search, the open region, its indicators. On a phone
           * the sheet's first lines are all a "peek" shows, so an open region comes first and the
           * navigation goes last. The DOM order changes with it, so focus order matches what is seen.
           */}
          {quakePanel}
          <div className={styles.regionContent} hidden={quakePanel !== null}>
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
              // While searching on a phone only the results show; the indicators keep their place.
              <div key="indicators" className={styles.section} hidden={isPhone && query.trim() !== ''}>
                {indicators}
              </div>
            )}
            {isPhone && intro}
          </div>
        </div>
      </Surface>
    </div>
  );
}
