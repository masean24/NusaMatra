import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Icon } from '@/components/ui/Icon/Icon';
import { Surface } from '@/components/ui/Surface/Surface';
import { useDataHub } from '@/features/data-hub';
import { useMediaQuery, useReducedMotion } from '@/features/motion';
import type { GeoCameraHandle } from '@/features/geo3d';
import { BoundaryNotice } from './BoundaryNotice';
import { ExplorationMapPanel } from './ExplorationMapPanel';
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
/** Space kept above the map when it is brought into view, so the floating navbar does not cover it. */
const NAVBAR_CLEARANCE_PX = 92;

/**
 * Jelajahi: the map and its contextual panel side by side, so choosing a region shows its profile
 * in the same view. One panel element serves both layouts: a column beside the map on desktop and
 * a bottom sheet on phones (CSS only), so nothing is remounted when the layout or the selection
 * changes, and the WebGL canvas is never recreated.
 */
export function ExploreWorkspace() {
  const { dataMode } = useDataHub();
  const { query, selectedCode, selectCode } = useRegionBrowserParams();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const reducedMotion = useReducedMotion();
  const mapColumnRef = useRef<HTMLDivElement>(null);
  const scrollPending = useRef(false);
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
  const cameraRef = useRef<GeoCameraHandle>(null);
  const swipeStart = useRef<number | null>(null);
  const swiped = useRef(false);

  const remember = useCallback((code: string, name: string) => {
    setKnownNames((current) => (current[code] === name ? current : { ...current, [code]: name }));
  }, []);

  /**
   * On a phone the sheet covers the lower part of the screen, so the map itself is brought up above
   * it. Nothing else moves, and on desktop nothing scrolls at all.
   */
  const keepMapAboveSheet = useCallback(() => {
    if (isPhone) scrollPending.current = true;
  }, [isPhone]);

  // Done after the selection has rendered: the router restores the old scroll position while it
  // changes the URL, which would otherwise undo this.
  useEffect(() => {
    // Wait for the selection itself to land in the URL; the router restores scroll when it does.
    if (!scrollPending.current || !selectedCode) return;
    scrollPending.current = false;
    // A frame later: the router's scroll restoration (a parent effect) has run by then.
    const frame = requestAnimationFrame(() => {
      const column = mapColumnRef.current;
      if (!column) return;
      window.scrollTo({
        top: window.scrollY + column.getBoundingClientRect().top - NAVBAR_CLEARANCE_PX,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [selectedCode, panelState, reducedMotion]);

  const handleMapSelect = useCallback(
    (code: string, name: string) => {
      remember(code, name);
      setPanelState(isPhone ? 'peek' : 'open');
      keepMapAboveSheet();
    },
    [remember, isPhone, keepMapAboveSheet],
  );

  const handleListSelect = useCallback(
    (code: string, name: string) => {
      remember(code, name);
      selectCode(code);
      setPanelState(isPhone ? 'peek' : 'open');
      keepMapAboveSheet();
      if (dataMode === 'LIVE') cameraRef.current?.focusRegion(code);
    },
    [remember, selectCode, dataMode, isPhone, keepMapAboveSheet],
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
  const label = !selectedCode
    ? 'Cari wilayah'
    : collapsed
      ? (knownNames[selectedCode] ?? `Wilayah kode ${selectedCode}`)
      : 'Profil wilayah';

  return (
    <div
      className={styles.workspace}
      data-panel={collapsed ? 'collapsed' : 'open'}
      data-selected={selectedCode ? true : undefined}
    >
      <div ref={mapColumnRef} className={styles.mapColumn}>
        <ExplorationMapPanel cameraRef={cameraRef} onLiveSelect={handleMapSelect} />
        <BoundaryNotice />
      </div>

      <Surface radius="card" className={styles.panel} aria-label="Informasi wilayah" data-state={shown}>
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

        <div id="panel-wilayah" className={styles.body} hidden={collapsed}>
          {selectedCode ? (
            <RegionDetailPanel
              regionId={selectedCode}
              fallbackName={knownNames[selectedCode] ?? null}
              onClose={() => {
                selectCode(null);
              }}
            />
          ) : (
            <RegionExplorer bare onSelect={handleListSelect} />
          )}
        </div>
      </Surface>
    </div>
  );
}
