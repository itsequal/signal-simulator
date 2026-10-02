import { describe, expect, it } from 'vitest';
import { computeWarnings } from '../dsp/metrics';
import { defaultRawParams, validateParams, type RawParams } from './params';

function raw(overrides: Partial<RawParams> = {}): RawParams {
  return { ...defaultRawParams(), ...overrides };
}

describe('validación de parámetros (T-VAL-01…06)', () => {
  it('los valores iniciales son válidos en las cuatro modulaciones', () => {
    for (const modulation of ['ask', 'ook', 'fsk', 'bpsk'] as const) {
      expect(validateParams(defaultRawParams(), modulation).params).not.toBeNull();
    }
  });

  it('rechaza vacío, no finito, negativo y fuera de rango', () => {
    expect(validateParams(raw({ carrierHz: '' }), 'ask').byField.carrierHz?.code).toBe('E-FC-EMPTY');
    expect(validateParams(raw({ carrierHz: 'Infinity' }), 'ask').byField.carrierHz?.code).toBe('E-FC-NAN');
    expect(validateParams(raw({ carrierHz: '-10' }), 'ask').byField.carrierHz?.code).toBe('E-FC-NEG');
    expect(validateParams(raw({ carrierHz: '50' }), 'ask').byField.carrierHz?.code).toBe('E-FC-RANGE');
    expect(validateParams(raw({ carrierHz: '1000.5' }), 'ask').byField.carrierHz?.code).toBe('E-FC-INT');
  });

  it('en FSK exige f₀ > 0 y avisa, sin bloquear, cuando f₀ es bajo', () => {
    const invalid = validateParams(raw({ carrierHz: '200', deltaHz: '250' }), 'fsk');
    expect(invalid.byField.deltaHz?.code).toBe('E-F0-NONPOS');
    const low = validateParams(raw({ carrierHz: '300', deltaHz: '250' }), 'fsk');
    expect(low.params).not.toBeNull();
    expect(computeWarnings(low.params!, 'fsk').some((item) => item.code === 'W-F0-LOW')).toBe(true);
  });

  it('un Δf incorrecto no impide simular ASK', () => {
    expect(validateParams(raw({ deltaHz: '-5' }), 'ask').params).not.toBeNull();
    expect(validateParams(raw({ deltaHz: '-5' }), 'fsk').params).toBeNull();
  });

  it('ASK exige 0 < A₀ < A₁ ≤ 1 y acepta la coma decimal', () => {
    expect(validateParams(raw({ a0: '0' }), 'ask').byField.a0?.code).toBe('E-A0-NONPOS');
    expect(validateParams(raw({ a1: '1.2' }), 'ask').byField.a1?.code).toBe('E-A1-MAX');
    expect(validateParams(raw({ a0: '0,8', a1: '0,5' }), 'ask').byField.a0?.code).toBe('E-A-ORDER');
    expect(validateParams(raw({ a0: '0,3' }), 'ask').params?.a0).toBeCloseTo(0.3, 6);
  });

  it('distingue la advertencia de ciclos no enteros de un error', () => {
    const result = validateParams(raw({ carrierHz: '1050' }), 'ask');
    const notes = computeWarnings(result.params!, 'ask');
    expect(notes.every((item) => item.severity !== 'error')).toBe(true);
    expect(notes.some((item) => item.code === 'I-CYCLES')).toBe(true);
  });
});
