import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { requireIsolatedTestEnvironment } from "../lib/test-isolation";
import { loginAs } from "./helpers";

test("sponsor register filters preserve URL state and restore row focus", async ({ page }) => {
  await loginAs(page, "sponsor", "demo-sponsor");
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const firstRow = table.getByRole("row").nth(1);
  const participant = (await firstRow.getByRole("rowheader").innerText()).trim();
  const initialOpen = page.locator("[data-award-open]:visible").first();
  const awardId = await initialOpen.getAttribute("data-award-open");
  expect(awardId).toBeTruthy();

  const search = page.getByRole("searchbox", {
    name: "Search participant, status, or next step",
  });
  await search.fill(participant);
  await page.getByLabel("Status").selectOption("CREATED");
  await page.getByLabel("Sort").selectOption("participant");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/view=needs-action/);
  await expect(search).toHaveValue(participant);
  await expect(table.getByRole("row")).toHaveCount(2);

  await page.getByRole("link", { name: /Awaiting review/ }).click();
  await expect(page).toHaveURL(/view=awaiting-review/);
  await expect(search).toHaveValue(participant);
  await page.getByRole("link", { name: /All awards/ }).click();
  await expect(page).toHaveURL(/view=all-awards/);
  await expect(search).toHaveValue(participant);

  await page.locator(`[data-award-open="${awardId}"]:visible`).click();
  await expect(page.getByRole("heading", { name: participant })).toBeVisible();
  await page.getByRole("link", { name: /Award register/ }).click();
  await expect(page).toHaveURL(new RegExp("focus=" + awardId));
  await expect(
    page.locator(`[data-award-open="${awardId}"]:visible`),
  ).toBeFocused();
});

test("recipient and verifier keep their scoped workspace entry points", async ({ page }) => {
  await loginAs(page, "recipient", "demo-recipient-01");
  await expect(page.getByRole("heading", { name: "Your awards" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Award register" })).toBeVisible();

  await loginAs(page, "verifier", "demo-verifier");
  await expect(page.getByRole("heading", { name: "Verifier workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Award register" })).toBeVisible();
});

async function createPendingAndHeldPayouts(): Promise<{ pending: string; held: string }> {
  requireIsolatedTestEnvironment(process.env);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing isolated test database URL");
  const db = postgres(databaseUrl, { prepare: false });
  try {
    const awards = await db`
      select a.id, sm.user_id as sponsor_id, sm.public_wallet as sponsor_wallet
      from award a
      join program_member sm on sm.id = a.sponsor_member_id
      where sm.role = 'SPONSOR' and sm.active = true and a.status = 'CREATED'
      order by a.created_at
      limit 2
    `;
    if (awards.length < 2) throw new Error("Two isolated synthetic awards are required");

    return await db.begin(async (tx) => {
      const pendingId = String(awards[0].id);
      const heldId = String(awards[1].id);
      await tx`
        update award
        set status = 'APPROVED', version = version + 1, last_confirmed_ledger = 1
        where id in (${pendingId}, ${heldId})
      `;
      await tx`
        update award set sponsor_hold = true where id = ${heldId}
      `;
      const intent = JSON.stringify({ action: "PAY", actor_role: "SPONSOR" });
      await tx`
        insert into chain_operation (
          award_id, actor_id, signer, action, idempotency_key, intent, status, expires_at
        ) values (
          ${pendingId},
          ${String(awards[0].sponsor_id)},
          ${String(awards[0].sponsor_wallet)},
          'PAY',
          ${randomUUID()},
          ${intent}::jsonb,
          'UNKNOWN',
          now() + interval '5 minutes'
        )
      `;
      return { pending: pendingId, held: heldId };
    });
  } finally {
    await db.end({ timeout: 2 });
  }
}

test("UNKNOWN payout after reload stays attached to its operation and cannot prepare another payment", async ({ page }) => {
  const fixtures = await createPendingAndHeldPayouts();
  await loginAs(page, "sponsor", "demo-sponsor");
  await page.route("**/api/v1/operations/*/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "UNKNOWN",
        action: "PAY",
        error_code: "OUTCOME_UNKNOWN",
        confirmed_ledger: null,
      }),
    });
  });

  let paymentPreparations = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/v1\/awards\/[0-9a-f-]+\/prepare\/PAY/i.test(request.url())
    ) {
      paymentPreparations += 1;
    }
  });

  await page.goto(`/awards/${fixtures.pending}`);
  await expect(page.getByText(/Outcome not confirmed/i)).toBeVisible();
  await expect(page.getByText(/Resumed PAY \(UNKNOWN\)/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare payment" })).toBeDisabled();
  await page.reload();
  await expect(page.getByText(/Resumed PAY \(UNKNOWN\)/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare payment" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByText("Status: UNKNOWN")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare payment" })).toBeDisabled();
  expect(paymentPreparations).toBe(0);

  await page.goto("/programs");
  await page.goto(`/awards/${fixtures.held}`);
  await expect(page.getByText(/Review hold active/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare payment" })).toHaveCount(0);
});
