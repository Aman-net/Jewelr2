import { expect, test, type Page } from "@playwright/test";

/**
 * The core wholesale cycle, end to end on the operator's phone viewport:
 *   sale with metal-open gold → metal receipt → rate fix (CONVERSION)
 *   → khata ends cash-only, metal dues closed.
 * Metal-open dues ARE the business (owner, 2026-10-16) — this is the flow the
 * app must not get wrong.
 */
test("metal-open sale → metal receipt → rate fix closes to cash", async ({ page }) => {
  // New customer party.
  await page.goto("/#/parties/new");
  await page.getByPlaceholder("e.g. Sharma Bullion").fill("E2E Metal Party");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "E2E Metal Party" })).toBeVisible();

  // SALE — 10 g gold, owes metal (METAL_OPEN), billing tunch 91.6 →
  // fine owed = 10 g x 91.6% = 9.16 g, zero cash on this bill.
  await goToGoodsStep(page);
  await page.getByRole("button", { name: "Gold", exact: true }).click();
  await page.getByRole("button", { name: "Item", exact: true }).click();
  await page.getByRole("button", { name: "Chain", exact: true }).click();
  await page.getByLabel("Weight").fill("10");
  await page.getByRole("button", { name: "91.6", exact: true }).click();
  await expect(page.getByText("Party owes fine 9.16 g")).toBeVisible();
  await page.getByRole("button", { name: /^Review/ }).click();
  await page.getByRole("button", { name: "Confirm & post" }).click();
  await expect(page.getByText("Sale recorded")).toBeVisible();

  // Khata shows the gold fine due.
  await page.getByRole("button", { name: "View khata" }).click();
  await expect(page.getByText("+9.16 g").first()).toBeVisible();

  // RECEIPT — 4 g gold back at tested tunch 91.6 → 3.664 g fine credited.
  // Remaining gold due = 9.16 − 3.664 = 5.496 g.
  await page.getByRole("link", { name: /received/i }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  const goldSection = page.locator('div[class*="border-amber-200"]');
  await goldSection.getByLabel("Weight").fill("4");
  await goldSection.getByPlaceholder("Or type exact %").fill("91.6");
  await expect(page.getByText("→ 3.664 g fine")).toBeVisible();
  await page.getByRole("button", { name: /^Review/ }).click();
  await page.getByRole("button", { name: "Confirm & post" }).click();
  await expect(page.getByText("Payment recorded")).toBeVisible();

  // CONVERSION — fix the remaining 5.496 g at ₹79,000/10 g →
  // 5.496 g × ₹7,900/g = ₹43,418.40 cash due (cash column takes the fine).
  await page.getByRole("button", { name: "View khata" }).click();
  await expect(page.getByText("+5.496 g").first()).toBeVisible();
  await page.getByRole("link", { name: /fix rate/i }).click();
  // Defaults already fit: side "Party owes me", metal Gold, direction Metal→cash.
  await page.getByLabel("Fine weight owed").fill("5.496");
  await page.getByLabel(/^Rate\b/).fill("79000");
  await page.getByRole("button", { name: /^Review/ }).click();
  // On review before posting: gold fine due −5.496 g, cash +₹43,418.40.
  await expect(page.getByText(/43,418\.40/).first()).toBeVisible();
  await expect(page.getByText("−5.496 g").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm & post" }).click();
  await expect(page.getByText("Rate fixed")).toBeVisible();
  await page.getByRole("button", { name: "View khata" }).click();

  // Final khata: metal dues fully closed, cash due remains.
  await expect(page.getByText("+₹43,418.40").first()).toBeVisible();
  await expect(page.getByText("settled").first()).toBeVisible();

  // Reload: exactly the same numbers come back from storage.
  await page.reload();
  await expect(page.getByText("+₹43,418.40").first()).toBeVisible();
  await expect(page.getByText("E2E Metal Party").first()).toBeVisible();
});

/** The party is preselected on the khata link (?party=id) — pass that step. */
async function goToGoodsStep(page: Page): Promise<void> {
  await page.getByRole("link", { name: /gave goods/i }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
}
