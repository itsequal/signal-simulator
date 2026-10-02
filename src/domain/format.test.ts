import { describe, expect, it } from 'vitest';
import { formatCodePoint, formatDecimal, formatDuration, formatNumber } from './format';

const S = '\u202F';

describe('formato numérico en español (T-FMT-01)', () => {
  it('agrupa miles con espacio fino, también con 4 cifras', () => {
    expect(formatNumber(64000)).toBe(`64${S}000`);
    expect(formatNumber(1000)).toBe(`1${S}000`);
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1_440_000)).toBe(`1${S}440${S}000`);
  });

  it('usa coma decimal y signo menos tipográfico', () => {
    expect(formatNumber(0.25, 2)).toBe('0,25');
    expect(formatNumber(-50)).toBe('\u221250');
    expect(formatNumber(-0.0001, 2)).toBe('0,00');
  });

  it('formatDecimal elimina ceros finales', () => {
    expect(formatDecimal(10, 3)).toBe('10');
    expect(formatDecimal(2.5, 3)).toBe('2,5');
    expect(formatDecimal(1000, 2)).toBe(`1${S}000`);
  });

  it('duraciones en ms por debajo de 1 s', () => {
    expect(formatDuration(0.16)).toBe('160 ms');
    expect(formatDuration(2.56)).toBe('2,56 s');
  });

  it('puntos de código', () => {
    expect(formatCodePoint(0x61)).toBe('U+0061');
    expect(formatCodePoint(0x1f600)).toBe('U+1F600');
  });
});
