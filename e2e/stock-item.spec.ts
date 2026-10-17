import { expect, test } from "@playwright/test";

/**
 * Stock item detail is a dedicated page (not a bottom sheet), with a running
 * shelf balance per movement. Gate slice: seed → open item → adjust.
 */
test("stock item opens a dedicated page and adjusts", async ({ page }) => {
  await page.goto("/#/stock");
  await expect(page.getByText("No stock yet")).toBeVisible();

  // Seed 75 g of silver Payal from the empty state.
  await page.getByRole("button", { name: "Seed count" }).click();
  await page.getByRole("button", { name: "Item", exact: true }).click();
  await page.getByRole("button", { name: "Payal", exact: true }).click();
  await page.getByLabel("Weight").fill("75");
  await page.getByRole("button", { name: "Seed stock" }).click();

  // The row opens a full page, not a sheet.
  await expect(page.getByRole("heading", { name: "Stock" })).toBeVisible();
  await page.getByRole("link", { name: /Payal/ }).click();
  await expect(page).toHaveURL(/stock\/item\?metal=SILVER&name=Payal/);
  await expect(page.getByRole("heading", { name: "Payal" })).toBeVisible();
  await expect(page.getByText("75 g in stock")).toBeVisible();
  await expect(page.getByText("Opening count")).toBeVisible();

  // Adjust 10 g off; the page returns to the item, running balance drops.
  await page.getByRole("link", { name: "Adjust stock" }).click();
  await expect(page.getByRole("heading", { name: "Adjust · Payal" })).toBeVisible();
  await page.getByLabel("Weight").fill("10");
  await page.getByRole("button", { name: "Remove from shelf", exact: true }).click();
  await page.getByLabel(/Reason/).fill("damage");
  await page.getByRole("button", { name: "Save adjustment" }).click();

  await expect(page.getByRole("heading", { name: "Payal" })).toBeVisible();
  await expect(page.getByText("damage")).toBeVisible();
  await expect(page.getByText("−10 g")).toBeVisible();
  await expect(page.getByText("65 g in stock")).toBeVisible();
});

/**
 * Saved selling labour is a per-item default that arrives pre-filled when the
 * item is sold — saving the operator from retyping it every bill.
 */
test("saved selling labour auto-fills on a sale", async ({ page }) => {
  // Seed stock so the item exists to pick.
  await page.goto("/#/stock");
  await page.getByRole("button", { name: "Seed count" }).click();
  await page.getByRole("button", { name: "Item", exact: true }).click();
  await page.getByRole("button", { name: "Payal", exact: true }).click();
  await page.getByLabel("Weight").fill("75");
  await page.getByRole("button", { name: "Seed stock" }).click();

  // Save selling labour: ₹50 per piece, on the item page.
  await page.getByRole("link", { name: /Payal/ }).click();
  await page.getByRole("button", { name: "Per piece", exact: true }).click();
  await page.getByLabel("Rate").fill("50");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByText(/₹50\.00 per piece/)).toBeVisible();

  // Sell the item — the labour line should already be set.
  await page.goto("/#/parties/new");
  await page.getByPlaceholder("e.g. Sharma Bullion").fill("E2E Labour Party");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("link", { name: /gave goods/i }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("button", { name: "Item", exact: true }).click();
  await page.getByRole("button", { name: "Payal", exact: true }).click();
  await expect(page.getByLabel("Labour rate")).toHaveValue("50");

  // Post the sale, then the item page shows the labour it moved at.
  await page.getByLabel("Weight").fill("10");
  await page.getByRole("button", { name: "80", exact: true }).click();
  await page.getByLabel("Pieces").fill("1");
  await page.getByRole("button", { name: /^Review/ }).click();
  await page.getByRole("button", { name: "Confirm & post" }).click();
  await expect(page.getByText("Sale recorded")).toBeVisible();

  await page.goto("/#/stock/item?metal=SILVER&name=Payal");
  await expect(page.getByText(/Labour 1 pcs × ₹50\.00 = ₹50\.00/)).toBeVisible();
});
