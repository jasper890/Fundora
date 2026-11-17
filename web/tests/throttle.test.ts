import { describe, expect, it } from "vitest";
import {
  accountIpDigest,
  evaluateThrottle,
  MAX_LOGIN_FAILURES,
  recordFailure,
  THROTTLED_MESSAGE,
} from "../lib/auth/throttle";

describe("login throttle", () => {
  it("digests username case-insensitively", () => {
    const secret = "test-secret";
    expect(accountIpDigest("Alice", "1.2.3.4", secret)).toBe(
      accountIpDigest("alice", "1.2.3.4", secret),
    );
  });

  it("throttles after five failures in the window", () => {
    const now = new Date("2026-11-17T00:00:00Z");
    const attempt = evaluateThrottle(null, "digest", now);
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    let row = attempt.attempt;
    for (let i = 0; i < MAX_LOGIN_FAILURES; i += 1) {
      row = recordFailure(row, now);
    }
    const blocked = evaluateThrottle(row, "digest", now);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.message).toBe(THROTTLED_MESSAGE);
  });
});
