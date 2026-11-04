import { createContext } from 'react';
import type { DataMode, NusaMatraDataHubRepository } from '@/services/api';

export interface DataHubContextValue {
  /** `null` when the app has no Data Hub address configured: every data panel says so. */
  readonly repository: NusaMatraDataHubRepository | null;
  /** The Data Hub mode. Independent of the Normal/Kaca appearance mode. */
  readonly dataMode: DataMode;
  readonly setDataMode: (mode: DataMode) => void;
  /** Counts the "Coba lagi" presses; each one makes every resource that failed load again. */
  readonly retryEpoch: number;
  readonly retryFailed: () => void;
}

export const DataHubContext = createContext<DataHubContextValue | null>(null);
