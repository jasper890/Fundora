import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), actor: vi.fn(), create: vi.fn(), remove: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: () => ({ auth: { admin: { createUser: mocks.create, deleteUser: mocks.remove } } }) }));
vi.mock("@/lib/awards/queries", () => ({ loadAppUserByAuthId: mocks.actor }));
vi.mock("@/lib/db", () => ({ sql: () => mocks.query }));
import { POST } from "@/app/api/v1/admin/users/route";

function post(body: unknown) { return POST(new Request("https://proofpay.test/api/v1/admin/users", {
  method: "POST", headers: { Origin: "https://proofpay.test", "Content-Type": "application/json" }, body: JSON.stringify(body),
})); }
const body = { username: "synthetic-new-user", temporary_password: "Temporary-safe-pass-123" };
describe("staff account provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "staff" } } });
    mocks.actor.mockResolvedValue({ id: "staff", is_staff: true, is_active: true });
    mocks.create.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
    mocks.query.mockResolvedValue([{ id: "new-user", username: body.username }]);
    mocks.remove.mockResolvedValue({ error: null });
  });
  it("denies non-staff before creating an auth account", async () => {
    mocks.actor.mockResolvedValue({ id: "recipient", is_staff: false, is_active: true });
    expect((await post(body)).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects arbitrary roles, email destinations and weak temporary passwords", async () => {
    expect((await post({ ...body, is_staff: true })).status).toBe(400);
    expect((await post({ ...body, email: "external@example.com" })).status).toBe(400);
    expect((await post({ ...body, temporary_password: "short" })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates only an unprivileged profile requiring a password change", async () => {
    const response = await post(body);
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ email: `${body.username}@users.proofpay.local`, email_confirm: true }));
    expect(mocks.query.mock.calls[0][0].join(" ")).toContain("must_change_password");
    expect(JSON.stringify(await response.json())).not.toContain(body.temporary_password);
  });
  it("removes the newly created Auth account if profile creation fails", async () => {
    mocks.query.mockRejectedValueOnce(Object.assign(new Error("write failed"), { code: "23505" }));
    expect((await post(body)).status).toBe(409);
    expect(mocks.remove).toHaveBeenCalledWith("new-user");
  });
});
