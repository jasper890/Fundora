import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseTokenClient: () => ({ auth: { refreshSession: mocks.refreshSession } }),
}));

import { POST } from "@/app/api/v1/session/refresh/route";

const refresh = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://proofpay.test/api/v1/session/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

describe("mobile token refresh", () => {
  beforeEach(() => {
    process.env.MOBILE_BEARER_AUTH = "1";
    mocks.refreshSession.mockReset().mockResolvedValue({
      data: { session: { access_token: "a2", refresh_token: "r2", expires_at: 99 } },
      error: null,
    });
  });
  afterEach(() => {
    delete process.env.MOBILE_BEARER_AUTH;
  });

  it("rotates a native app's tokens", async () => {
    const response = await refresh({ refresh_token: "r1" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ access_token: "a2", refresh_token: "r2", expires_at: 99 });
    expect(mocks.refreshSession).toHaveBeenCalledWith({ refresh_token: "r1" });
  });

  it("does not exist while the kill switch is off", async () => {
    delete process.env.MOBILE_BEARER_AUTH;
    expect((await refresh({ refresh_token: "r1" })).status).toBe(404);
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("refuses browser requests that carry an Origin or cookies", async () => {
    expect((await refresh({ refresh_token: "r1" }, { Origin: "https://proofpay.test" })).status).toBe(403);
    expect((await refresh({ refresh_token: "r1" }, { Cookie: "sb=1" })).status).toBe(403);
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("returns 401 for a revoked token and 400 for a malformed body", async () => {
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("revoked") });
    expect((await refresh({ refresh_token: "old" })).status).toBe(401);
    expect((await refresh({ refresh_token: "" })).status).toBe(400);
    expect((await refresh({ refresh_token: "r", extra: 1 })).status).toBe(400);
  });
});
