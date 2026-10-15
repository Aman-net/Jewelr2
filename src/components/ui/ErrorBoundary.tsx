import { Component } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button.tsx";

interface State {
  error?: Error;
  at?: string;
}

/**
 * Permanent crash net around every route. A rendering crash (the old white
 * screen) becomes a recoverable screen with the error text, a retry, and a
 * way home. Costs nothing when healthy. Reset on every route change via key.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: unknown): State {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      at: new Date().toLocaleString("en-IN"),
    };
  }

  componentDidCatch(error: Error): void {
    // Visible in remote debugging; never leaves the device.
    console.error("[Jewelr crash]", error);
  }

  private retry = (): void => {
    this.setState({ error: undefined, at: undefined });
  };

  render(): ReactNode {
    const { error, at } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-3 px-4 pb-6 pt-16">
        <div className="text-2xl font-bold tracking-tight text-stone-900">Something went wrong</div>
        <p className="text-sm text-stone-600">
          Your entries are safe — this is a display problem, not lost data. If it repeats,
          note the detail below when reporting it.
        </p>
        <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-stone-700">Error detail</summary>
          <p className="mt-1 break-words text-xs text-red-800">{error.message}</p>
          {at ? <p className="mt-1 text-xs text-stone-500">{at}</p> : null}
        </details>
        <Button full onClick={this.retry}>Try again</Button>
        <div className="flex gap-2">
          <div className="flex-1">
            <a href="#/" className="block rounded-2xl border border-stone-300 bg-white px-4 py-3 text-center text-sm font-semibold text-stone-800">
              Open home
            </a>
          </div>
          <div className="flex-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="block w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-center text-sm font-semibold text-stone-800"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
