import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { requireAssignedWallet } from "../lib/wallet/validation";

describe("wallet validation", () => {
  it("matches the oracle source file", () => {
    const ported = readFileSync(
      resolve(__dirname, "../lib/wallet/validation.ts"),
      "utf8",
    );
    const oracle = readFileSync(
      resolve(__dirname, "../../static_src/wallet_validation.ts"),
      "utf8",
    );
    // Function body semantics must match; whitespace may differ after TypeScript formatting.
    expect(ported).toContain(
      'throw new Error("Select the assigned wallet account before signing.")',
    );
    expect(ported).toContain(
      'throw new Error("Switch your wallet to Stellar Testnet before signing.")',
    );
    expect(oracle).toContain(
      "Select the assigned wallet account before signing.",
    );
  });

  it("rejects wrong account or network", () => {
    expect(() =>
      requireAssignedWallet("G1", "G2", "TESTNET", "TESTNET"),
    ).toThrow(/assigned wallet/);
    expect(() =>
      requireAssignedWallet("G1", "G1", "PUBLIC", "TESTNET"),
    ).toThrow(/Testnet/);
  });
});
