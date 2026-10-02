import { describe, expect, it } from 'vitest';
import { BIT_RATES, DEFAULTS, LIMITS, RANGES, SIM_SAMPLE_RATE } from './constants';

describe('constantes', () => {
  it('todas las tasas producen un número entero de muestras por bit', () => {
    for (const rate of BIT_RATES) {
      expect(Number.isInteger(SIM_SAMPLE_RATE / rate)).toBe(true);
    }
  });

  it('la selección por defecto cabe en 30 s incluso a la tasa mínima', () => {
    expect(LIMITS.defaultSelectionBits / Math.min(...BIT_RATES)).toBeLessThanOrEqual(LIMITS.maxSimSeconds);
  });

  it('el tono más alto posible queda por debajo de Nyquist', () => {
    expect(RANGES.carrierHz.max + RANGES.deltaHz.max).toBeLessThan(SIM_SAMPLE_RATE / 2);
  });

  it('los valores iniciales están dentro de los rangos', () => {
    expect(DEFAULTS.carrierHz).toBeGreaterThanOrEqual(RANGES.carrierHz.min);
    expect(DEFAULTS.deltaHz).toBeLessThan(DEFAULTS.carrierHz);
    expect(DEFAULTS.a0).toBeGreaterThan(0);
    expect(DEFAULTS.a0).toBeLessThan(DEFAULTS.a1);
  });
});
