import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LiveRpc } from "../lib/chain/live";

describe("live submission gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects before any RPC submission when STELLAR_ALLOW_SUBMISSION is not enabled", async () => {
    vi.stubEnv("STELLAR_ALLOW_SUBMISSION", "0");
    await expect(new LiveRpc().submit("signed-xdr")).rejects.toMatchObject({
      code: "SUBMISSION_DISABLED",
      status: 403,
    });
  });
});
