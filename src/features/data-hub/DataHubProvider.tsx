import { useMemo, useState, type ReactNode } from 'react';
import { publicConfig } from '@/lib/publicConfig';
import { createDataHubRepository, type DataMode, type NusaMatraDataHubRepository } from '@/services/api';
import { DataHubContext } from './dataHubContext';

interface DataHubProviderProps {
  readonly children: ReactNode;
  /** Tests inject a repository over a fake `fetch`; `null` means "not configured". */
  readonly repository?: NusaMatraDataHubRepository | null;
  readonly initialDataMode?: DataMode;
}

function repositoryFromConfig(): NusaMatraDataHubRepository | null {
  return publicConfig.apiBaseUrl ? createDataHubRepository(publicConfig.apiBaseUrl) : null;
}

/**
 * Owns the Data Hub repository and the DEMO/LIVE choice for the whole app. The mode starts at the
 * configured default and changes only when the user picks the other one; nothing falls back from
 * one mode to the other.
 */
export function DataHubProvider({ children, repository, initialDataMode }: DataHubProviderProps) {
  const [ownRepository] = useState(repositoryFromConfig);
  const [dataMode, setDataMode] = useState<DataMode>(initialDataMode ?? publicConfig.dataMode);

  const value = useMemo(
    () => ({ repository: repository === undefined ? ownRepository : repository, dataMode, setDataMode }),
    [repository, ownRepository, dataMode],
  );

  return <DataHubContext value={value}>{children}</DataHubContext>;
}
