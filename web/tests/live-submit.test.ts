import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LiveRpc } from "../lib/chain/live";

describe("live submission checkpoint", () => {
  it("rejects before any RPC submission while chain review is incomplete", async () => {
    await expect(new LiveRpc().submit("signed-xdr")).rejects.toMatchObject({
      code: "LIVE_SUBMISSION_REVIEW_REQUIRED",
      status: 403,
    });
  });
});
