'use client';

/**
 * ErrorBoundary — catches render/runtime errors in a subtree, logs them
 * via the structured logger, and shows a graceful fallback instead of a
 * blank screen. Wrap the high-risk areas: 3D canvas, AR, drafts, uploads.
 *
 * React error boundaries must be class components — this is the one place
 * we use a class.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger, serializeError } from '@/lib/logger';

interface Props {
  children: ReactNode;
  /** Short label for logs, e.g. "cocktail-canvas". */
  label: string;
  /** Custom fallback; if omitted a minimal default is shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.child({ scope: 'error-boundary' }).error('subtree crashed', {
      label: this.props.label,
      error: serializeError(error).message,
      stack: serializeError(error).stack,
      componentStack: info.componentStack,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p
          className="text-amber-200/70 text-10 tracking-[0.4em] uppercase font-sans"
        >
          Something went wrong
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="px-5 py-2 rounded-full border border-amber-200/40 text-amber-100 hover:bg-amber-200/10 transition-colors text-11 tracking-[0.3em] uppercase font-sans"
        >
          Try again
        </button>
      </div>
    );
  }
}
