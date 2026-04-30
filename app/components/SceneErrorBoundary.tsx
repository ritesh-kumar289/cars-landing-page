'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean; message: string };

/**
 * Wraps the R3F canvas. If WebGL is unavailable or any Three.js runtime
 * error occurs, this boundary catches it in production and renders a
 * graceful dark fallback instead of leaving a frozen loader screen.
 */
export default class SceneErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { failed: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { failed: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for debugging — won't appear in production user-facing UI
    console.error('[CarScene] Runtime error:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        // Dark fallback canvas substitute — at least the page text shows
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            background: '#050505',
            pointerEvents: 'none',
          }}
          aria-hidden
        />
      );
    }
    return this.props.children;
  }
}
