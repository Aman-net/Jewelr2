// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AmountInput } from "./Field.tsx";

afterEach(() => cleanup());

describe("AmountInput", () => {
  it("groups digits live in Indian format while typing", async () => {
    const user = userEvent.setup();
    render(<AmountInput prefix="₹" placeholder="amt" />);
    const input = screen.getByPlaceholderText("amt") as HTMLInputElement;
    await user.type(input, "100000.5");
    expect(input.value).toBe("1,00,000.5");
  });

  it("keeps decimals and trailing dots editable", async () => {
    const user = userEvent.setup();
    render(<AmountInput prefix="g" placeholder="wt" />);
    const input = screen.getByPlaceholderText("wt") as HTMLInputElement;
    await user.type(input, "25000.");
    expect(input.value).toBe("25,000.");
  });
});
