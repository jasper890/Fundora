import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bearerToken, clientIp, requireSameOrigin } from "@/lib/http";

afterEach(() => {
  delete process.env.VERCEL;
});

beforeEach(() => {
  delete process.env.VERCEL;
});

describe("unsafe request origin checks", () => {
  it("rejects unsafe requests without Origin", () => {
    expect(
      requireSameOrigin(new Request("https://proofpay.test/api", { method: "POST" })),
    ).toBe(false);
  });

  it("accepts same-origin writes and rejects cross-site or invalid origins", () => {
    expect(
      requireSameOrigin(
        new Request("https://proofpay.test/api", {
          method: "POST",
          headers: { Origin: "https://proofpay.test" },
        }),
      ),
    ).toBe(true);
    expect(
      requireSameOrigin(
        new Request("https://proofpay.test/api", {
          method: "POST",
          headers: { Origin: "https://attacker.test" },
        }),
      ),
    ).toBe(false);
    expect(
      requireSameOrigin(
        new Request("https://proofpay.test/api", {
          method: "POST",
          headers: { Origin: "null" },
        }),
      ),
    ).toBe(false);
  });

  it("allows ordinary no-Origin GET downloads but still rejects cross-site GETs", () => {
    expect(requireSameOrigin(new Request("https://proofpay.test/file"))).toBe(true);
    expect(
      requireSameOrigin(
        new Request("https://proofpay.test/file", {
          headers: { Origin: "https://attacker.test" },
        }),
      ),
    ).toBe(false);
  });
});

describe("client IP selection", () => {
  it("ignores caller-supplied proxy headers outside Vercel", () => {
    const request = new Request("http://localhost/api", {
      headers: {
        "x-forwarded-for": "203.0.113.7",
        "x-real-ip": "203.0.113.8",
      },
    });
    expect(clientIp(request)).toBe("local");
  });

  it("uses only Vercel's platform-forwarded header when hosted there", () => {
    process.env.VERCEL = "1";
    const request = new Request("https://proofpay.test/api", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1",
        "x-real-ip": "198.51.100.2",
      },
    });
    expect(clientIp(request)).toBe("203.0.113.9");
  });
});

describe("mobile bearer requests", () => {
  afterEach(() => {
    delete process.env.MOBILE_BEARER_AUTH;
  });

  const bearerPost = (headers: Record<string, string> = {}) =>
    new Request("https://proofpay.test/api", {
      method: "POST",
      headers: { Authorization: "Bearer jwt-value", ...headers },
    });

  it("accepts a no-Origin write that carries only a bearer token when enabled", () => {
    process.env.MOBILE_BEARER_AUTH = "1";
    expect(bearerToken(bearerPost())).toBe("jwt-value");
    expect(requireSameOrigin(bearerPost())).toBe(true);
  });

  it("keeps rejecting no-Origin writes when the kill switch is off", () => {
    expect(bearerToken(bearerPost())).toBeNull();
    expect(requireSameOrigin(bearerPost())).toBe(false);
  });

  it("never relaxes the check for requests that also carry cookies", () => {
    process.env.MOBILE_BEARER_AUTH = "1";
    const mixed = bearerPost({ Cookie: "sb-access-token=abc" });
    expect(bearerToken(mixed)).toBeNull();
    expect(requireSameOrigin(mixed)).toBe(false);
  });

  it("ignores malformed authorization headers", () => {
    process.env.MOBILE_BEARER_AUTH = "1";
    for (const value of ["Basic abc", "Bearer", "Bearer  ", "bearer"]) {
      const request = new Request("https://proofpay.test/api", {
        method: "POST",
        headers: { Authorization: value },
      });
      expect(bearerToken(request)).toBeNull();
      expect(requireSameOrigin(request)).toBe(false);
    }
  });

  it("still rejects a cross-site Origin even with a bearer token", () => {
    process.env.MOBILE_BEARER_AUTH = "1";
    expect(requireSameOrigin(bearerPost({ Origin: "https://attacker.test" }))).toBe(false);
  });
});
