import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

for (const role of ["sponsor", "verifier", "recipient", "administrator"] as const) {
  test(`${role} workspace fits desktop, tablet and mobile`, async ({ page }, info) => {
    await loginAs(page, role, role === "administrator" ? "demo-admin" : role === "recipient" ? "demo-recipient-01" : `demo-${role}`);
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${role}-${width}.png`), fullPage: true });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const transition = await page.getByRole("button").first().evaluate(element => getComputedStyle(element).transitionDuration);
    expect(transition.split(",").every(value => parseFloat(value) <= 0.01)).toBe(true);
    await page.reload();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });
}
