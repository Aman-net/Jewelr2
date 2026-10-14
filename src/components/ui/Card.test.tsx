// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BalanceGrid } from "./Card.tsx";

afterEach(() => cleanup());

describe("BalanceGrid", () => {
  it("renders cash and fine-metal balances", () => {
    render(<BalanceGrid cashPaise={10050000} goldFineMg={0} silverFineMg={80000} />);
    expect(screen.getByText("₹1,00,500.00")).toBeTruthy();
    expect(screen.getByText("80 g")).toBeTruthy();
  });

  it("is a pure readout with no actions", async () => {
    const onClick = vi.fn();
    render(
      <div onClick={onClick}>
        <BalanceGrid cashPaise={0} goldFineMg={0} silverFineMg={0} />
      </div>,
    );
    await userEvent.click(screen.getByText("Cash"));
    expect(onClick).toHaveBeenCalled();
  });
});
