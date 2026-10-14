import { expect, test } from "@playwright/test";

/**
 * Phase 4 gate slice: a representative day on one device — create, transact,
 * reload (persistence), then offline (installed shell). Pixel 7 viewport ≈
 * the operator's phone. Single test: browser storage is isolated per test.
 */
test("representative day survives reloads and works offline", async ({ page, context }) => {
  // New party.
  await page.goto("/#/parties/new");
  await page.getByPlaceholder("e.g. Sharma Bullion").fill("E2E Sharma");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "E2E Sharma" })).toBeVisible();

  // Record a receipt of ₹1,000.
  await page.getByRole("link", { name: /received/i }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByLabel("Cash received").fill("1000.00");
  await page.getByRole("button", { name: /review/i }).click();
  await page.getByRole("button", { name: "Confirm & post" }).click();
  await expect(page.getByText("Payment recorded")).toBeVisible();
  await page.getByRole("button", { name: "View khata" }).click();
  await expect(page.getByText("you give")).toBeVisible();

  // Data survives a reload.
  await page.goto("/#/");
  await expect(page.getByText("E2E Sharma").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("E2E Sharma").first()).toBeVisible();

  // Installed shell opens offline once loaded.
  await page.reload();
  await expect(page.getByText("E2E Sharma").first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Jewelr")).toBeVisible();
  await expect(page.getByText("E2E Sharma").first()).toBeVisible();
});
