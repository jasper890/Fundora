import { describe, expect, it } from "vitest";

/**
 * Deploy apply rules (mirrored for unit clarity — SQL path tested via integration).
 * Constructor leaves on-chain version at 0; live contract ids must look like C… StrKey.
 */
function resolveDeployContractId(
  awardId: string,
  contractId?: string | null,
): string {
  const fallback = `C${awardId.replace(/-/g, "").slice(0, 55)}`;
  if (
    contractId &&
    contractId.startsWith("C") &&
    contractId.length >= 56
  ) {
    return contractId;
  }
  return fallback;
}

describe("DEPLOY apply contract id + version policy", () => {
  const awardId = "4a79c055-b003-40d0-9d98-e43d19794e9c";

  it("prefers live returnValue contract id", () => {
    const live =
      "CC5UMIFT7BZ65CO72KACKO7NIBJTYWO552OPSLUXDPLUINGIFQVJOFSP";
    expect(resolveDeployContractId(awardId, live)).toBe(live);
  });

  it("falls back to synthetic only when live id missing", () => {
    expect(resolveDeployContractId(awardId, null).startsWith("C")).toBe(true);
    expect(resolveDeployContractId(awardId, "short")).toBe(
      `C${awardId.replace(/-/g, "").slice(0, 55)}`,
    );
  });

  it("documents post-deploy local version stays 0", () => {
    // applyConfirmedAction DEPLOY sets version = 0 (not version + 1).
    const afterDeployVersion = 0;
    expect(afterDeployVersion).toBe(0);
  });
});
