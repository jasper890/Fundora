import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clientIp, requireSameOrigin } from "@/lib/http";

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
