import "server-only";
import { sql } from "@/lib/db";
import { isValidPublicKey } from "@/lib/wallet/validation";

export async function loadProjectVerifierOptions(userId: string, db = sql()) {
  const rows = await db<{
    id: string;
    username: string;
    program_title: string;
    verifier_user_id: string;
    sponsor_wallet: string;
    verifier_wallet: string;
  }[]>`
    select verifier.id, vu.username, p.title as program_title,
      verifier.user_id as verifier_user_id,
      sponsor.public_wallet as sponsor_wallet, verifier.public_wallet as verifier_wallet
    from program_member sponsor
    join app_user su on su.id = sponsor.user_id
    join program p on p.id = sponsor.program_id
    join program_member verifier on verifier.program_id = sponsor.program_id
    join app_user vu on vu.id = verifier.user_id
    where sponsor.user_id = ${userId} and sponsor.role = 'SPONSOR' and sponsor.active
      and su.is_active and not su.must_change_password
      and verifier.role = 'VERIFIER' and verifier.active and vu.is_active
      and verifier.user_id <> sponsor.user_id
      and verifier.public_wallet <> sponsor.public_wallet
    order by vu.username, p.title, verifier.id
    for share of sponsor, verifier, su, vu
  `;
  return rows.filter(({ sponsor_wallet, verifier_wallet }) =>
    isValidPublicKey(sponsor_wallet) && isValidPublicKey(verifier_wallet));
}
