import { randomBytes } from "node:crypto";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { requireIsolatedTestEnvironment } from "../lib/test-isolation";
import { fakeRpcPrepareAndConfirm, loginAs, signOut } from "./helpers";

type Fixture = {
  cancellationAwardId: string;
  controlledAwardId: string;
  refundAwardId: string;
  replacementVerifierMemberId: string;
};

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

async function createRecoveryFixture(): Promise<Fixture> {
  requireIsolatedTestEnvironment(process.env);
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Missing isolated test database URL");
  const db = postgres(dbUrl, { prepare: false });
  try {
    const usernames = [
      "demo-sponsor",
      "demo-verifier",
      "demo-recipient-01",
      "demo-recipient-02",
      "demo-recipient-03",
      "demo-recipient-09",
    ];
    const users = new Map<string, string>();
    for (const username of usernames) {
      const [row] = await db`select id from app_user where username = ${username} and is_active = true limit 1`;
      if (!row) throw new Error(`Missing synthetic test account ${username}`);
      users.set(username, String(row.id));
    }
    const userId = (username: string) => {
      const id = users.get(username);
      if (!id) throw new Error(`Missing synthetic test account ${username}`);
      return id;
    };

    return await db.begin(async (tx) => {
      const member = async (programId: string, username: string, role: string) => {
        const [row] = await tx`
          insert into program_member (program_id, user_id, role, public_wallet, active)
          values (${programId}, ${userId(username)}, ${role}, ${Keypair.random().publicKey()}, true)
          returning id
        `;
        return String(row.id);
      };
      const award = async (args: {
        programId: string;
        sponsorMemberId: string;
        verifierMemberId: string;
        recipientMemberId: string;
        status: "CREATED" | "FUNDED" | "REJECTED";
        version: number;
        sponsorHold?: boolean;
        verifierHold?: boolean;
      }) => {
        const [row] = await tx`
          insert into award (
            program_id, sponsor_member_id, verifier_member_id, recipient_member_id,
            contract_id, network_id, base_units, status, version,
            sponsor_hold, verifier_hold, evidence_revision, evidence_digest, last_confirmed_ledger
          ) values (
            ${args.programId}, ${args.sponsorMemberId}, ${args.verifierMemberId}, ${args.recipientMemberId},
            ${StrKey.encodeContract(randomBytes(32))}, 'TESTNET', 200000000, ${args.status}, ${args.version},
            ${args.sponsorHold ?? false}, ${args.verifierHold ?? false}, 0, '', 1
          )
          returning id
        `;
        return String(row.id);
      };
      const program = async (title: string, verifierUsername: string, deadlines: {
        claim: Date;
        review: Date;
        payout: Date;
      }) => {
        const [row] = await tx`
          insert into program (
            title, requirements_text, requirements_version, sponsor_user_id, verifier_user_id,
            claim_deadline, review_deadline, payout_deadline
          ) values (
            ${title}, 'Synthetic E2E recovery fixture only.', 1, ${userId("demo-sponsor")},
            ${userId(verifierUsername)}, ${deadlines.claim}, ${deadlines.review}, ${deadlines.payout}
          ) returning id
        `;
        return String(row.id);
      };

      const suffix = `${process.pid}-${Date.now().toString(36)}`;
      const future = Date.now();
      const normalProgramId = await program(`E2E recovery ${suffix}`, "demo-verifier", {
        claim: new Date(future + 86_400_000),
        review: new Date(future + 2 * 86_400_000),
        payout: new Date(future + 3 * 86_400_000),
      });
      const sponsorMemberId = await member(normalProgramId, "demo-sponsor", "SPONSOR");
      const verifierMemberId = await member(normalProgramId, "demo-verifier", "VERIFIER");
      const replacementVerifierMemberId = await member(normalProgramId, "demo-recipient-09", "VERIFIER");
      const cancelRecipientMemberId = await member(normalProgramId, "demo-recipient-01", "RECIPIENT");
      const controlledRecipientMemberId = await member(normalProgramId, "demo-recipient-02", "RECIPIENT");
      const cancellationAwardId = await award({
        programId: normalProgramId,
        sponsorMemberId,
        verifierMemberId,
        recipientMemberId: cancelRecipientMemberId,
        status: "CREATED",
        version: 0,
      });
      const controlledAwardId = await award({
        programId: normalProgramId,
        sponsorMemberId,
        verifierMemberId,
        recipientMemberId: controlledRecipientMemberId,
        status: "FUNDED",
        version: 1,
      });

      const past = Date.now();
      const refundProgramId = await program(`E2E refund ${suffix}`, "demo-verifier", {
        claim: new Date(past - 3 * 86_400_000),
        review: new Date(past - 2 * 86_400_000),
        payout: new Date(past - 86_400_000),
      });
      const refundSponsorId = await member(refundProgramId, "demo-sponsor", "SPONSOR");
      const refundVerifierId = await member(refundProgramId, "demo-verifier", "VERIFIER");
      const refundRecipientId = await member(refundProgramId, "demo-recipient-03", "RECIPIENT");
      const refundAwardId = await award({
        programId: refundProgramId,
        sponsorMemberId: refundSponsorId,
        verifierMemberId: refundVerifierId,
        recipientMemberId: refundRecipientId,
        status: "FUNDED",
        version: 1,
        sponsorHold: true,
        verifierHold: true,
      });

      return { cancellationAwardId, controlledAwardId, refundAwardId, replacementVerifierMemberId };
    });
  } finally {
    await db.end({ timeout: 2 });
  }
}

