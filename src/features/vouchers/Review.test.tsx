// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildVoucher } from "../../domain/index.ts";
import { Review } from "./Review.tsx";

afterEach(() => cleanup());

const voucher = buildVoucher({
  id: "33333333-3333-4333-8333-333333333333",
  shopId: "shop-local-1",
  type: "SALE",
  partyId: "22222222-2222-4222-8222-222222222222",
  businessDate: "2026-01-10",
  createdAt: "2026-01-10T10:00:00.000Z",
  lines: [
    {
      metalType: "SILVER",
      categoryName: "Payal",
      physicalMg: 100_000,
      agreedTunchScaled: 8000,
      pricingMode: "METAL_OPEN",
    },
  ],
});

describe("Review", () => {
  it("shows the calculation breakdown and ledger change before posting", () => {
    render(
      <Review
        voucher={voucher}
        cash={0}
        gold={0}
        silver={80000}
        partyName="Sharma"
        posting={false}
        error=""
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/Sharma/)).toBeTruthy();
    expect(screen.getByText("80 g")).toBeTruthy();
    expect(screen.getByText("Confirm & post")).toBeTruthy();
  });

  it("confirms explicitly and surfaces errors", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Review
        voucher={voucher}
        cash={0}
        gold={0}
        silver={80000}
        partyName="Sharma"
        posting={false}
        error="Something went wrong"
        onBack={() => {}}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    await user.click(screen.getByText("Confirm & post"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
