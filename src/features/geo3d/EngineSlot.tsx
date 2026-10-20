import { Suspense, useState, type ComponentType, type ReactNode } from 'react';
import { RenderErrorBoundary } from '@/components/feedback/RenderErrorBoundary';
import type { GeoEngineBaseProps } from './contract';
import styles from './EngineSlot.module.css';

/** Why the placeholder is visible: no engine for this slot, engine loading, or engine failed. */
export type EngineSlotState = 'absent' | 'loading' | 'failed';

interface EngineSlotProps<P extends GeoEngineBaseProps> {
  /** The registered engine component, or `null` while it has not been integrated. */
  readonly engine: ComponentType<P> | null;
  /** Everything the host passes to the engine except the readiness callbacks the slot owns. */
  readonly engineProps: Omit<P, 'onReady' | 'onError'>;
  /** Lightweight static stand-in, shown while the engine is absent, loading, or after it fails. */
  readonly placeholder: ReactNode | ((state: EngineSlotState) => ReactNode);
  readonly className?: string | undefined;
}

/**
 * Hosts an external 3D engine component. The placeholder stays underneath until the engine
 * reports its first frame, so the area is never blank; an engine error or a failed lazy import
 * leaves the placeholder in place and the rest of the page untouched.
 */
export function EngineSlot<P extends GeoEngineBaseProps>({
  engine: Engine,
  engineProps,
  placeholder,
  className,
}: EngineSlotProps<P>) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const showEngine = Engine !== null && !failed;
  const state: EngineSlotState = Engine === null ? 'absent' : failed ? 'failed' : 'loading';

  const handleError = (error: unknown) => {
    console.warn('[Nusa Matra] 3D engine reported an error; keeping the static placeholder.', error);
    setFailed(true);
    setReady(false);
  };

  return (
    <div className={[styles.slot, className].filter(Boolean).join(' ')} data-engine={ready ? 'ready' : state}>
      <div className={styles.placeholder} data-hidden={ready || undefined}>
        {typeof placeholder === 'function' ? placeholder(state) : placeholder}
      </div>
      {showEngine && (
        <RenderErrorBoundary fallback={null} onError={handleError}>
          <Suspense fallback={null}>
            <div className={styles.engine} data-ready={ready || undefined}>
              <Engine
                {...(engineProps as P)}
                onReady={() => {
                  setReady(true);
                }}
                onError={handleError}
              />
            </div>
          </Suspense>
        </RenderErrorBoundary>
      )}
    </div>
  );
}
