// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "./router.tsx";

afterEach(() => cleanup());

/**
 * Regression: entry screens must mount without crashing. useBlocker throws
 * outside a data router — this test pins the router setup that allows it.
 */
describe("router", () => {
  it("mounts the sale entry flow", async () => {
    window.location.hash = "#/vouchers/new/sale";
    render(<Router />);
    expect(await screen.findByText("Sell goods")).toBeTruthy();
    expect(screen.getByText("Who is buying?")).toBeTruthy();
  });

  it("mounts the receipt entry flow", async () => {
    window.location.hash = "#/vouchers/new/receipt";
    render(<Router />);
    expect(await screen.findByText("Got payment")).toBeTruthy();
  });
});
