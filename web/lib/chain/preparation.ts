export type PreparationRequest = {
  award: string;
  action: string;
  payload: Record<string, unknown>;
};

type PreparationOperation = Record<string, unknown> & { status: string };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function samePreparationRequest(
  intent: unknown,
  request: PreparationRequest,
): boolean {
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return false;
  const record = intent as Record<string, unknown>;
  const storedRequest = record.request ?? {
    award: record.award,
    action: record.action,
    payload: record.payload,
  };
  return canonicalJson(storedRequest) === canonicalJson(request);
}

export function classifyPreparationReplay(
  operation: PreparationOperation,
  request: PreparationRequest,
  now = Date.now(),
):
  | { kind: "conflict" | "building" | "prepared" | "expired" | "existing"; operation: PreparationOperation } {
  if (!samePreparationRequest(operation.intent ?? operation, request)) {
    return { kind: "conflict", operation };
  }
  const expires = new Date(String(operation.expires_at ?? "")).getTime();
  if ((operation.status === "BUILDING" || operation.status === "PREPARED") &&
      (!Number.isFinite(expires) || expires <= now)) {
    return { kind: "expired", operation };
  }
  if (operation.status === "BUILDING") return { kind: "building", operation };
  if (operation.status === "PREPARED") return { kind: "prepared", operation };
  return { kind: "existing", operation };
}
