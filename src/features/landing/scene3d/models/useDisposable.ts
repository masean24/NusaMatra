import { useEffect, useMemo, type DependencyList } from 'react';

interface Disposable {
  dispose: () => void;
}

/**
 * Creates GPU resources once per dependency change and frees them when they are replaced or the
 * scene unmounts. three.js never releases geometry or materials on its own.
 */
export function useDisposable<T extends Disposable | readonly Disposable[]>(
  factory: () => T,
  deps: DependencyList,
): T {
  // eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps -- generic resource hook: the caller owns the dependency list
  const resource = useMemo(factory, deps);
  useEffect(
    () => () => {
      const list: readonly Disposable[] = Array.isArray(resource) ? resource : [resource as Disposable];
      list.forEach((item) => {
        item.dispose();
      });
    },
    [resource],
  );
  return resource;
}
