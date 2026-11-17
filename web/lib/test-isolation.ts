/** E2E tests create users and awards, so refuse the interactive demo database. */
export function requireIsolatedTestEnvironment(env: Record<string, string | undefined>) {
  const api = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "http://invalid");
  const db = new URL(env.DATABASE_URL || "postgres://invalid");
  const loopback = new Set(["127.0.0.1", "localhost"]);
  if (
    env.PROOFPAY_TEST_ISOLATED !== "1" ||
    env.STELLAR_USE_FAKE_RPC !== "1" ||
    env.STELLAR_ALLOW_SUBMISSION !== "0" ||
    !loopback.has(api.hostname) ||
    !loopback.has(db.hostname) ||
    !api.port || api.port === "54321" ||
    !db.port || db.port === "54322"
  ) {
    throw new Error("E2E requires an isolated local Supabase stack with FakeRpc and submissions disabled. Run npm run test:isolated.");
  }
}
