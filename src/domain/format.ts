const GROUP_SEPARATOR = '\u202F';
const MINUS_SIGN = '\u2212';

export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  const fixed = Math.abs(value).toFixed(fractionDigits);
  const [intPart, fracPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
  const sign = value < 0 && Number(fixed) !== 0 ? MINUS_SIGN : '';
  return sign + grouped + (fracPart ? `,${fracPart}` : '');
}

export function formatDecimal(value: number, maxFractionDigits = 3): string {
  const text = formatNumber(value, maxFractionDigits);
  return text.includes(',') ? text.replace(/,?0+$/, '') : text;
}

export function formatCount(value: number): string {
  return formatNumber(value, 0);
}

export function formatHz(value: number, maxFractionDigits = 0): string {
  return `${formatDecimal(value, maxFractionDigits)} Hz`;
}

export function formatSeconds(seconds: number, maxFractionDigits = 3): string {
  return `${formatDecimal(seconds, maxFractionDigits)} s`;
}

export function formatMs(seconds: number, maxFractionDigits = 3): string {
  return `${formatDecimal(seconds * 1000, maxFractionDigits)} ms`;
}

export function formatDuration(seconds: number): string {
  return Math.abs(seconds) < 1 ? formatMs(seconds, 3) : formatSeconds(seconds, 3);
}

export function formatPercent(fraction: number, maxFractionDigits = 2): string {
  return `${formatDecimal(fraction * 100, maxFractionDigits)} %`;
}

export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}
