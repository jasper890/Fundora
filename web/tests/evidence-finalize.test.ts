import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = vi.fn();
  const tx = vi.fn();
  return { query, tx, begin: vi.fn((fn) => fn(tx)), getUser: vi.fn(), actor: vi.fn(), download: vi.fn(), remove: vi.fn() };
});
vi.mock("@/lib/db", () => ({ sql: () => Object.assign(mocks.query, { begin: mocks.begin }) }));
vi.mock("@/lib/supabase/server", () => ({ getRequestAuthUser: async () => (await mocks.getUser()).data.user }));
vi.mock("@/lib/awards/queries", () => ({ loadAppUserByAuthId: mocks.actor }));
vi.mock("@/lib/evidence/storage", () => ({ downloadEvidenceObject: mocks.download, deleteEvidenceObjects: mocks.remove }));
import { POST } from "@/app/api/v1/awards/[id]/evidence/finalize/route";

const award = "11111111-1111-4111-8111-111111111111";
const reservationId = "22222222-2222-4222-8222-222222222222";
const reservation = { id: reservationId, expected_revision: 0, expires_at: new Date(Date.now() + 60_000), explanation: "Synthetic completion", source_ref: "synthetic-source", object_paths: ["test-upload.bin"] };
function post(extra: Record<string, unknown> = {}) {
  return POST(new Request(`https://proofpay.test/api/v1/awards/${award}/evidence/finalize`, {
    method: "POST", headers: { Origin: "https://proofpay.test", "Content-Type": "application/json" },
    body: JSON.stringify({ reservation_id: reservationId, filenames: ["proof.pdf"], ...extra }),
  }), { params: Promise.resolve({ id: award }) });
}
describe("evidence finalization trust boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockReset(); mocks.tx.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "recipient" } } });
    mocks.actor.mockResolvedValue({ id: "recipient", is_active: true });
    mocks.query.mockResolvedValueOnce([reservation]).mockResolvedValue([]);
    mocks.download.mockResolvedValue(Buffer.from("%PDF-1.4 synthetic"));
    mocks.remove.mockResolvedValue(undefined);
  });
  it("rejects skip_storage before creating a revision or contacting storage", async () => {
    expect((await post({ skip_storage: true })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
  });
  it("requires a session and an active account", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await post()).status).toBe(401);
    mocks.actor.mockResolvedValueOnce({ id: "recipient", is_active: false });
    expect((await post()).status).toBe(401);
  });
  it("rejects spoofed file content and cleans up only its abandoned reservation", async () => {
    mocks.download.mockResolvedValueOnce(Buffer.from("<html>not a PDF</html>"));
    mocks.query.mockReset().mockResolvedValueOnce([reservation]).mockResolvedValueOnce([{ object_paths: reservation.object_paths }]);
    expect((await post()).status).toBe(400);
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith(reservation.object_paths);
  });
  it("rechecks current recipient access after upload", async () => {
    mocks.tx.mockResolvedValueOnce([reservation]).mockResolvedValueOnce([{ recipient_user: "other", recipient_active: true }]);
    expect((await post()).status).toBe(404);
    expect(mocks.tx).toHaveBeenCalledTimes(2);
  });
  it("never removes evidence already finalized by a concurrent worker", async () => {
    mocks.tx.mockResolvedValueOnce([]);
    expect((await post()).status).toBe(409);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("rejects an expired reservation before downloading private objects", async () => {
    mocks.query.mockReset().mockResolvedValueOnce([{ ...reservation, expires_at: new Date(0) }]).mockResolvedValue([]);
    expect((await post()).status).toBe(409);
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("rechecks expiration after downloading and before writing a revision", async () => {
    mocks.tx.mockResolvedValueOnce([{ ...reservation, expires_at: new Date(0) }]);
    expect((await post()).status).toBe(409);
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });
  it("requires signing the pending evidence revision before uploading another", async () => {
    mocks.tx.mockResolvedValueOnce([{ ...reservation, expected_revision: 1 }]).mockResolvedValueOnce([{
      recipient_user: "recipient", recipient_active: true, status: "FUNDED", evidence_revision: 1,
      verifier_sync_required: true, claim_deadline: new Date(Date.now() + 60_000),
    }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "stored-version" }]).mockResolvedValue([]);
    expect((await post()).status).toBe(409);
  });
  it("refuses a new evidence revision while a chain operation is unresolved", async () => {
    mocks.tx.mockResolvedValueOnce([reservation]).mockResolvedValueOnce([{
      recipient_user: "recipient", recipient_active: true, status: "FUNDED", evidence_revision: 0,
      claim_deadline: new Date(Date.now() + 60_000),
    }]).mockResolvedValueOnce([{ id: "pending-op" }]).mockResolvedValue([]);
    expect((await post()).status).toBe(409);
  });
  it("stores a revision only after verifying actual bytes", async () => {
    mocks.tx.mockResolvedValueOnce([reservation]).mockResolvedValueOnce([{
      recipient_user: "recipient", recipient_active: true, status: "FUNDED", evidence_revision: 0,
      claim_deadline: new Date(Date.now() + 60_000),
    }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "stored-version" }]).mockResolvedValue([]);
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ evidence_id: "stored-version", revision: 1 });
    expect(mocks.download).toHaveBeenCalledWith("test-upload.bin");
    expect(mocks.tx.mock.calls.flat()).toContain("test-upload.bin");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
