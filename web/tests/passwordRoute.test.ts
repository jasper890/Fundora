import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  loadProfile: vi.fn(),
  clearFlag: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser,
    },
  })),
}));

vi.mock("@/lib/awards/queries", () => ({
  loadAppUserByAuthId: mocks.loadProfile,
}));

vi.mock("@/lib/db", () => ({
  sql: () => async () => {
    mocks.clearFlag();
    return [];
  },
}));

import { POST } from "@/app/api/v1/session/password/route";

const validBody = {
  current_password: "Current-pass-123",
  new_password: "New-secure-pass-456",
  confirm_password: "New-secure-pass-456",
};

function post(body: unknown, origin = "https://proofpay.test") {
  return POST(
    new Request("https://proofpay.test/api/v1/session/password", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("password change route", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.signInWithPassword.mockReset();
    mocks.updateUser.mockReset();
    mocks.loadProfile.mockReset();
    mocks.clearFlag.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user", email: "auth-user@proofpay.test" } } });
    mocks.loadProfile.mockResolvedValue({
      id: "auth-user", username: "reviewer", is_staff: false, is_active: true,
      must_change_password: true,
    });
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null });
  });

  it("requires a same-origin request before contacting Auth", async () => {
    const response = await post(validBody, "https://attacker.test");
    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("requires an authenticated session", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    const response = await post(validBody);
    expect(response.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation and unknown fields", async () => {
    const mismatch = await post({ ...validBody, confirm_password: "different-pass" });
    expect(mismatch.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();

    const extra = await post({ ...validBody, user_id: "another-user" });
    expect(extra.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("checks the current password with Supabase and never returns credentials", async () => {
    const response = await post(validBody);
    expect(response.status).toBe(200);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "auth-user@proofpay.test",
      password: validBody.current_password,
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: validBody.new_password,
    });
    expect(mocks.clearFlag).toHaveBeenCalledOnce();
    const body = await response.text();
    expect(body).not.toContain(validBody.current_password);
    expect(body).not.toContain(validBody.new_password);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects an unchanged password", async () => {
    const response = await post({
      current_password: "Current-pass-123",
      new_password: "Current-pass-123",
      confirm_password: "Current-pass-123",
    });
    expect(response.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("does not contact Auth for an inactive or missing app profile", async () => {
    mocks.loadProfile.mockResolvedValueOnce(null);
    const response = await post(validBody);
    expect(response.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("returns a safe error when Auth rejects a password change", async () => {
    mocks.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "sensitive provider detail" },
    });
    const response = await post(validBody);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("sensitive provider detail");
  });

  it("rejects when the current password check fails", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    const response = await post(validBody);
    expect(response.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
