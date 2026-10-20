import { createContext, useContext } from 'react';
import type { DisplayMode } from './displayModePreference';

export interface DisplayModeContextValue {
  /** The mode currently painted on the page. */
  readonly mode: DisplayMode;
  /** False when the device asks for opaque surfaces (reduced transparency or more contrast). */
  readonly glassAvailable: boolean;
  readonly isTransitioning: boolean;
  /** Switches mode; `origin` is the toggle's on-screen box, where the circular reveal starts. */
  readonly toggleMode: (origin?: DOMRect) => void;
}

export const DisplayModeContext = createContext<DisplayModeContextValue | null>(null);

export function useDisplayMode(): DisplayModeContextValue {
  const context = useContext(DisplayModeContext);
  if (!context) {
    throw new Error('useDisplayMode must be used inside <DisplayModeProvider>.');
  }
  return context;
}
