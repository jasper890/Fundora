import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, loginAs, signOut } from "./helpers";

test("staff provisions an unprivileged account and first login requires a verified password change", async ({ page }) => {
  await loginAs(page, "administrator", "demo-admin");
  await page.goto("/admin");
  const username = `test-account-${Date.now().toString(36)}`;
  await page.getByLabel("New username").fill(username);
  await page.getByLabel("Temporary password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText(`Account ${username} created.`, { exact: false })).toBeVisible();
  await signOut(page);

  await page.goto("/login/recipient");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/password-change/);
  const origin = new URL(page.url()).origin;
  const rejected = await page.request.post("/api/v1/session/password", {
    headers: { Origin: origin }, data: { current_password: "Wrong-password-999", new_password: "Changed-password-456", confirm_password: "Changed-password-456" },
  });
  expect(rejected.status()).toBe(400);
  await page.getByLabel("Current password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill("Changed-password-456");
  await page.getByLabel(/Confirm.*password/i).fill("Changed-password-456");
  await page.getByRole("button", { name: /Change password|Save password|Update password/i }).click();
  await expect(page).toHaveURL(/\/programs/);
  const admin = await page.request.get("/admin");
  expect(admin.url()).toMatch(/\/forbidden/);
  await signOut(page);
  await page.goto("/login/recipient");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("Changed-password-456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/programs/);
});
