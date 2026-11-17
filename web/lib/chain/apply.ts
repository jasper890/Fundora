/** Local award transitions after FakeRpc confirms an operation. */

// postgres.js transaction client — keep loose to avoid TransactionSql vs Sql mismatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

export async function applyConfirmedAction(
  tx: Tx,
  args: {
    awardId: string;
    action: string;
    ledger: number;
    intent: Record<string, unknown>;
    /** Real Testnet contract id from deploy returnValue; FakeRpc synthesizes one. */
    contractId?: string | null;
    actorRole?: string;
  },
) {
  const action = args.action.toUpperCase();
  if (action === "DEPLOY") {
    const fallback = `C${args.awardId.replace(/-/g, "").slice(0, 55)}`;
    const contractId =
      args.contractId && args.contractId.startsWith("C") && args.contractId.length >= 56
        ? args.contractId
        : fallback;
    // Constructor leaves on-chain version at 0; do not bump locally or FUND
    // will simulate with the wrong expected_version.
    await tx`
      update award
      set last_confirmed_ledger = ${args.ledger},
          contract_id = coalesce(nullif(contract_id, ''), ${contractId}),
          network_id = 'TESTNET',
          version = 0
      where id = ${args.awardId}
    `;
    return;
  }
  if (action === "FUND") {
    await tx`
      update award
      set status = 'FUNDED',
          last_confirmed_ledger = ${args.ledger},
          version = version + 1
      where id = ${args.awardId}
        and status = 'CREATED'
    `;
    return;
  }
  if (action === "SUBMIT") {
    await tx`
      update award
      set status = 'SUBMITTED',
          last_confirmed_ledger = ${args.ledger},
          version = version + 1,
          verifier_sync_required = false
      where id = ${args.awardId}
        and status in ('FUNDED', 'SUBMITTED')
    `;
    return;
  }
  if (action === "APPROVE") {
    await tx`
      update award
      set status = 'APPROVED',
          last_confirmed_ledger = ${args.ledger},
          version = version + 1
      where id = ${args.awardId}
        and status = 'SUBMITTED'
    `;
    return;
  }
  if (action === "REJECT") {
    await tx`
      update award
      set status = 'REJECTED',
          last_confirmed_ledger = ${args.ledger},
          version = version + 1
      where id = ${args.awardId}
        and status in ('SUBMITTED', 'APPROVED')
    `;
    return;
  }
  if (action === "PAY") {
    await tx`
      update award
      set status = 'PAID',
          settled_at = now(),
          last_confirmed_ledger = ${args.ledger},
          version = version + 1
      where id = ${args.awardId}
        and status = 'APPROVED'
    `;
    return;
  }
  if (action === "CANCEL") {
    await tx`
      update award
      set status = 'CANCELLED',
          settled_at = now(),
          last_confirmed_ledger = ${args.ledger},
          version = version + 1
      where id = ${args.awardId}
        and status = 'CREATED'
    `;
    return;
  }
  if (action === "REFUND") {
    await tx`
      update award
      set status = 'REFUNDED',
          settled_at = now(),
          last_confirmed_ledger = ${args.ledger},
          version = version + 1
      where id = ${args.awardId}
        and status in ('FUNDED', 'SUBMITTED', 'APPROVED', 'REJECTED')
    `;
    return;
  }
  if (action === "REOPEN") {
    await tx`
      update award
      set status = 'SUBMITTED',
          last_confirmed_ledger = ${args.ledger},
          version = version + 1
      where id = ${args.awardId}
        and status in ('APPROVED', 'REJECTED')
    `;
    return;
  }
  if (action === "SET_HOLD") {
    const payload = args.intent?.payload as
      | { params?: { held?: boolean } }
      | undefined;
    const held = Boolean(payload?.params?.held);
    if (args.actorRole === "VERIFIER" || args.intent.actor_role === "VERIFIER") {
      await tx`update award set verifier_hold = ${held}, last_confirmed_ledger = ${args.ledger}, version = version + 1 where id = ${args.awardId}`;
      return;
    }
    await tx`
      update award
      set sponsor_hold = ${held},
          last_confirmed_ledger = ${args.ledger},
          version = version + 1
      where id = ${args.awardId}
    `;
    return;
  }
  if (action === "REPLACE_VERIFIER") {
    const payload = args.intent.payload as { params: { new_verifier_member_id: string } };
    await tx`update award set verifier_member_id = ${payload.params.new_verifier_member_id},
      verifier_hold = false, verifier_sync_required = false,
      status = case when status in ('APPROVED', 'REJECTED') then 'SUBMITTED' else status end,
      last_confirmed_ledger = ${args.ledger}, version = version + 1 where id = ${args.awardId}`;
    return;
  }
  // TTL maintenance does not change the contract's business version.
  await tx`
    update award
    set last_confirmed_ledger = ${args.ledger}
    where id = ${args.awardId}
  `;
}
