import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const award: Record<string, unknown> = {};
  const query = vi.fn();
  const txQuery = vi.fn();
  const tx = Object.assign(txQuery, { json: vi.fn((value) => value) });
  const db = Object.assign(query, { json: vi.fn((value) => value), begin: vi.fn() });
  const snapshot: Record<string, unknown> = {};
  const getUser = vi.fn();
  const actor = vi.fn();
  const fake = vi.fn();
  const fakeRead = vi.fn();
  const fakePrepare = vi.fn();
  const liveRead = vi.fn();
  const livePrepare = vi.fn();
  const existing = vi.fn();
  const latestEvidence = vi.fn();
  const confirmedEvidence = vi.fn();
  const review = vi.fn();
  const replacement = vi.fn();
  const fakeSubmits = vi.fn();
  return {
    events, award, query, txQuery, tx, db, snapshot, getUser, actor,
    fake, fakeRead, fakePrepare, liveRead, livePrepare, existing,
    latestEvidence, confirmedEvidence, review, replacement, fakeSubmits,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sql: () => mocks.db }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/awards/queries", () => ({ loadAppUserByAuthId: mocks.actor }));
vi.mock("@/lib/chain/gateway", () => ({
  isFakeRpc: () => mocks.fake(),
  createRpc: () => ({ readAward: mocks.fakeRead, prepare: mocks.fakePrepare }),
}));
vi.mock("@/lib/chain/live", () => ({
  LiveRpc: class {
    readAward(...args: unknown[]) { return mocks.liveRead(...args); }
    prepareLive(...args: unknown[]) { return mocks.livePrepare(...args); }
  },
}));

import { POST } from "@/app/api/v1/awards/[id]/prepare/[action]/route";

const awardId = "11111111-1111-4111-8111-111111111111";
const evidenceId = "22222222-2222-4222-8222-222222222222";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";
const digest = "a".repeat(64);

function makeAward(overrides: Record<string, unknown> = {}) {
  return {
    id: awardId, program_id: "program-1", contract_id: "C".repeat(56),
    version: 0, status: "CREATED", evidence_revision: 0, evidence_digest: "",
    verifier_sync_required: false, sponsor_hold: false, verifier_hold: false,
    base_units: 200000000, deployment_manifest: {},
    requirements_text: "Synthetic community repair completion", requirements_version: 1,
    claim_deadline: new Date(Date.now() + 86_400_000),
    review_deadline: new Date(Date.now() + 172_800_000),
    payout_deadline: new Date(Date.now() + 259_200_000),
    sponsor_member_id: "sponsor-member", sponsor_user_id: "sponsor", sponsor_role: "SPONSOR",
    sponsor_active: true, sponsor_wallet: "GSPONSOR",
    verifier_member_id: "verifier-member", verifier_user_id: "verifier", verifier_role: "VERIFIER",
    verifier_active: true, verifier_wallet: "GVERIFIER",
    recipient_member_id: "recipient-member", recipient_user_id: "recipient", recipient_role: "RECIPIENT",
    recipient_active: true, recipient_wallet: "GRECIPIENT",
    ...overrides,
  };
}

function queryText(strings: TemplateStringsArray): string {
  return strings.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}

function installQueryHandlers() {
  const respond = (target: typeof mocks.query, label: string) => target.mockImplementation(async (strings: TemplateStringsArray) => {
    const query = queryText(strings);
    mocks.events.push(`${label}:${query}`);
    if (query.includes("select a.*, p.requirements_text")) return [mocks.award];
    if (query.includes("select co.intent, ev.revision, ev.digest")) return mocks.fakeSubmits();
    if (query.includes("select * from chain_operation where actor_id")) return mocks.existing();
    if (query.includes("select id, revision, digest") && query.includes("from evidence_version")) return mocks.latestEvidence();
    if (query.startsWith("select id, author_id from evidence_version")) return mocks.confirmedEvidence();
    if (query.startsWith("select ra.id")) return mocks.review();
    if (query.includes("from program_member pm")) return mocks.replacement();
    if (query.startsWith("select id, status, action from chain_operation")) return [];
    if (query.startsWith("insert into chain_operation")) return [{ id: "operation-1" }];
    if (query.startsWith("update chain_operation set status = 'prepared'")) return [{ id: "operation-1", status: "PREPARED" }];
    return [];
  });
  respond(mocks.query, "db");
  respond(mocks.txQuery, "tx");
}

