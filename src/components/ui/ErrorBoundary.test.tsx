// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AppErrorBoundary } from "./ErrorBoundary.tsx";

afterEach(() => cleanup());

function Boom({ go }: { go: boolean }) {
  if (go) throw new Error("kaboom-screen");
  return <div>recovered screen</div>;
}

describe("AppErrorBoundary", () => {
  it("turns a render crash into a recoverable screen", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AppErrorBoundary><Boom go /></AppErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("kaboom-screen")).toBeTruthy();
    rerender(
      <AppErrorBoundary><Boom go={false} /></AppErrorBoundary>,
    );
    await user.click(screen.getByText("Try again"));
    expect(screen.getByText("recovered screen")).toBeTruthy();
  });
});
