// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { clearDb, db } from "../../data/db.ts";
import { createParty } from "../../data/parties.ts";
import { postVoucher } from "../../data/vouchers.ts";
import { BillPage } from "./Bill.tsx";

afterEach(() => cleanup());

/** The bill once crashed here: two useStates sat below the loading return,
 * so loading → loaded rendered more hooks than the previous pass. */
describe("BillPage", () => {
  it("goes from loading to statement without a hooks-order crash", async () => {
    await clearDb(db);
    const { party } = await createParty({ name: "Bill Party", isCustomer: true, isSupplier: false });
    await postVoucher({
      type: "RECEIPT",
      partyId: party.id,
      businessDate: "2026-01-11",
      settlement: { cashPaise: 500 },
    });
    render(
      <MemoryRouter initialEntries={[`/parties/${party.id}/bill`]}>
        <Routes><Route path="/parties/:id/bill" element={<BillPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Loading bill/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Khata statement/i)).toBeTruthy());
    expect(screen.getAllByText(/Bill Party/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Closing due/i)).toBeTruthy();
  });
});
