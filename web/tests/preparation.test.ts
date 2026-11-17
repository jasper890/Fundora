import { describe, expect, it } from "vitest";
import { classifyPreparationReplay, samePreparationRequest } from "../lib/chain/preparation";

const request = { award: "award-1", action: "SUBMIT", payload: { expected_version: "2", params: { evidence_id: "evidence-1" } } };

describe("prepare idempotency", () => {
  it("compares the complete request independent of JSON key order", () => {
    expect(samePreparationRequest({
      award: "award-1", action: "SUBMIT",
      payload: { params: { evidence_id: "evidence-1" }, expected_version: "2" },
    }, request)).toBe(true);
    expect(samePreparationRequest({ ...request, payload: { ...request.payload, expected_version: "3" } }, request)).toBe(false);
    expect(samePreparationRequest({ ...request, action: "APPROVE" }, request)).toBe(false);
  });

  it("replays only a still-live prepared operation", () => {
    const prepared = { ...request, status: "PREPARED", expires_at: new Date(2_000), unsigned_xdr: "same-xdr", unsigned_hash: "same-hash" };
    expect(classifyPreparationReplay(prepared, request, 1_000)).toEqual({ kind: "prepared", operation: prepared });
    expect(classifyPreparationReplay(prepared, request, 3_000)).toEqual({ kind: "expired", operation: prepared });
  });

  it("reports building retries as in progress and never replays changed intent", () => {
    const building = { ...request, status: "BUILDING", expires_at: new Date(2_000) };
    expect(classifyPreparationReplay(building, request, 1_000)).toEqual({ kind: "building", operation: building });
    expect(classifyPreparationReplay(building, { ...request, action: "APPROVE" }, 1_000)).toEqual({ kind: "conflict", operation: building });
  });

  it("does not expose envelopes from abandoned or already submitted operations", () => {
    const submitted = { ...request, status: "SUBMITTED", expires_at: new Date(2_000), unsigned_xdr: "same-xdr" };
    expect(classifyPreparationReplay(submitted, request, 1_000)).toEqual({ kind: "existing", operation: submitted });
  });
});
