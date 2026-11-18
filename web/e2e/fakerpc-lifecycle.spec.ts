import { expect, test } from "@playwright/test";
import postgres from "postgres";
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

test("Sponsor creates a community project and completes the FakeRpc award lifecycle", async ({ page }) => {
  const demo = await provisionE2ERecipient();
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const validBody = {
    title: "Repair the community benches",
    requirements_text: "Provide a completion record that can be checked against the inspection log.",
    verifier_member_id: "00000000-0000-4000-8000-000000000001",
    claim_deadline: new Date(Date.now() + 86400000).toISOString(),
    review_deadline: new Date(Date.now() + 172800000).toISOString(),
    payout_deadline: new Date(Date.now() + 259200000).toISOString(),
  };
  const create = (data = validBody) => page.request.post("/api/v1/programs", { headers: { Origin: origin }, data });
  expect((await create()).status()).toBe(401);
  await loginAs(page, "administrator", "demo-admin");
  expect((await create()).status()).toBe(403);
  await signOut(page);
  await loginAs(page, "verifier", "demo-verifier");
  expect((await create()).status()).toBe(403);
  await signOut(page);
  await loginAs(page, "sponsor", "demo-sponsor");
  expect((await create()).status()).toBe(403);
  expect((await create({ ...validBody, payout_deadline: validBody.claim_deadline })).status()).toBe(400);
  await page.goto("/programs/create");
  await expect(page.getByRole("link", { name: "Fundora home" })).toBeVisible();
  await page.getByLabel("Project title").fill(validBody.title);
  await page.getByLabel("Completion requirements").fill(validBody.requirements_text);
  const verifierSelect = page.getByLabel("Independent verifier");
  const verifierOption = verifierSelect.getByRole("option", { name: /^demo-verifier · Synthetic Fundora community repair/ });
  const verifierId = (await verifierOption.getAttribute("value"))!;
  await verifierSelect.selectOption(verifierId);
  const eligibilityDb = postgres(process.env.DATABASE_URL!, { prepare: false });
  try {
    const [sponsor] = await eligibilityDb`
      select s.id from program_member s join program_member v on v.program_id = s.program_id
      where v.id = ${verifierId} and s.role = 'SPONSOR'
    `;
    expect((await create({ ...validBody, verifier_member_id: sponsor.id })).status()).toBe(403);
    await eligibilityDb`update program_member set active = false where id = ${verifierId}`;
    expect((await create({ ...validBody, verifier_member_id: verifierId })).status()).toBe(403);
    await eligibilityDb`update program_member set active = true where id = ${verifierId}`;
    // The isolated stack rejects new membership inserts long enough to prove rollback.
    await eligibilityDb`alter table program_member add constraint e2e_reject_new_member check (false) not valid`;
    try {
      const title = "Rollback fixture";
      expect((await create({ ...validBody, title, verifier_member_id: verifierId })).status()).toBe(500);
      expect(await eligibilityDb`select id from program where title = ${title}`).toHaveLength(0);
    } finally {
      await eligibilityDb`alter table program_member drop constraint e2e_reject_new_member`;
    }
  } finally {
    await eligibilityDb`update program_member set active = true where id = ${verifierId}`;
    await eligibilityDb.end();
  }
  const asLocal = (value: string) => {
    const date = new Date(value);
    return new Date(+date - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  await page.getByLabel("Submission deadline").fill(asLocal(validBody.claim_deadline));
  await page.getByLabel("Review deadline").fill(asLocal(validBody.review_deadline));
  await page.getByLabel("Payout deadline").fill(asLocal(validBody.payout_deadline));
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/programs\/[0-9a-f-]+$/i);
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: validBody.title })).toBeVisible();
  await expect(page.getByText(validBody.requirements_text)).toBeVisible();
  await page.goto(`/programs/${demo.programId}`);
  await expect(page.getByText(/Repair the shared community benches and submit a completion record/)).toBeVisible();
  await page.goto(`/programs/${projectId}`);
  const db = postgres(process.env.DATABASE_URL!, { prepare: false });
  try {
    const [state] = await db`
      select (select count(*)::int from program_member where program_id = ${projectId}) as members,
        (select count(*)::int from award where program_id = ${projectId}) as awards
    `;
    expect(state).toMatchObject({ members: 2, awards: 0 });
  } finally {
    await db.end();
  }
  await page.getByRole("link", { name: "Create award" }).click();
  await page.locator("#recipient_user_id").selectOption(demo.recipientUserId);
  await page.getByLabel(/Recipient Stellar/i).fill(demo.recipientWallet);
  await page.getByRole("button", { name: "Create award" }).click();
  await expect(page).toHaveURL(/\/awards\/[0-9a-f-]+/i, { timeout: 30_000 });
  const awardUrl = page.url();

  await expect(page.getByLabel("Award context")).toContainText("SPONSOR");
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

  await page.getByLabel("Explanation").fill("Community bench repair documented in the synthetic site inspection log.");
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