async function readAward(id: string) {
  requireIsolatedTestEnvironment(process.env);
  const db = postgres(process.env.DATABASE_URL!, { prepare: false });
  try {
    const [row] = await db`
      select status, version, sponsor_hold, verifier_hold, verifier_member_id
      from award where id = ${id} limit 1
    `;
    if (!row) throw new Error("Recovery fixture award disappeared");
    return row;
  } finally {
    await db.end({ timeout: 2 });
  }
}

test("FakeRpc recovery controls stay scoped to their role and award state", async ({ page }) => {
  const fixture = await createRecoveryFixture();
  await loginAs(page, "sponsor", "demo-sponsor");

  await page.goto(`/awards/${fixture.cancellationAwardId}`);
  await expect(page.getByRole("button", { name: "Prepare award cancellation" })).toBeVisible();
  await fakeRpcPrepareAndConfirm(page, "Prepare award cancellation");
  await page.reload();
  await expect(page.getByRole("button", { name: "Prepare award cancellation" })).toHaveCount(0);
  expect((await readAward(fixture.cancellationAwardId)).status).toBe("CANCELLED");

  await signOut(page);
  await loginAs(page, "recipient", "demo-recipient-02");
  await page.goto(`/awards/${fixture.controlledAwardId}`);
  await expect(page.getByRole("button", { name: "Prepare your hold" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Prepare verifier replacement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Prepare expiry refund" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Prepare storage lifetime extension" })).toBeVisible();

  await signOut(page);
  await loginAs(page, "verifier", "demo-verifier");
  await page.goto(`/awards/${fixture.controlledAwardId}`);
  await fakeRpcPrepareAndConfirm(page, "Prepare your hold");
  await page.reload();
  await expect(page.getByRole("button", { name: "Prepare removal of your hold" })).toBeVisible();

  await signOut(page);
  await loginAs(page, "sponsor", "demo-sponsor");
  await page.goto(`/awards/${fixture.controlledAwardId}`);
  await fakeRpcPrepareAndConfirm(page, "Prepare your hold");
  await page.reload();
  await expect(page.getByRole("button", { name: "Prepare removal of your hold" })).toBeVisible();
  await page.getByLabel("Replacement verifier").selectOption(fixture.replacementVerifierMemberId);
  await fakeRpcPrepareAndConfirm(page, "Prepare verifier replacement");
  const afterRotation = await readAward(fixture.controlledAwardId);
  expect(String(afterRotation.verifier_member_id)).toBe(fixture.replacementVerifierMemberId);
  expect(afterRotation.sponsor_hold).toBe(true);
  expect(afterRotation.verifier_hold).toBe(false);

  await page.reload();
  await fakeRpcPrepareAndConfirm(page, "Prepare removal of your hold");
  await page.reload();
  const beforeTtl = await readAward(fixture.controlledAwardId);
  await fakeRpcPrepareAndConfirm(page, "Prepare storage lifetime extension");
  const afterTtl = await readAward(fixture.controlledAwardId);
  expect(afterTtl.status).toBe("FUNDED");
  expect(String(afterTtl.version)).toBe(String(beforeTtl.version));

  await page.reload();
  await page.goto(`/awards/${fixture.refundAwardId}`);
  await expect(page.getByRole("button", { name: "Prepare expiry refund" })).toBeVisible();
  await fakeRpcPrepareAndConfirm(page, "Prepare expiry refund");
  const refunded = await readAward(fixture.refundAwardId);
  expect(refunded.status).toBe("REFUNDED");
  expect(refunded.sponsor_hold).toBe(true);
  expect(refunded.verifier_hold).toBe(true);
});
