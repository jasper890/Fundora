import { beforeEach, describe, expect, it, vi } from "vitest";
import { doorAdmits, doorHome } from "@/lib/auth/doors";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  account: { is_staff: false, must_change_password: false },
  roles: [] as { role: string }[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
  })),
  createSupabaseTokenClient: vi.fn(),
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
  const query = async (strings: TemplateStringsArray) => {
    const text = strings.join("");
    if (text.includes("from app_user")) {
      return [{ id: "u1", username: "someone", is_active: true, ...mocks.account }];
    }
    if (text.includes("from program_member")) return mocks.roles;
    return [{}];
  };
  return { sql: () => Object.assign(query, { begin: async (fn: (tx: typeof query) => unknown) => fn(query) }) };
});

import { POST } from "@/app/api/v1/session/login/route";

const login = (door?: string) =>
  POST(
    new Request("https://proofpay.test/api/v1/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://proofpay.test" },
      body: JSON.stringify({ username: "someone", password: "pw", ...(door ? { door } : {}) }),
    }),
  );

describe("doorAdmits", () => {
  it("admits a role door only for an active membership, and the admin door only for staff", () => {
    expect(doorAdmits("sponsor", { is_staff: false }, ["SPONSOR"])).toBe(true);
    expect(doorAdmits("sponsor", { is_staff: false }, ["RECIPIENT"])).toBe(false);
    expect(doorAdmits("sponsor", { is_staff: true }, [])).toBe(false);
    expect(doorAdmits("administrator", { is_staff: true }, [])).toBe(true);
    expect(doorAdmits("administrator", { is_staff: false }, ["SPONSOR"])).toBe(false);
    expect(doorHome("administrator")).toBe("/admin");
    expect(doorHome("verifier")).toBe("/programs");
  });
});

describe("login door enforcement", () => {
  beforeEach(() => {
    process.env.AUTH_THROTTLE_SECRET = "secret";
    mocks.signIn.mockReset().mockResolvedValue({ data: { user: { id: "u1" }, session: {} }, error: null });
    mocks.signOut.mockReset().mockResolvedValue({});
    mocks.account = { is_staff: false, must_change_password: false };
    mocks.roles = [{ role: "RECIPIENT" }];
  });

  it("refuses the wrong role door and clears the session it just created", async () => {
    const response = await login("sponsor");
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("WRONG_DOOR");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("does not let a staff flag stand in for a role door", async () => {
    mocks.account = { is_staff: true, must_change_password: false };
    expect((await login("sponsor")).status).toBe(403);
  });

  it("admits the matching role door and sends staff to the admin workspace", async () => {
    const ok = await login("recipient");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ redirect_to: "/programs" });
    mocks.account = { is_staff: true, must_change_password: false };
    mocks.roles = [];
    expect(await (await login("administrator")).json()).toMatchObject({ redirect_to: "/admin" });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("forces a password change before checking the door", async () => {
    mocks.account = { is_staff: false, must_change_password: true };
    mocks.roles = [];
    const response = await login("sponsor");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ password_change_required: true, redirect_to: "/password-change" });
  });

  it("rejects an unknown door value", async () => {
    expect((await login("owner")).status).toBe(400);
  });
});
