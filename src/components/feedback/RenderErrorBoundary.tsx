import { Component, type ReactNode } from 'react';

interface RenderErrorBoundaryProps {
  readonly fallback: ReactNode;
  readonly children: ReactNode;
  readonly onError?: ((error: unknown) => void) | undefined;
}

interface RenderErrorBoundaryState {
  readonly failed: boolean;
}

/**
 * Contains a rendering failure (a GPU/WebGL scene, an external engine) to its own area: the
 * fallback replaces only that area, never the page.
 */
export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  override state: RenderErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RenderErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.warn('[Nusa Matra] Rendering area disabled, showing its fallback instead.', error);
    this.props.onError?.(error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
