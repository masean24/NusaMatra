import { useContext } from 'react';
import { DataHubContext, type DataHubContextValue } from './dataHubContext';

export function useDataHub(): DataHubContextValue {
  const value = useContext(DataHubContext);
  if (!value) throw new Error('useDataHub must be used inside <DataHubProvider>.');
  return value;
}
