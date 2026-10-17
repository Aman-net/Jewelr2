import { expect, test, type Page } from "@playwright/test";

/**
 * The phone/browser back button is not the browser's to decide: every screen
 * declares one parent, and a back press goes there — the same place the in-app
 * back button goes. These are the rules the owner set on 2026-10-17.
 */

const hash = (page: Page): string => new URL(page.url()).hash;

async function newParty(page: Page, name: string): Promise<void> {
  await page.goto("/#/parties/new");
  await page.getByPlaceholder("e.g. Sharma Bullion").fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("a khata's back is the parties list, wherever it was opened from", async ({ page }) => {
  await newParty(page, "Back One");

  // Opened from Home's party list (moving between tabs the way a thumb does —
  // in-app, not by typing a URL).
  await page.getByRole("link", { name: "Home" }).click();
  expect(hash(page)).toBe("#/");
  await page.getByRole("link", { name: /Back One/ }).first().click();
  expect(hash(page)).toContain("/parties/");
  await page.goBack();
  await expect.poll(() => hash(page)).toBe("#/parties");

  // Opened from the parties tab — same answer, with no bounce through Home.
  expect(hash(page)).toBe("#/parties");
  await page.getByRole("link", { name: /Back One/ }).first().click();
  expect(hash(page)).toContain("/parties/");
  await page.goBack();
  await expect.poll(() => hash(page)).toBe("#/parties");
});

test("back on Home stays Home", async ({ page }) => {
  await page.goto("/#/");
  await page.getByRole("link", { name: "Parties" }).click();
  expect(hash(page)).toBe("#/parties");
  await page.getByRole("link", { name: "Home" }).click();
  expect(hash(page)).toBe("#/");

  await page.goBack();
  await page.waitForTimeout(500);
  expect(hash(page)).toBe("#/");
});

test("the sale wizard's back steps up the flow, then out to the khata", async ({ page }) => {
  await newParty(page, "Back Steps");
  const khata = hash(page);

  await page.getByRole("link", { name: /gave goods/i }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  const sale = hash(page);
  await expect(page.getByText("Giving goods to Back Steps")).toBeVisible();

  // Step 2 → step 1: the press is spent on the wizard's own ladder, not on
  // throwing the entry away.
  await page.goBack();
  await page.waitForTimeout(500);
  expect(hash(page)).toBe(sale);
  await expect(page.getByText("Who is buying?")).toBeVisible();
  await expect(page.getByText("Leave without saving?")).toBeHidden();

  // Step 1 → out to the khata it was started from.
  await page.goBack();
  await expect.poll(() => hash(page)).toBe(khata);
});

test("leaving the party step with typed work still asks first", async ({ page }) => {
  await newParty(page, "Back Guard");
  const khata = hash(page);
  await page.getByRole("link", { name: /gave goods/i }).click();

  // A changed date is something to lose, so the party step asks before leaving.
  await page.locator('input[type="date"]').fill("2026-10-01");
  await page.goBack();
  await expect(page.getByText("Leave without saving?")).toBeVisible();
  await page.getByRole("button", { name: "Stay here" }).click();
  expect(hash(page)).toContain("/vouchers/new/sale");

  await page.goBack();
  await page.getByRole("button", { name: "Leave & discard" }).click();
  await expect.poll(() => hash(page)).toBe(khata);
});

test("the New entry picker has a back button and keeps the tab bar", async ({ page }) => {
  await page.goto("/#/");
  await page.getByRole("link", { name: "Add" }).click();
  expect(hash(page)).toBe("#/vouchers/new");
  await expect(page.getByRole("navigation")).toBeVisible();

  await page.getByRole("button", { name: "Home" }).click();
  expect(hash(page)).toBe("#/");
});

test("a cold start on a khata backs into the parties list, not out of the app", async ({ page, context }) => {
  await newParty(page, "Back Cold");
  const khata = hash(page);

  // A fresh tab has no history behind it — this is the deep-link case.
  const fresh = await context.newPage();
  await fresh.goto(`/${khata}`);
  expect(hash(fresh)).toBe(khata);
  await fresh.goBack();
  await expect.poll(() => hash(fresh)).toBe("#/parties");
  await fresh.close();
});

test("a voucher's back is its party's khata", async ({ page, context }) => {
  await newParty(page, "Back Voucher");
  const khata = hash(page);

  await page.getByRole("link", { name: /gave goods/i }).click();
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("button", { name: "Gold", exact: true }).click();
  await page.getByRole("button", { name: "Item", exact: true }).click();
  await page.getByRole("button", { name: "Chain", exact: true }).click();
  await page.getByLabel("Weight").fill("10");
  await page.getByRole("button", { name: "91.6", exact: true }).click();
  await page.getByRole("button", { name: /^Review/ }).click();
  await page.getByRole("button", { name: "Confirm & post" }).click();
  await page.getByRole("button", { name: "View khata" }).click();

  await page.getByText("SALE").first().click();
  const voucher = hash(page);
  expect(voucher).toContain("/vouchers/");

  // Same rule from a cold start: the voucher knows which khata it belongs to.
  const fresh = await context.newPage();
  await fresh.goto(`/${voucher}`);
  await fresh.goBack();
  await expect.poll(() => hash(fresh)).toBe(khata);
  await fresh.close();
});
