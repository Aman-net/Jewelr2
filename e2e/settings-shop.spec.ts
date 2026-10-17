import { expect, test } from "@playwright/test";

/**
 * Shop details are the bill PDF header: entered once in Settings, they persist
 * and remove the "add your shop name" nudge on the Bill screen.
 */
test("shop details save, persist, and clear the bill nudge", async ({ page }) => {
  // No shop name yet: the Bill screen points the operator at Settings.
  await page.goto("/#/parties/new");
  await page.getByPlaceholder("e.g. Sharma Bullion").fill("E2E Bill Party");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "E2E Bill Party" })).toBeVisible();
  await page.getByRole("link", { name: /^Bill/ }).click();
  await expect(page.getByText(/Add it in Settings/)).toBeVisible();

  // Save the shop identity in Settings.
  await page.goto("/#/settings/backup");
  await page.getByLabel("Shop name").fill("E2E Bullion");
  await page.getByLabel("Address").fill("Sarafa Bazar, Indore");
  await page.getByLabel("Phone").fill("98765 43210");
  await page.getByRole("button", { name: "Save shop details" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  // Survives a reload (kept in app_settings, so it also rides in backups).
  await page.reload();
  await expect(page.getByLabel("Shop name")).toHaveValue("E2E Bullion");
  await expect(page.getByLabel("Address")).toHaveValue("Sarafa Bazar, Indore");

  // The nudge is gone now that the header is filled in.
  await page.goto("/#/parties");
  await page.getByRole("link", { name: /E2E Bill Party/ }).first().click();
  await page.getByRole("link", { name: /^Bill/ }).click();
  await expect(page.getByText(/Add it in Settings/)).toHaveCount(0);
});
