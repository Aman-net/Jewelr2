// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chip, EmptyState, Steps } from "./Bits.tsx";
import { FlowHeader } from "./Flow.tsx";
import { Segmented } from "./Segmented.tsx";
import { initialsOf } from "./PartyAvatar.tsx";
import { DuesHead } from "./Dues.tsx";

afterEach(() => cleanup());

describe("wizard bits", () => {
  it("shows step progress", () => {
    render(<Steps current={1} labels={["Party", "Goods", "Review"]} />);
    expect(screen.getByText("Party")).toBeTruthy();
    expect(screen.getByText("Review")).toBeTruthy();
  });

  it("chips toggle on click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Chip selected={false} onClick={onClick}>80</Chip>);
    await user.click(screen.getByText("80"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("empty states guide the operator", () => {
    render(<EmptyState title="No parties yet" hint="Add your first party." />);
    expect(screen.getByText("No parties yet")).toBeTruthy();
    expect(screen.getByText("Add your first party.")).toBeTruthy();
  });

  it("segmented control picks exclusive options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Segmented options={["GOLD", "SILVER"] as const} value="GOLD" onChange={onChange} />,
    );
    await user.click(screen.getByText("SILVER"));
    expect(onChange).toHaveBeenCalledWith("SILVER");
    rerender(<Segmented options={["GOLD", "SILVER"] as const} value="SILVER" onChange={onChange} />);
    expect(screen.getByText("SILVER").closest("button")?.className).toContain("bg-white");
  });
});

describe("flow header", () => {
  it("shows the verb, party context and progress", () => {
    render(
      <FlowHeader
        tone="emerald"
        title="Got payment"
        context="Received from Sharma"
        current={1}
        labels={["Party", "Amount", "Review"]}
      />,
    );
    expect(screen.getByText("Got payment")).toBeTruthy();
    expect(screen.getByText(/Received from Sharma/)).toBeTruthy();
    expect(screen.getByText("Amount")).toBeTruthy();
  });
});

describe("party avatars", () => {  it("derives initials from first and last words", () => {
    expect(initialsOf("Sharma Bullion")).toBe("SB");
    expect(initialsOf("Verma")).toBe("V");
    expect(initialsOf("  ")).toBe("?");
  });
});

describe("dues framing", () => {  it("frames receivable vs payable in operator words", () => {
    const { unmount } = render(<DuesHead cashPaise={50000} goldFineMg={0} silverFineMg={0} />);
    expect(screen.getByText("You will get")).toBeTruthy();
    unmount();
    render(<DuesHead cashPaise={-50000} goldFineMg={0} silverFineMg={0} />);
    expect(screen.getByText("You will give")).toBeTruthy();
  });

  it("chips metal dues in grams", () => {
    render(<DuesHead cashPaise={0} goldFineMg={80000} silverFineMg={-40000} />);
    expect(screen.getByText(/80 g.*gold/)).toBeTruthy();
    expect(screen.getByText(/40 g.*silver/)).toBeTruthy();
  });
});
