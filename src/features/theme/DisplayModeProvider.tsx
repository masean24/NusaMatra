import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { prefersReducedMotion, useMediaQuery } from '@/features/motion';
import { DisplayModeContext, type DisplayModeContextValue } from './DisplayModeContext';
import {
  OPAQUE_SURFACES_QUERY,
  browserEnvironment,
  oppositeMode,
  resolveInitialDisplayMode,
  writeStoredDisplayMode,
  type DisplayMode,
} from './displayModePreference';
import { runThemeTransition } from './themeTransition';

function applyToDocument(mode: DisplayMode): void {
  document.documentElement.setAttribute('data-display-mode', mode);
}

function defaultOrigin(): { originX: number; originY: number } {
  // Without a toggle box (e.g. a programmatic call) the reveal starts from the navbar area.
  return { originX: window.innerWidth / 2, originY: 40 };
}

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const forceOpaque = useMediaQuery(OPAQUE_SURFACES_QUERY);
  const [preferredMode, setPreferredMode] = useState<DisplayMode>(() =>
    resolveInitialDisplayMode(browserEnvironment()),
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionRunning = useRef(false);

  // The device can ask for opaque surfaces at any time; Kaca then switches off without animation.
  const mode: DisplayMode = forceOpaque ? 'normal' : preferredMode;

  useEffect(() => {
    applyToDocument(mode);
  }, [mode]);

  const toggleMode = useCallback(
    (origin?: DOMRect) => {
      // Coalesce rapid toggles: the running transition finishes first.
      if (forceOpaque || transitionRunning.current) return;
      transitionRunning.current = true;
      setIsTransitioning(true);

      const target = oppositeMode(preferredMode);
      const point = origin
        ? { originX: origin.left + origin.width / 2, originY: origin.top + origin.height / 2 }
        : defaultOrigin();

      void runThemeTransition({
        ...point,
        reducedMotion: prefersReducedMotion(),
        // Runs while the old page is held as a snapshot: React state, the document attribute and
        // storage all change in one synchronous step, so the new snapshot is complete.
        apply: () => {
          flushSync(() => {
            setPreferredMode(target);
          });
          applyToDocument(target);
          writeStoredDisplayMode(browserEnvironment(), target);
        },
      }).finally(() => {
        transitionRunning.current = false;
        setIsTransitioning(false);
      });
    },
    [forceOpaque, preferredMode],
  );

  const value = useMemo<DisplayModeContextValue>(
    () => ({ mode, glassAvailable: !forceOpaque, isTransitioning, toggleMode }),
    [forceOpaque, isTransitioning, mode, toggleMode],
  );

  return <DisplayModeContext value={value}>{children}</DisplayModeContext>;
}
