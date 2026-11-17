/** Port of validate_intent from proofpay/chain.py */
import { ChainError, PARAMS, ROLES } from "./constants";

function isUuid(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function validateIntent(
  action: string,
  payload: unknown,
): void {
  if (!(action in ROLES) || typeof payload !== "object" || payload === null) {
    throw new ChainError("INVALID_ACTION", 400);
  }
  const body = payload as Record<string, unknown>;
  const keys =
    action === "DEPLOY" || action === "EXTEND_TTL"
      ? new Set(["params"])
      : new Set(["params", "expected_version"]);
  const bodyKeys = new Set(Object.keys(body));
  const expectedParams = new Set(PARAMS[action] ?? []);
  if (
    bodyKeys.size !== keys.size ||
    [...keys].some((k) => !bodyKeys.has(k)) ||
    typeof body.params !== "object" ||
    body.params === null ||
    new Set(Object.keys(body.params as object)).size !== expectedParams.size ||
    [...expectedParams].some((k) => !(k in (body.params as object)))
  ) {
    throw new ChainError("INVALID_PARAMETERS", 400);
  }
  if ("expected_version" in body) {
    const version = body.expected_version;
    if (
      typeof version !== "string" ||
      !/^[\x00-\x7F]*$/.test(version) ||
      !/^\d+$/.test(version) ||
      BigInt(version) > BigInt("18446744073709551615")
    ) {
      throw new ChainError("INVALID_VERSION", 400);
    }
  }
  const params = body.params as Record<string, unknown>;
  if (action === "SET_HOLD" && typeof params.held !== "boolean") {
    throw new ChainError("INVALID_PARAMETERS", 400);
  }
  if (
    action === "REPLACE_VERIFIER" &&
    !isUuid(params.new_verifier_member_id)
  ) {
    throw new ChainError("INVALID_PARAMETERS", 400);
  }
  if ("evidence_id" in params && !isUuid(params.evidence_id)) {
    throw new ChainError("INVALID_PARAMETERS", 400);
  }
}
