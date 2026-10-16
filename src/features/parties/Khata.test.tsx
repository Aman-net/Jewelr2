// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { clearDb, db } from "../../data/db.ts";
import { createParty } from "../../data/parties.ts";
import { postVoucher } from "../../data/vouchers.ts";
import { KhataPage } from "./Khata.tsx";

afterEach(() => cleanup());

/** The khata must open on Total with no leftover toggle references. */
describe("KhataPage", () => {
  it("opens a customer khata showing the total balance", async () => {
    await clearDb(db);
    const { party } = await createParty({ name: "Khata Party", isCustomer: true, isSupplier: false });
    await postVoucher({
      type: "SALE",
      partyId: party.id,
      businessDate: "2026-01-10",
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
    render(
      <MemoryRouter initialEntries={[`/parties/${party.id}`]}>
        <Routes><Route path="/parties/:id" element={<KhataPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Khata Party")).toBeTruthy());
    expect(screen.queryByText("Sale dues")).toBeNull();
    expect(screen.queryByText("Customer dues")).toBeNull();
  });
});
