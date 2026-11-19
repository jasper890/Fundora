// Public Stellar Testnet services run by the Stellar Development Foundation. Testnet XLM has no value.
const FRIENDBOT = 'https://friendbot.stellar.org';
const HORIZON = 'https://horizon-testnet.stellar.org';

/** Asks Friendbot for free Testnet XLM. Returns false when the account was already funded. */
export async function fundWithFriendbot(address: string): Promise<boolean> {
  const response = await fetch(`${FRIENDBOT}/?addr=${encodeURIComponent(address)}`);
  if (response.ok) return true;
  const body = await response.text().catch(() => '');
  if (response.status === 400 && /already|op_already_exists|createAccountAlreadyExist/i.test(body)) return false;
  throw new Error('Friendbot could not fund this wallet. Try again in a minute.');
}

/** Native XLM balance in base units (stroops), or null if the account is not funded yet. */
export async function testnetBalance(address: string): Promise<string | null> {
  const response = await fetch(`${HORIZON}/accounts/${encodeURIComponent(address)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not read the Testnet balance.');
  const account = (await response.json()) as { balances?: { asset_type: string; balance: string }[] };
  const balance = account.balances?.find((b) => b.asset_type === 'native')?.balance ?? '0.0000000';
  // Horizon always sends 7 decimals, so dropping the point gives base units without float maths.
  return /^\d+\.\d{7}$/.test(balance) ? balance.replace('.', '').replace(/^0+(?=\d)/, '') : '0';
}
