import { sql } from "@/lib/db";
import { jsonError, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function spreadsheetText(value: string): string {
  const trimmed = value.replace(/^\s+/, "");
  if (
    trimmed.startsWith("=") ||
    trimmed.startsWith("+") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("@")
  ) {
    return `'${value}`;
  }
  return value;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id: programId } = await context.params;
  const format = new URL(request.url).searchParams.get("format") || "json";
  if (format !== "json" && format !== "csv") {
    return jsonError("INVALID_FORMAT", 400, "Choose JSON or CSV.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const db = sql();
  const membership = (await db`
    select role, active from program_member
    where program_id = ${programId} and user_id = ${appUser.id}
    limit 1
  `) as unknown as { role: string; active: boolean }[];
  const member = membership[0];
  if (
    !member?.active ||
    (member.role !== "SPONSOR" && member.role !== "VERIFIER" && !appUser.is_staff)
  ) {
    return jsonError("FORBIDDEN", 403);
  }

  const program = (await db`
    select id, title from program where id = ${programId} limit 1
  `) as unknown as { id: string; title: string }[];
  if (!program[0]) return jsonError("NOT_FOUND", 404);

  const awards = (await db`
    select a.id, a.status, a.version, a.contract_id, a.evidence_revision,
           a.evidence_digest, a.last_confirmed_ledger, a.base_units,
           a.verifier_sync_required,
           sm.user_id as sponsor_user_id,
           vm.user_id as verifier_user_id
    from award a
    join program_member sm on sm.id = a.sponsor_member_id
    join program_member vm on vm.id = a.verifier_member_id
    where a.program_id = ${programId}
  `) as unknown as Record<string, unknown>[];

  const visible = awards.filter((a) => {
    if (appUser.is_staff) return true;
    if (String(a.sponsor_user_id) === appUser.id) return true;
    if (
      String(a.verifier_user_id) === appUser.id &&
      !Boolean(a.verifier_sync_required)
    ) {
      return true;
    }
    return false;
  });

  const rows: Record<string, string>[] = [];
  for (const award of visible) {
    const ops = (await db`
      select action, status, signed_hash, confirmed_ledger
      from chain_operation
      where award_id = ${String(award.id)}
      order by created_at
    `) as unknown as {
      action: string;
      status: string;
      signed_hash: string | null;
      confirmed_ledger: number | null;
    }[];
    const base = {
      program_id: program[0].id,
      program_title: program[0].title,
      award_id: String(award.id),
      asset: "Testnet XLM",
      amount_base_units: String(award.base_units),
      award_status: String(award.status),
      version: String(award.version),
      contract_id: String(award.contract_id || ""),
      evidence_revision: String(award.evidence_revision),
      evidence_digest: String(award.evidence_digest || ""),
      last_confirmed_ledger: String(award.last_confirmed_ledger || ""),
    };
    const list = ops.length ? ops : [null];
    for (const operation of list) {
      rows.push({
        ...base,
        action: operation?.action ?? "",
        operation_status: operation?.status ?? "",
        transaction_hash: operation?.signed_hash ?? "",
        confirmed_ledger: String(operation?.confirmed_ledger ?? ""),
      });
    }
  }

  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `attachment; filename="proofpay-${programId}.${format}"`,
  };

  if (format === "json") {
    return NextResponse.json(
      { synthetic: true, network: "TESTNET", awards: rows },
      { headers },
    );
  }

  const fields =
    rows[0] != null
      ? Object.keys(rows[0])
      : ["program_id", "program_title", "award_id", "award_status"];
  const lines = [
    fields.join(","),
    ...rows.map((row) =>
      fields
        .map((f) => {
          const raw = spreadsheetText(String(row[f] ?? ""));
          return `"${raw.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ];
  return new NextResponse(lines.join("\n"), {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
