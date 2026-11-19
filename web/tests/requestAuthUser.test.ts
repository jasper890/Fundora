import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tokenGetUser: vi.fn(), cookieGetUser: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => undefined }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: mocks.cookieGetUser } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser: mocks.tokenGetUser } }) }));

import { getRequestAuthUser } from "@/lib/supabase/server";

const request = (headers: Record<string, string>) => new Request("https://proofpay.test/api", { headers });

describe("getRequestAuthUser", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.MOBILE_BEARER_AUTH = "1";
    mocks.tokenGetUser.mockReset().mockResolvedValue({ data: { user: { id: "bearer-user" } } });
    mocks.cookieGetUser.mockReset().mockResolvedValue({ data: { user: { id: "cookie-user" } } });
  });
  afterEach(() => {
    delete process.env.MOBILE_BEARER_AUTH;
  });

  it("verifies a cookie-less bearer token with Supabase and never consults cookies", async () => {
    expect(await getRequestAuthUser(request({ Authorization: "Bearer jwt" }))).toEqual({ id: "bearer-user" });
    expect(mocks.tokenGetUser).toHaveBeenCalledWith("jwt");
    expect(mocks.cookieGetUser).not.toHaveBeenCalled();
  });

  it("returns null for a rejected token instead of falling back to a cookie session", async () => {
    mocks.tokenGetUser.mockResolvedValue({ data: { user: null } });
    expect(await getRequestAuthUser(request({ Authorization: "Bearer forged" }))).toBeNull();
    expect(mocks.cookieGetUser).not.toHaveBeenCalled();
  });

  it("uses the cookie session when the kill switch is off or a cookie is present", async () => {
    delete process.env.MOBILE_BEARER_AUTH;
    expect(await getRequestAuthUser(request({ Authorization: "Bearer jwt" }))).toEqual({ id: "cookie-user" });
    process.env.MOBILE_BEARER_AUTH = "1";
    expect(await getRequestAuthUser(request({ Authorization: "Bearer jwt", Cookie: "sb=1" }))).toEqual({ id: "cookie-user" });
    expect(mocks.tokenGetUser).not.toHaveBeenCalled();
  });
});
