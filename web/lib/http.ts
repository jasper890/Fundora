import { NextResponse } from "next/server";

export function jsonError(
  code: string,
  status: number,
  message?: string,
  fields?: Record<string, string>,
) {
  if (message || fields) {
    return NextResponse.json(
      { error: { code, message: message ?? code, fields: fields ?? {} } },
      {
        status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
  return NextResponse.json(
    { error: code },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export function jsonOk<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Native-app access token. Only honored when the request carries no cookies:
 * CSRF needs ambient cookie credentials, so a bearer-only request cannot be forged cross-site.
 */
export function bearerToken(request: Request): string | null {
  if (process.env.MOBILE_BEARER_AUTH !== "1") return null;
  if (request.headers.has("cookie")) return null;
  const match = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

export function requireSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (bearerToken(request)) return true;
    return ["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  }
  const url = new URL(request.url);
  if (origin === url.origin) return true;

  // Local tooling (Playwright / next start): treat localhost and 127.0.0.1 as one host.
  try {
    const o = new URL(origin);
    const local = new Set(["localhost", "127.0.0.1"]);
    return (
      local.has(o.hostname) &&
      local.has(url.hostname) &&
      o.protocol === url.protocol &&
      (o.port || defaultPort(o.protocol)) ===
        (url.port || defaultPort(url.protocol))
    );
  } catch {
    return false;
  }
}

function defaultPort(protocol: string): string {
  return protocol === "https:" ? "443" : "80";
}

export function clientIp(request: Request): string {
  if (process.env.VERCEL !== "1") return "local";
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "vercel-unknown";
}
