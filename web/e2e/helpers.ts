import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Keypair } from "@stellar/stellar-sdk";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { requireIsolatedTestEnvironment } from "../lib/test-isolation";

export const DEMO_PASSWORD = "ProofPay-Demo-Password-12";

function loadEnv() {
  if (process.env.PROOFPAY_TEST_ISOLATED === "1") return;
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();
requireIsolatedTestEnvironment(process.env);

export async function loginAs(
  page: Page,
  door: "sponsor" | "verifier" | "recipient" | "administrator",
  username: string,
) {
  await page.goto(`/login/${door}`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(door === "administrator" ? /\/admin(?:[/?#]|$)/ : /\/programs(?:[/?#]|$)/, { timeout: 30_000 });
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** FakeRpc: prepare → sign/submit → confirmed notice. */
export async function fakeRpcPrepareAndConfirm(
  page: Page,
  prepareButton: string,
) {
  const preparedResponse = page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/prepare/"));
  await page.getByRole("button", { name: prepareButton }).click();
  const preparationResponse = await preparedResponse;
  const prepared = await preparationResponse.json();
  const preparationReplay = await page.request.post(preparationResponse.url(), {
    headers: { Origin: new URL(page.url()).origin, "Idempotency-Key": (await preparationResponse.request().headerValue("Idempotency-Key"))! },
    data: preparationResponse.request().postDataJSON(),
  });
  expect(preparationReplay.status()).toBe(200);
  expect((await preparationReplay.json()).id).toBe(prepared.id);
  await expect(page.getByText(/FakeRpc preview ready/i)).toBeVisible({
    timeout: 30_000,
  });
  const submit = page.getByRole("button", { name: "Sign and submit" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();
  await expect(
    page.getByText(/Confirmed locally|Confirmed \(/i),
  ).toBeVisible({ timeout: 30_000 });
  const replay = await page.request.post(`/api/v1/operations/${prepared.id}/submit`, {
    headers: { Origin: new URL(page.url()).origin }, data: { signed_xdr: `SIGNED-${prepared.unsigned_xdr}` },
  });
  expect(replay.status()).toBe(200);
  expect((await replay.json()).status).toBe("CONFIRMED_SUCCESS");
}

/** Provision a fresh recipient so create-award is not blocked by seed awards. */
export async function provisionE2ERecipient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  if (!url || !service) {
    throw new Error("Missing Supabase URL/service role for e2e provisioning");
  }

  const username = `e2e-recipient-${Date.now().toString(36)}`;
  const email = `${username}@users.proofpay.local`;
  const wallet = Keypair.random().publicKey();

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const created = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { username },
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || "e2e auth user create failed");
  }
  const userId = created.data.user.id;

  const sql = postgres(dbUrl, { prepare: false });
  try {
    await sql`
      insert into app_user (id, username, is_staff, is_active, must_change_password)
      values (${userId}, ${username}, false, true, false)
      on conflict (id) do update set username = excluded.username, is_active = true
    `;
    const program = await sql`
      select id from program order by created_at desc limit 1
    `;
    if (!program[0]) throw new Error("No program seeded");
    return {
      programId: String(program[0].id),
      recipientUserId: userId,
      recipientUsername: username,
      recipientWallet: wallet,
    };
  } finally {
    await sql.end({ timeout: 2 });
  }
}

/** Minimal valid JPEG (1x1). */
export function tinyJpeg(): Buffer {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
    "base64",
  );
}
