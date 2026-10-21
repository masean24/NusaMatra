import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { parseRegionId } from '@/features/exploration';

/** Bandingkan's shareable URL state: region A (`?a=`) and region B (`?b=`), as Data Hub region codes. */
export function useComparisonParams(): {
  readonly a: string | null;
  readonly b: string | null;
  readonly setA: (code: string | null) => void;
  readonly setB: (code: string | null) => void;
  readonly swap: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const a = parseRegionId(searchParams.get('a'));
  const b = parseRegionId(searchParams.get('b'));

  const write = useCallback(
    (nextA: string | null, nextB: string | null) => {
      setSearchParams((params) => {
        if (nextA) params.set('a', nextA);
        else params.delete('a');
        if (nextB) params.set('b', nextB);
        else params.delete('b');
        return params;
      });
    },
    [setSearchParams],
  );

  return {
    a,
    b,
    setA: (code) => {
      write(code, b);
    },
    setB: (code) => {
      write(a, code);
    },
    swap: () => {
      write(b, a);
    },
  };
}
