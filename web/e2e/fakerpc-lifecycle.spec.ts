import { expect, test } from "@playwright/test";
import {
  fakeRpcPrepareAndConfirm,
  loginAs,
  provisionE2ERecipient,
  signOut,
  tinyJpeg,
} from "./helpers";

/**
 * Headless lifecycle against FakeRpc.
 * Freighter extension signing cannot be driven in headless Chromium.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test("FakeRpc award lifecycle through PAY", async ({ page }) => {
  const demo = await provisionE2ERecipient();

  // --- Sponsor creates + deploys + funds ---
  await loginAs(page, "sponsor", "demo-sponsor");
  await page.goto(`/programs/${demo.programId}/create-award`);
  await page.locator("#recipient_user_id").selectOption(demo.recipientUserId);
  await page.getByLabel(/Recipient Stellar/i).fill(demo.recipientWallet);
  await page.getByRole("button", { name: "Create award" }).click();
  await expect(page).toHaveURL(/\/awards\/[0-9a-f-]+/i, { timeout: 30_000 });
  const awardUrl = page.url();

  await expect(page.getByLabel("Testing context")).toContainText("SPONSOR");
  await expect(
    page.getByRole("button", { name: "Review award deployment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare payment" }),
  ).toHaveCount(0);

  await fakeRpcPrepareAndConfirm(page, "Review award deployment");
  await page.reload();

  await expect(
    page.getByRole("button", { name: "Prepare funding" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare payment" }),
  ).toHaveCount(0);
  await fakeRpcPrepareAndConfirm(page, "Prepare funding");
  await page.reload();
  await expect(
    page.getByText(/Award funded|Submission needed/i).first(),
  ).toBeVisible();

  // --- Recipient evidence + submit ---
  await signOut(page);
  await loginAs(page, "recipient", demo.recipientUsername);
  await page.goto(awardUrl);
  await page.getByRole("link", { name: /Open evidence upload/i }).click();
  await expect(page).toHaveURL(/\/evidence/);

  await page.getByLabel("Explanation").fill("Workshop completion evidence for e2e.");
  await page.getByLabel("Original source reference").fill("e2e-source-ref");
  await page.locator("#files").setInputFiles({
    name: "proof.jpg",
    mimeType: "image/jpeg",
    buffer: tinyJpeg(),
  });
  await page.getByRole("button", { name: "Save evidence revision" }).click();
  await expect(page).toHaveURL(/\/awards\/[0-9a-f-]+$/i, { timeout: 60_000 });
  await expect(
    page.getByRole("heading", { name: /Submit current evidence|Evidence history/i }).first(),
  ).toBeVisible({ timeout: 30_000 });

  const evidenceLink = page.locator('a[href*="/api/v1/evidence/"]').first();
  await expect(evidenceLink).toBeVisible();
  const evidenceHref = (await evidenceLink.getAttribute("href"))!;
  const download = await page.request.get(evidenceHref);
  expect(download.status()).toBe(200);
  expect((await download.body()).equals(tinyJpeg())).toBe(true);
  await signOut(page);
  await loginAs(page, "recipient", "demo-recipient-09");
  expect((await page.request.get(evidenceHref)).status()).toBe(404);
  await signOut(page);
  await loginAs(page, "administrator", "demo-admin");
  expect((await page.request.get(evidenceHref)).status()).toBe(404);
  await signOut(page);
  await loginAs(page, "recipient", demo.recipientUsername);
  await page.goto(`${awardUrl}/evidence`);

  await page.getByRole("link", { name: /Back to award/i }).click();
  await expect(
    page.getByRole("button", { name: "Prepare submission" }),
  ).toBeVisible();
  await fakeRpcPrepareAndConfirm(page, "Prepare submission");
  await page.reload();
  await expect(
    page.getByText(/Waiting for verifier|Submitted/i).first(),
  ).toBeVisible();

  // --- Verifier review + approve ---
  await signOut(page);
  await loginAs(page, "verifier", "demo-verifier");
  await page.goto(awardUrl);
  await page.getByRole("link", { name: /Open review/i }).click();
  await page.locator('input[name="source_confirmed"]').check();
  await page.getByLabel(/How you checked/i).fill("Checked original source in e2e.");
  await page.getByLabel(/^Action/i).fill("APPROVE");
  await page.getByLabel(/Rationale/i).fill("Looks good for FakeRpc e2e.");
  await page.getByRole("button", { name: /Request a review/i }).click();
  await expect(page.getByText(/Review .* recorded/i)).toBeVisible();

  await page.goto(awardUrl);
  await expect(
    page.getByRole("button", { name: "Prepare approval" }),
  ).toBeVisible();
  await fakeRpcPrepareAndConfirm(page, "Prepare approval");
  await page.reload();
  await expect(
    page.getByText(/Approved|Waiting for sponsor/i).first(),
  ).toBeVisible();

  // --- Sponsor pay ---
  await signOut(page);
  await loginAs(page, "sponsor", "demo-sponsor");
  await page.goto(awardUrl);
  await expect(
    page.getByRole("button", { name: "Prepare payment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare funding" }),
  ).toHaveCount(0);
  await fakeRpcPrepareAndConfirm(page, "Prepare payment");
  await page.reload();
  await expect(
    page.getByText(/Payment confirmed|PAID|20 Testnet XLM/i).first(),
  ).toBeVisible();
});
