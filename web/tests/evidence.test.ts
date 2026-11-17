import { describe, expect, it } from "vitest";
import {
  MAX_EVIDENCE_SIZE,
  validateEvidenceBytes,
  validateEvidenceFilename,
} from "../lib/evidence/validate";

describe("evidence validation", () => {
  it("accepts pdf magic", () => {
    const data = Buffer.from("%PDF-1.4 demo");
    expect(
      validateEvidenceBytes("proof.pdf", "application/pdf", data),
    ).toBe(true);
  });

  it("rejects path separators in filenames", () => {
    expect(validateEvidenceFilename("../x.pdf")).toBe(false);
  });

  it("rejects oversized payloads", () => {
    const data = Buffer.alloc(MAX_EVIDENCE_SIZE + 1, 1);
    data.write("%PDF-", 0);
    expect(
      validateEvidenceBytes("proof.pdf", "application/pdf", data),
    ).toBe(false);
  });
});
