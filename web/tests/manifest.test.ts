import { describe, expect, it } from "vitest";
import { canonicalManifest, sha256Hex } from "../lib/evidence/manifest";

describe("evidence manifest", () => {
  it("hashes stably for identical inputs", () => {
    const args = {
      awardId: "11111111-1111-1111-1111-111111111111",
      revision: 1,
      nonce: "abc",
      files: [
        {
          filename: "a.pdf",
          sha256: "aa",
          size: 3,
          content_type: "application/pdf",
        },
      ],
      sourceRef: "https://example.test",
      explanation: "done",
    };
    const a = canonicalManifest(args);
    const b = canonicalManifest(args);
    expect(a.equals(b)).toBe(true);
    expect(sha256Hex(a)).toHaveLength(64);
  });
});
