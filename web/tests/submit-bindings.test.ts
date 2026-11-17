import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn(), actor: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: () => ({ begin: (fn: (tx: typeof mocks.query) => unknown) => fn(mocks.query) }) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth } }) }));
vi.mock("@/lib/awards/queries", () => ({ loadAppUserByAuthId: mocks.actor }));
vi.mock("@/lib/chain/gateway", () => ({ isFakeRpc: () => true }));
vi.mock("@/lib/chain/live", () => ({ LiveRpc: class {} }));
vi.mock("@/lib/chain/apply", () => ({ applyConfirmedAction: mocks.apply }));
import { POST } from "@/app/api/v1/operations/[id]/submit/route";

let op: Record<string, unknown>;
let award: Record<string, unknown>;
let evidence: Record<string, unknown>;
let review: Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  evidence = { id: "evidence", revision: 1, digest: "a".repeat(64), author_id: "actor" };
  op = { id: "op", award_id: "award", actor_id: "actor", signer: "wallet", action: "SUBMIT", status: "PREPARED",
    unsigned_xdr: "FAKE-XDR", preview: { mode: "fakerpc" }, expires_at: new Date(Date.now() + 60_000),
    intent: { payload: { expected_version: "2", params: { evidence_id: "evidence" } }, evidence: { ...evidence } },
    expected_snapshot: { evidence_revision: 0, evidence_digest: null } };
  award = { id: "award", program_id: "program", status: "FUNDED", version: 2, contract_id: "contract",
    evidence_revision: 1, evidence_digest: evidence.digest, verifier_sync_required: true,
    claim_deadline: new Date(Date.now() + 60_000), review_deadline: new Date(Date.now() + 120_000) };
  review = { id: "review", action: "APPROVE", status: "PENDING", expected_version: 2, evidence_id: "evidence",
    revision: 1, digest: evidence.digest, source_confirmed: true, source_check_method: "source", rationale: "checked" };
  mocks.auth.mockResolvedValue({ data: { user: { id: "auth" } } });
  mocks.actor.mockResolvedValue({ id: "actor", is_active: true });
  mocks.query.mockImplementation(async (parts: TemplateStringsArray) => {
    const q = parts.join("?").replace(/\s+/g, " ").trim();
    if (q.startsWith("select * from chain_operation")) return [op];
    if (q.startsWith("select a.*")) return [award];
    if (q.startsWith("select role from program_member")) return [{ role: op.action === "SUBMIT" ? "RECIPIENT" : "VERIFIER" }];
    if (q.includes("from evidence_version")) return [evidence];
    if (q.includes("from review_action")) return [review];
    return [];
  });
});
function submit() {
  return POST(new Request("https://proofpay.test/api/v1/operations/op/submit", { method: "POST",
    headers: { Origin: "https://proofpay.test", "Content-Type": "application/json" },
    body: JSON.stringify({ signed_xdr: "SIGNED-FAKE-XDR" }) }), { params: Promise.resolve({ id: "op" }) });
}
function approval() {
  op.action = "APPROVE"; op.review_id = "review";
  op.intent = { payload: { expected_version: "2", params: {} }, evidence: { ...evidence }, review_id: "review" };
  op.expected_snapshot = { evidence_revision: 1, evidence_digest: evidence.digest };
  award.status = "SUBMITTED"; award.verifier_sync_required = false;
}
it("confirms a submission bound to the current local revision", async () => {
  expect((await submit()).status).toBe(200);
  expect(mocks.apply).toHaveBeenCalledOnce();
});
it("refuses an older prepared submission after a newer local upload", async () => {
  award.evidence_revision = 2; award.evidence_digest = "b".repeat(64);
  expect((await submit()).status).toBe(409);
  expect(mocks.apply).not.toHaveBeenCalled();
});
it("refuses legacy preparations without a bound evidence commitment", async () => {
  op.intent = { payload: { expected_version: "2", params: { evidence_id: "evidence" } } };
  expect((await submit()).status).toBe(409);
  expect(mocks.apply).not.toHaveBeenCalled();
});
it("refuses a submission when intent author_id disagrees with the stored evidence author", async () => {
  op.intent = {
    payload: { expected_version: "2", params: { evidence_id: "evidence" } },
    evidence: { ...evidence, author_id: "other-author" },
  };
  expect((await submit()).status).toBe(409);
  expect(mocks.apply).not.toHaveBeenCalled();
});
it("confirms approval only with its bound pending source-checked review", async () => {
  approval();
  expect((await submit()).status).toBe(200);
});
it("denies approval after a newer unsigned upload invalidates review", async () => {
  approval(); award.verifier_sync_required = true;
  expect((await submit()).status).toBe(409);
  expect(mocks.apply).not.toHaveBeenCalled();
});
it("denies approval if the source-check record is missing", async () => {
  approval(); review.source_confirmed = false;
  expect((await submit()).status).toBe(409);
  expect(mocks.apply).not.toHaveBeenCalled();
});
it("denies payment while local evidence requires synchronization", async () => {
  op.action = "PAY"; award.status = "APPROVED";
  award.payout_deadline = new Date(Date.now() + 60_000);
  mocks.query.mockImplementation(async (parts: TemplateStringsArray) => {
    const q = parts.join("?");
    if (q.includes("from chain_operation")) return [op];
    if (q.includes("select a.*")) return [award];
    if (q.includes("select role")) return [{ role: "SPONSOR" }];
    return [];
  });
  expect((await submit()).status).toBe(409);
  expect(mocks.apply).not.toHaveBeenCalled();
});
