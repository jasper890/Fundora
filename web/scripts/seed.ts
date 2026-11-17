/**
 * Idempotent synthetic cohort seed for local Supabase.
 * Usage: npx tsx scripts/seed.ts
 * Requires env from .env.local (service role + DATABASE_URL).
 */
import { createClient } from "@supabase/supabase-js";
import { Keypair } from "@stellar/stellar-sdk";
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
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

const PREFIX = process.env.SEED_PREFIX || "demo";
const PASSWORD = process.env.SEED_PASSWORD || "ProofPay-Demo-Password-12";
const emailFor = (username: string) => `${username}@users.proofpay.local`;

async function ensureAuthUser(
  admin: ReturnType<typeof createClient<any>>,
  username: string,
  _isStaff = false,
) {
  void _isStaff;
  const email = emailFor(username);
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing.data.users.find((u) => u.email === email);
  if (found) return found.id;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username },
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || `Failed to create ${username}`);
  }
  return created.data.user.id;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  if (!url || !service || !dbUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL");
  }

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(dbUrl, { prepare: false });

  const usernames = [
    `${PREFIX}-sponsor`,
    `${PREFIX}-verifier`,
    ...Array.from({ length: 10 }, (_, i) => `${PREFIX}-recipient-${String(i + 1).padStart(2, "0")}`),
  ];
  const staffId = await ensureAuthUser(admin, `${PREFIX}-admin`, true);
  const userIds: string[] = [];
  for (const name of usernames) {
    userIds.push(await ensureAuthUser(admin, name));
  }

  const wallets = Array.from({ length: 12 }, () => Keypair.random().publicKey());
  // Optional Freighter-aligned overrides for local Testnet signing.
  if (process.env.SEED_SPONSOR_WALLET) wallets[0] = process.env.SEED_SPONSOR_WALLET;
  if (process.env.SEED_VERIFIER_WALLET) wallets[1] = process.env.SEED_VERIFIER_WALLET;
  for (let i = 0; i < 10; i += 1) {
    const key = process.env[`SEED_RECIPIENT_${String(i + 1).padStart(2, "0")}_WALLET`];
    if (key) wallets[i + 2] = key;
  }

  await sql`
    insert into app_user (id, username, is_staff, is_active)
    values (${staffId}, ${`${PREFIX}-admin`}, true, true)
    on conflict (id) do update set username = excluded.username, is_staff = true
  `;
  for (let i = 0; i < usernames.length; i += 1) {
    await sql`
      insert into app_user (id, username, is_staff, is_active)
      values (${userIds[i]}, ${usernames[i]}, false, true)
      on conflict (id) do update set username = excluded.username
    `;
  }

  const title = `Synthetic ProofPay workshop (${PREFIX})`;
  const existing = await sql`select id from program where title = ${title} limit 1`;
  if (existing.length) {
    const programId = existing[0].id as string;
    // Refresh wallet overrides so Freighter keys can be applied without reseed wipe.
    for (let i = 0; i < 12; i += 1) {
      await sql`
        update program_member
        set public_wallet = ${wallets[i]}
        where program_id = ${programId}
          and user_id = ${userIds[i]}
      `;
    }
    console.log(`Existing synthetic program: ${programId}`);
    console.log(`Wallets refreshed from SEED_*_WALLET env (if set).`);
    console.log(`Password for all demo users: ${PASSWORD}`);
    await sql.end();
    return;
  }

  const now = new Date();
  const claim = new Date(now.getTime() + 7 * 86400000);
  const review = new Date(now.getTime() + 9 * 86400000);
  const payout = new Date(now.getTime() + 10 * 86400000);

  const programs = await sql`
    insert into program (
      title, requirements_text, requirements_version,
      sponsor_user_id, verifier_user_id,
      claim_deadline, review_deadline, payout_deadline
    ) values (
      ${title},
      ${"Complete the synthetic workshop and have its organizer record independently checked. Synthetic Testnet demo only; no real monetary value."},
      1,
      ${userIds[0]},
      ${userIds[1]},
      ${claim},
      ${review},
      ${payout}
    )
    returning id
  `;
  const programId = programs[0].id as string;

  const memberIds: string[] = [];
  const roles = ["SPONSOR", "VERIFIER", ...Array(10).fill("RECIPIENT")];
  for (let i = 0; i < 12; i += 1) {
    const rows = await sql`
      insert into program_member (program_id, user_id, role, public_wallet, active)
      values (${programId}, ${userIds[i]}, ${roles[i]}, ${wallets[i]}, true)
      returning id
    `;
    memberIds.push(rows[0].id as string);
  }

  for (let i = 2; i < 12; i += 1) {
    await sql`
      insert into award (
        program_id, sponsor_member_id, verifier_member_id, recipient_member_id,
        base_units, status, version
      ) values (
        ${programId}, ${memberIds[0]}, ${memberIds[1]}, ${memberIds[i]},
        200000000, 'CREATED', 0
      )
    `;
  }

  console.log(`Synthetic program: ${programId}`);
  console.log(`Ten awards created. Preview wallets have no retained signing keys.`);
  console.log(`Demo password: ${PASSWORD}`);
  console.log(`Try door login as ${PREFIX}-sponsor / ${PREFIX}-verifier / ${PREFIX}-recipient-01`);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
