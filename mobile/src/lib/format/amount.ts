const STROOPS_PER_XLM = BigInt(10_000_000);

/** Server base-unit decimal string → "20 Testnet XLM". BigInt only: money never goes through floats. */
export function formatTestnetXlm(baseUnits: string): string {
  if (!/^\d+$/.test(baseUnits)) throw new RangeError('Amount must be a base-unit decimal string.');
  const amount = BigInt(baseUnits);
  const whole = (amount / STROOPS_PER_XLM).toString();
  const fraction = (amount % STROOPS_PER_XLM).toString().padStart(7, '0').replace(/0+$/, '');
  return `${fraction ? `${whole}.${fraction}` : whole} Testnet XLM`;
}
