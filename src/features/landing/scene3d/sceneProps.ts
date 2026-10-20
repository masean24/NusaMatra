import type { RefObject } from 'react';
import type { DisplayMode } from '@/features/theme';

export interface SceneProps {
  /** The zone element; scroll-linked scenes measure their progress against it. */
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly mode: DisplayMode;
  readonly reducedMotion: boolean;
  readonly values: readonly number[] | undefined;
  /** Called after the first frame renders, so the zone can fade the poster out. */
  readonly onReady: () => void;
}
