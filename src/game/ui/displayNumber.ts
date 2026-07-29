export function formatDisplayNumber(
  value: number,
  maximumFractionDigits = 2,
): string {
  if (!Number.isFinite(value)) {
    throw new RangeError('display value must be finite');
  }
  if (
    !Number.isInteger(maximumFractionDigits)
    || maximumFractionDigits < 0
    || maximumFractionDigits > 10
  ) {
    throw new RangeError('maximum fraction digits must be an integer from 0 through 10');
  }
  return Number(value.toFixed(maximumFractionDigits)).toString();
}
