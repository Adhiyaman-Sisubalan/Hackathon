/** Canonical, non-exponential decimal strings used for reconciliation evidence. */
const decimalPattern = /^([+-]?)(\d+)(?:\.(\d+))?$/;

export function normalizeDecimal(value: string): string {
  const match = decimalPattern.exec(value.trim());
  if (!match) throw new Error(`Invalid decimal: ${value}`);
  const sign = match[1] === '-' ? '-' : '';
  const whole = match[2]!.replace(/^0+(?=\d)/, '');
  const fraction = (match[3] ?? '').replace(/0+$/, '');
  const unsigned = fraction ? `${whole}.${fraction}` : whole;
  return unsigned === '0' ? '0' : `${sign}${unsigned}`;
}

export function decimalEqual(left: string, right: string): boolean {
  return normalizeDecimal(left) === normalizeDecimal(right);
}

/** Compares canonical decimal strings without coercing through binary floats. */
export function compareNormalizedDecimals(left: string, right: string): number {
  const normalizedLeft = normalizeDecimal(left);
  const normalizedRight = normalizeDecimal(right);
  if (normalizedLeft === normalizedRight) return 0;
  const leftNegative = normalizedLeft.startsWith('-');
  const rightNegative = normalizedRight.startsWith('-');
  if (leftNegative !== rightNegative) return leftNegative ? -1 : 1;
  const unsignedLeft = leftNegative ? normalizedLeft.slice(1) : normalizedLeft;
  const unsignedRight = rightNegative ? normalizedRight.slice(1) : normalizedRight;
  const [leftWhole, leftFraction = ''] = unsignedLeft.split('.');
  const [rightWhole, rightFraction = ''] = unsignedRight.split('.');
  const wholeComparison = leftWhole!.length === rightWhole!.length
    ? leftWhole!.localeCompare(rightWhole!)
    : leftWhole!.length - rightWhole!.length;
  if (wholeComparison !== 0) return leftNegative ? -wholeComparison : wholeComparison;
  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  const fractionComparison = leftFraction.padEnd(fractionLength, '0').localeCompare(rightFraction.padEnd(fractionLength, '0'));
  return leftNegative ? -fractionComparison : fractionComparison;
}
