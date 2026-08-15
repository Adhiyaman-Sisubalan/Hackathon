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
