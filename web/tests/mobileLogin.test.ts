import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieSignIn: vi.fn(),
  tokenSignIn: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { signInWithPassword: mocks.cookieSignIn } })),
  createSupabaseTokenClient: vi.fn(() => ({ auth: { signInWithPassword: mocks.tokenSignIn } })),
}));

vi.mock("@/lib/auth/throttle", () => ({
  accountIpDigest: () => "digest",
  evaluateThrottle: () => ({ ok: true, attempt: {} }),
  recordFailure: () => ({ window_started_at: new Date(), failed_attempts: 1, last_attempt_at: new Date() }),
  recordSuccess: () => ({ window_started_at: new Date(), last_attempt_at: new Date() }),
  INVALID_LOGIN_MESSAGE: "Invalid login.",
  THROTTLED_MESSAGE: "Too many attempts.",
}));

vi.mock("@/lib/db", () => {
  const profile = [{ id: "u1", username: "recipient01", is_active: true, must_change_password: false }];
  const query = async (strings: TemplateStringsArray) =>
    strings.join("").includes("from app_user") ? profile : [{}];
  return { sql: () => Object.assign(query, { begin: async (fn: (tx: typeof query) => unknown) => fn(query) }) };
});

import { POST } from "@/app/api/v1/session/login/route";

const session = { access_token: "access", refresh_token: "refresh", expires_at: 123 };

function login(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://proofpay.test/api/v1/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ username: "recipient01", password: "pw", ...body }),
    }),
  );
}

describe("mobile login", () => {
  beforeEach(() => {
    process.env.AUTH_THROTTLE_SECRET = "secret";
    process.env.MOBILE_BEARER_AUTH = "1";
    mocks.cookieSignIn.mockReset().mockResolvedValue({ data: { user: { id: "u1" }, session }, error: null });
    mocks.tokenSignIn.mockReset().mockResolvedValue({ data: { user: { id: "u1" }, session }, error: null });
  });
  afterEach(() => {
    delete process.env.MOBILE_BEARER_AUTH;
  });

  it("returns tokens from a cookie-less client for an origin-less native login", async () => {
    const response = await login({ client: "mobile" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ authenticated: true, access_token: "access", refresh_token: "refresh" });
    expect(mocks.tokenSignIn).toHaveBeenCalled();
    expect(mocks.cookieSignIn).not.toHaveBeenCalled();
  });

  it("never returns tokens to a browser login", async () => {
    const response = await login({}, { Origin: "https://proofpay.test" });
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("access_token");
    expect(mocks.tokenSignIn).not.toHaveBeenCalled();
  });

  it("rejects origin-less logins that are not native, or when the kill switch is off", async () => {
    expect((await login({})).status).toBe(403);
    delete process.env.MOBILE_BEARER_AUTH;
    expect((await login({ client: "mobile" })).status).toBe(403);
    expect(mocks.tokenSignIn).not.toHaveBeenCalled();
  });

  it("never returns tokens to a same-origin mobile request while the kill switch is off", async () => {
    delete process.env.MOBILE_BEARER_AUTH;
    const response = await login({ client: "mobile" }, { Origin: "https://proofpay.test" });
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("access_token");
    expect(mocks.tokenSignIn).not.toHaveBeenCalled();
  });

  it("rejects a cross-site Origin even in mobile mode", async () => {
    expect((await login({ client: "mobile" }, { Origin: "https://attacker.test" })).status).toBe(403);
  });
});
