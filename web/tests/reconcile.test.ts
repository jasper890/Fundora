import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sql: vi.fn(), outcome: vi.fn(), read: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sql: mocks.sql }));
vi.mock("@/lib/chain/gateway", () => ({ isFakeRpc: () => false }));
vi.mock("@/lib/chain/live", () => ({ LiveRpc: class {
  getTransaction = mocks.outcome;
  readAward = mocks.read;
} }));
import { reconcileOperation } from "@/lib/chain/reconcile";

let op: Record<string, unknown>;
let award: Record<string, unknown>;
let observations: number;
let writes: { query: string; values: unknown[] }[];
beforeEach(() => {
  op = { id: "op", award_id: "award", status: "UNKNOWN", action: "SUBMIT", signed_hash: "hash" };
  award = { id: "award", program_id: "program", contract_id: "contract", version: 1, last_confirmed_ledger: 10 };
  observations = 0;
  writes = [];
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const q = parts.join("?").replace(/\s+/g, " ").trim();
    if (q.startsWith("select * from chain_operation")) return [{ ...op }];
    if (q.startsWith("select contract_id, deployment_manifest from award") || q.startsWith("select * from award")) return [{ ...award }];
    if (q.startsWith("select id from program_member")) return [{ id: "verifier" }];
    writes.push({ query: q, values });
    if (q.startsWith("update chain_operation")) op.status = q.includes("'UNKNOWN'") ? "UNKNOWN" : values[0];
    if (q.startsWith("insert into chain_observation")) observations++;
    return [];
  };
  let lock = Promise.resolve();
  const db = Object.assign(query, { begin: async (fn: (tx: typeof query) => Promise<unknown>) => {
    const previous = lock;
    let release!: () => void;
    lock = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await fn(query); } finally { release(); }
  } });
  mocks.sql.mockReturnValue(db);
  mocks.outcome.mockResolvedValue({ status: "SUCCESS", ledger: 12 });
  mocks.read.mockResolvedValue({ status: "SUBMITTED", version: 2, evidence_revision: 1,
    evidence_digest: "a".repeat(64), verifier: "wallet", sponsor_hold: false, verifier_hold: false });
});

it("records one terminal observation under concurrent refreshes", async () => {
  await Promise.all([reconcileOperation("op"), reconcileOperation("op")]);
  expect(observations).toBe(1);
  expect(op.status).toBe("CONFIRMED_SUCCESS");
});

it("projects independently read evidence along with the confirmed state", async () => {
  await reconcileOperation("op");
  const write = writes.find((w) => w.query.startsWith("update award"));
  expect(write?.query).toContain("evidence_revision");
  expect(write?.values).toContain("a".repeat(64));
});

it("does not overwrite a newer award snapshot with an older poll", async () => {
  award.version = 4;
  award.last_confirmed_ledger = 15;
  await reconcileOperation("op");
  expect(writes.filter((w) => w.query.startsWith("update award"))).toHaveLength(0);
  expect(op.status).toBe("CONFIRMED_SUCCESS");
});

it("persists unknown when a successful transaction has unreadable post-state", async () => {
  op.status = "SUBMITTED";
  mocks.read.mockRejectedValueOnce(new Error("archived"));
  await reconcileOperation("op");
  expect(op.status).toBe("UNKNOWN");
  expect(observations).toBe(0);
});

it("preserves a newer unsigned evidence upload and keeps it awaiting chain submission", async () => {
  award.evidence_revision = 3;
  award.evidence_digest = "b".repeat(64);
  await reconcileOperation("op");
  const write = writes.find((w) => w.query.startsWith("update award"));
  expect(write?.values).toContain(3);
  expect(write?.values).toContain("b".repeat(64));
  expect(write?.values).toContain(true);
});

it("keeps a conflicting local digest visible as requiring synchronization", async () => {
  award.evidence_revision = 1;
  award.evidence_digest = "b".repeat(64);
  await reconcileOperation("op");
  const write = writes.find((w) => w.query.startsWith("update award"));
  expect(write?.values).toContain("b".repeat(64));
  expect(write?.values).toContain(true);
});

it("confirms a linked pending review_action after a successful live operation", async () => {
  op.review_id = "review";
  op.action = "APPROVE";
  await reconcileOperation("op");
  const write = writes.find((w) => w.query.startsWith("update review_action"));
  expect(write?.values).toContain("CONFIRMED");
  expect(write?.values).toContain("review");
});

it("marks a linked pending review_action failed after a failed live operation", async () => {
  op.review_id = "review";
  op.action = "APPROVE";
  mocks.outcome.mockResolvedValueOnce({ status: "FAILED", ledger: 12 });
  await reconcileOperation("op");
  const write = writes.find((w) => w.query.startsWith("update review_action"));
  expect(write?.values).toContain("FAILED");
  expect(op.status).toBe("CONFIRMED_FAILED");
});
