let cached: boolean | null = null;

/** True when the browser can create a WebGL context. Checked once and cached. */
export function supportsWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    cached = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    cached = false;
  }
  return cached;
}

/** Runs `callback` when the main thread is idle (or after a short timeout where unsupported). */
export function whenIdle(callback: () => void): { cancel: () => void } {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, { timeout: 1500 });
    return {
      cancel: () => {
        window.cancelIdleCallback(handle);
      },
    };
  }
  const handle = window.setTimeout(callback, 300);
  return {
    cancel: () => {
      window.clearTimeout(handle);
    },
  };
}
