import { describe, expect, it } from "vitest";
import { requireIsolatedTestEnvironment } from "../lib/test-isolation";

const isolated = {
  PROOFPAY_TEST_ISOLATED: "1", STELLAR_USE_FAKE_RPC: "1", STELLAR_ALLOW_SUBMISSION: "0",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55322/postgres",
};

describe("isolated E2E environment", () => {
  it("accepts a separate local FakeRpc stack", () => {
    expect(() => requireIsolatedTestEnvironment(isolated)).not.toThrow();
  });
  it.each([
    { PROOFPAY_TEST_ISOLATED: "0" },
    { STELLAR_USE_FAKE_RPC: "0" },
    { STELLAR_ALLOW_SUBMISSION: "1" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55323" },
    { DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:54322/postgres" },
    { DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55324/postgres" },
    { DATABASE_URL: "postgres://user:pass@example.com:55322/postgres" },
  ])("refuses unsafe test targets %o", (override) => {
    expect(() => requireIsolatedTestEnvironment({ ...isolated, ...override })).toThrow("isolated");
  });
});
