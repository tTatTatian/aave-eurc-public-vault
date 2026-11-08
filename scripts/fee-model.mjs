/**
 * Illustrative fee arithmetic for the documented Aave Simple Earn split.
 * Amounts are integer EURC base units (EURC has 6 decimals).
 * This helper does not implement or replace Aave's on-chain fee accounting.
 */
export function calculateIllustrativeFeeSplit(yieldAmountRaw, feeBps = 1_000n) {
  const yieldAmount = BigInt(yieldAmountRaw);
  if (yieldAmount < 0n) throw new RangeError("yieldAmountRaw cannot be negative");
  if (feeBps < 0n || feeBps > 10_000n) throw new RangeError("feeBps must be between 0 and 10000");

  const totalFee = (yieldAmount * feeBps) / 10_000n;
  const aaveLabs = totalFee / 2n;
  const recipientPool = totalFee - aaveLabs;
  const owner = recipientPool; // The sole configured recipient receives 100% of this pool.

  return {
    yieldAmount,
    totalFee,
    aaveLabs,
    owner,
    depositorYieldAfterFee: yieldAmount - totalFee
  };
}
