import { describe, expect, it } from "vitest";
import { ChainError } from "../lib/chain/constants";
import { validateIntent } from "../lib/chain/intent";

describe("validateIntent", () => {
  it("accepts deploy with empty params", () => {
    expect(() => validateIntent("DEPLOY", { params: {} })).not.toThrow();
  });

  it("requires expected_version for fund", () => {
    expect(() => validateIntent("FUND", { params: {} })).toThrow(ChainError);
  });

  it("accepts fund with version string", () => {
    expect(() =>
      validateIntent("FUND", { params: {}, expected_version: "0" }),
    ).not.toThrow();
  });

  it("rejects unexpected params", () => {
    expect(() =>
      validateIntent("FUND", {
        params: { amount: 1 },
        expected_version: "0",
      }),
    ).toThrow(ChainError);
  });
});