function post(action: string, body: Record<string, unknown>, key = idempotencyKey) {
  return POST(new Request(`https://proofpay.test/api/v1/awards/${awardId}/prepare/${action}`, {
    method: "POST",
    headers: { Origin: "https://proofpay.test", "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: awardId, action }) });
}

describe("award transaction preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.events.length = 0;
    Object.assign(mocks.award, makeAward());
    Object.assign(mocks.snapshot, {
      status: "CREATED", version: 0, evidence_revision: 0, evidence_digest: null,
      verifier: "GVERIFIER", sponsor_hold: false, verifier_hold: false,
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user" } } });
    mocks.actor.mockResolvedValue({ id: "sponsor", username: "sponsor", is_staff: false, is_active: true });
    mocks.fake.mockReturnValue(true);
    mocks.fakeRead.mockImplementation(async () => mocks.snapshot);
    mocks.liveRead.mockImplementation(async () => mocks.snapshot);
    mocks.existing.mockReturnValue([]);
    mocks.latestEvidence.mockReturnValue([{ id: evidenceId, revision: 1, digest, author_id: "recipient" }]);
    mocks.confirmedEvidence.mockReturnValue([{ id: evidenceId, author_id: "recipient" }]);
    mocks.review.mockReturnValue([{ id: "review-1", source_confirmed: true, source_check_method: "checked organizer roster" }]);
    mocks.replacement.mockReturnValue([{ id: "replacement-member", public_wallet: "GREPLACEMENT" }]);
    mocks.fakeSubmits.mockReturnValue([]);
    mocks.fakePrepare.mockImplementation(async () => {
      mocks.events.push("prepare");
      return { toXdr: () => "FAKE-PREPARED", hashHex: () => "fake-hash", fee: 100,
        source: "GSPONSOR", signatureCount: 0, operationCount: 1, maxTime: Math.floor(Date.now() / 1000) + 120 };
    });
    mocks.livePrepare.mockImplementation(async () => ({
      toXdr: () => "LIVE-PREPARED", hashHex: () => "live-hash", fee: 100,
      source: "GSPONSOR", signatureCount: 0, operationCount: 1, maxTime: Math.floor(Date.now() / 1000) + 120,
    }));
    mocks.db.begin.mockImplementation((callback) => callback(mocks.tx));
    installQueryHandlers();
  });

  it("commits BUILDING before simulation and then stores the prepared envelope", async () => {
    const response = await post("FUND", { expected_version: "0", params: {} });
    expect(response.status).toBe(200);
    const insert = mocks.txQuery.mock.calls.find(([strings]) => queryText(strings).startsWith("insert into chain_operation"));
    expect(insert).toBeTruthy();
    expect(queryText(insert![0])).toContain("'building'");
    expect(mocks.events.indexOf(`tx:${queryText(insert![0])}`)).toBeLessThan(mocks.events.indexOf("prepare"));
    expect(mocks.query.mock.calls.some(([strings]) => queryText(strings).startsWith("update chain_operation set status = 'prepared'"))).toBe(true);
  });

  it("returns the same prepared envelope for an exact idempotent replay", async () => {
    mocks.existing.mockReturnValue([{
      id: "operation-previous", status: "PREPARED", expires_at: new Date(Date.now() + 60_000),
      intent: { request: { award: awardId, action: "FUND", payload: { expected_version: "0", params: {} } } },
      preview: { action: "FUND" }, unsigned_xdr: "the-same-xdr", unsigned_hash: "the-same-hash",
    }]);
    const response = await post("FUND", { expected_version: "0", params: {} });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "operation-previous", unsigned_xdr: "the-same-xdr", unsigned_hash: "the-same-hash" });
    expect(mocks.fakePrepare).not.toHaveBeenCalled();
    expect(mocks.fakeRead).not.toHaveBeenCalled();
  });

  it("rejects a changed intent that reuses an idempotency key", async () => {
    mocks.existing.mockReturnValue([{
      id: "operation-previous", status: "PREPARED", expires_at: new Date(Date.now() + 60_000),
      intent: { request: { award: awardId, action: "FUND", payload: { expected_version: "0", params: {} } } },
    }]);
    const response = await post("FUND", { expected_version: "1", params: {} });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "IDEMPOTENCY_CONFLICT" });
    expect(mocks.fakePrepare).not.toHaveBeenCalled();
  });

  it("releases the BUILDING reservation on simulation failure without exposing RPC details", async () => {
    mocks.fakePrepare.mockImplementationOnce(async () => {
      mocks.events.push("prepare");
      throw new Error("fetch failed at https://private-rpc.example/secret");
    });
    const response = await post("FUND", { expected_version: "0", params: {} });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "RPC_UNAVAILABLE", message: "The configured Testnet RPC could not prepare the transaction.", fields: {} } });
    expect(mocks.query.mock.calls.some(([strings]) => queryText(strings).includes("status = 'abandoned'"))).toBe(true);
    expect(JSON.stringify(body)).not.toContain("private-rpc");
  });

  it("stores the exact latest local evidence commitment in the reserved SUBMIT intent", async () => {
    Object.assign(mocks.award, makeAward({
      status: "FUNDED", version: 1, evidence_revision: 1, evidence_digest: digest,
      verifier_sync_required: true,
    }));
    Object.assign(mocks.snapshot, { status: "FUNDED", version: 1, evidence_revision: 0, evidence_digest: null });
    mocks.actor.mockResolvedValue({ id: "recipient", username: "recipient", is_staff: false, is_active: true });
    const response = await post("SUBMIT", { expected_version: "1", params: { evidence_id: evidenceId } });
    expect(response.status).toBe(200);
    const insert = mocks.txQuery.mock.calls.find(([strings]) => queryText(strings).startsWith("insert into chain_operation"));
    expect(insert).toBeTruthy();
    expect(insert![6]).toMatchObject({ evidence: { id: evidenceId, revision: 1, digest, author_id: "recipient" } });
  });

  it("binds approval to the pending review and exact confirmed evidence", async () => {
    Object.assign(mocks.award, makeAward({
      status: "SUBMITTED", version: 2, evidence_revision: 1, evidence_digest: digest,
    }));
    Object.assign(mocks.snapshot, { status: "SUBMITTED", version: 2, evidence_revision: 1, evidence_digest: digest });
    mocks.actor.mockResolvedValue({ id: "verifier", username: "verifier", is_staff: false, is_active: true });
    mocks.fakeSubmits.mockReturnValue([{ intent: { evidence: { id: evidenceId, revision: 1, digest } }, revision: 1, digest }]);
    const response = await post("APPROVE", { expected_version: "2", params: {} });
    expect(response.status).toBe(200);
    const insert = mocks.txQuery.mock.calls.find(([strings]) => queryText(strings).startsWith("insert into chain_operation"));
    expect(insert![6]).toMatchObject({ review_id: "review-1", evidence: { id: evidenceId, revision: 1, digest, author_id: "recipient" } });
    expect(insert![0].join(" ")).toContain("review_id");
  });

  it("resolves a live replacement to an active same-program wallet before simulation", async () => {
    mocks.fake.mockReturnValue(false);
    Object.assign(mocks.award, makeAward({ status: "SUBMITTED", version: 2 }));
    Object.assign(mocks.snapshot, { status: "SUBMITTED", version: 2 });
    mocks.actor.mockResolvedValue({ id: "sponsor", username: "sponsor", is_staff: false, is_active: true });
    const response = await post("REPLACE_VERIFIER", {
      expected_version: "2", params: { new_verifier_member_id: "44444444-4444-4444-8444-444444444444" },
    });
    expect(response.status).toBe(200);
    expect(mocks.livePrepare).toHaveBeenCalledWith(expect.objectContaining({ newVerifierWallet: "GREPLACEMENT" }));
  });

  it("blocks payment while local evidence still differs from the confirmed chain commitment", async () => {
    Object.assign(mocks.award, makeAward({ status: "APPROVED", version: 3, verifier_sync_required: true }));
    Object.assign(mocks.snapshot, { status: "APPROVED", version: 3 });
    const response = await post("PAY", { expected_version: "3", params: {} });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "STALE_EVIDENCE" });
    expect(mocks.fakeRead).not.toHaveBeenCalled();
    expect(mocks.fakePrepare).not.toHaveBeenCalled();
  });
});
