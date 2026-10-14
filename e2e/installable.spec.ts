import { expect, test } from "@playwright/test";

/** PWA installability criteria, checked against the real production build. */
test("PWA is installable", async ({ page }) => {
  await page.goto("/#/");

  // Web manifest resolves with the required fields.
  const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
  expect(manifestHref).toBeTruthy();
  const manifestRes = await page.request.get(manifestHref as string);
  expect(manifestRes.ok()).toBeTruthy();
  const manifest = await manifestRes.json();
  expect(manifest.name).toBe("Jewelr");
  expect(manifest.short_name).toBe("Jewelr");
  expect(manifest.display).toBe("standalone");

  // 192 + 512 icons exist and download.
  const sizes = (manifest.icons as { sizes: string; src: string }[]).map((i) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await page.request.get(`/${icon.src}`);
    expect(res.ok()).toBeTruthy();
  }

  // A service worker takes control of the page. Like a real device, wait
  // for it to finish installing its precache before reloading.
  await expect
    .poll(
      () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state),
      { timeout: 20_000 },
    )
    .toBe("activated");
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 20_000 })
    .toBe(true);
});
