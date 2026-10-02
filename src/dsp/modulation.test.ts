import { describe, expect, it } from 'vitest';
import { BIT_RATES, SIM_SAMPLE_RATE, type BitRate } from '../config/constants';
import type { ModulationKind, SimulationConfig } from '../domain/types';
import {
  durationFor,
  generateCarrier,
  generateFsk,
  generateSignals,
  sampleCountFor,
  samplesPerBit,
} from './modulation';

const F = SIM_SAMPLE_RATE;
const TWO_PI = 2 * Math.PI;

function bitsOf(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(text, (c) => (c === '1' ? 1 : 0));
}

function randomBits(count: number, seed = 12345): Uint8Array<ArrayBuffer> {
  let state = seed;
  const bits = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    bits[i] = state >>> 31;
  }
  return bits;
}

function config(modulation: ModulationKind, overrides: Partial<SimulationConfig['params']> = {}): SimulationConfig {
  return {
    modulation,
    sampleRate: F,
    params: { carrierHz: 1000, bitRate: 100, deltaHz: 250, a0: 0.25, a1: 1, ...overrides },
  };
}

describe('duración y número de muestras (T-DUR-01, T-DUR-02)', () => {
  it('longitud = N·F_sim/R_b y duración = N/R_b para todas las tasas', () => {
    for (const rate of BIT_RATES) {
      for (const n of [1, 16, 256, 3000]) {
        expect(sampleCountFor(n, rate)).toBe((n * F) / rate);
        expect(durationFor(n, rate)).toBe(n / rate);
      }
    }
  });

  it('las señales generadas tienen exactamente esa longitud, con bits iguales o alternados', () => {
    for (const rate of BIT_RATES) {
      for (const pattern of ['0'.repeat(16), '1'.repeat(16), '01'.repeat(8)]) {
        const buffers = generateSignals(bitsOf(pattern), config('ask', { bitRate: rate as BitRate }));
        const expected = (16 * F) / rate;
        expect(buffers.nrz.length).toBe(expected);
        expect(buffers.carrier.length).toBe(expected);
        expect(buffers.modulated.length).toBe(expected);
      }
    }
  });

  it('rechaza tasas sin un número entero de muestras por bit', () => {
    expect(() => samplesPerBit(300 as number)).not.toThrow();
    expect(() => samplesPerBit(7)).toThrow(RangeError);
  });
});

describe('NRZ y portadora (T-MOD-01, T-MOD-02)', () => {
  it('la NRZ vale b_k en todas las muestras de su bit', () => {
    const bits = bitsOf('1011001011100001');
    const { nrz } = generateSignals(bits, config('ask'));
    for (let k = 0; k < bits.length; k++) {
      for (let n = k * 480; n < (k + 1) * 480; n++) expect(nrz[n]).toBe(bits[k]);
    }
  });

  it('la portadora empieza con fase cero y coincide con cos(2π f n / F)', () => {
    for (const fc of [1000, 5000, 1234]) {
      const carrier = generateCarrier(F * 30, fc);
      expect(carrier[0]).toBe(1);
      let maxError = 0;
      for (let n = 0; n < carrier.length; n += 7) {
        maxError = Math.max(maxError, Math.abs(carrier[n] - Math.cos((TWO_PI * fc * n) / F)));
      }
      expect(maxError).toBeLessThan(1e-6);
    }
    expect(generateCarrier(49, 1000)[48]).toBe(1);
  });
});

describe('ASK y OOK (T-MOD-03, T-MOD-04, T-MOD-05)', () => {
  it('ASK conserva A_0 = 0,25 y A_1 = 1 por bit (sin normalizar por bit)', () => {
    const bits = bitsOf('1011001011100001');
    const { modulated } = generateSignals(bits, config('ask'));
    for (let k = 0; k < bits.length; k++) {
      let peak = 0;
      for (let n = k * 480; n < (k + 1) * 480; n++) peak = Math.max(peak, Math.abs(modulated[n]));
      expect(peak).toBeCloseTo(bits[k] ? 1 : 0.25, 6);
    }
  });

  it('OOK con todo ceros es silencio y con todo unos es la portadora', () => {
    const zeros = generateSignals(bitsOf('0'.repeat(32)), config('ook'));
    expect(zeros.modulated.every((v) => v === 0)).toBe(true);
    const ones = generateSignals(bitsOf('1'.repeat(32)), config('ook'));
    expect(ones.modulated.every((v, n) => v === ones.carrier[n])).toBe(true);
  });

  it('ninguna modulación supera la amplitud unitaria', () => {
    const bits = randomBits(64);
    for (const m of ['ask', 'ook', 'fsk', 'bpsk'] as const) {
      const { modulated } = generateSignals(bits, config(m));
      expect(modulated.every((v) => Math.abs(v) <= 1)).toBe(true);
    }
  });
});

describe('FSK de fase continua (T-MOD-06…09)', () => {
  it('todo ceros es un tono puro en f_0 y todo unos en f_1', () => {
    for (const [pattern, f] of [['0', 750], ['1', 1250]] as const) {
      const { modulated } = generateSignals(bitsOf(pattern.repeat(64)), config('fsk'));
      let maxError = 0;
      for (let n = 0; n < modulated.length; n++) {
        maxError = Math.max(maxError, Math.abs(modulated[n] - Math.cos((TWO_PI * f * n) / F)));
      }
      expect(maxError).toBeLessThan(1e-6);
    }
  });

  it('coincide con la fase acumulada analítica en bits aleatorios (7,5 y 12,5 ciclos por bit)', () => {
    const bits = randomBits(256);
    const { modulated } = generateSignals(bits, config('fsk'));
    const spb = 480;
    let turnsAtBitStart = 0;
    let maxError = 0;
    for (let k = 0; k < bits.length; k++) {
      const f = bits[k] ? 1250 : 750;
      for (let j = 0; j < spb; j++) {
        const turns = turnsAtBitStart + (f * j) / F;
        const expected = Math.cos(TWO_PI * (turns - Math.floor(turns)));
        maxError = Math.max(maxError, Math.abs(modulated[k * spb + j] - expected));
      }
      turnsAtBitStart += (f * spb) / F;
    }
    expect(maxError).toBeLessThan(1e-6);
  });

  it('respeta la cota de continuidad |s[n] − s[n−1]| ≤ 2·sin(π f_max / F); la versión ingenua no', () => {

    const bits = bitsOf('0101100111010010');
    const spb = samplesPerBit(200);
    const f0 = 800;
    const f1 = 1300;
    const bound = 2 * Math.sin((Math.PI * f1) / F) + 1e-6;
    const continuous = generateFsk(bits, spb, f0, f1);
    let maxStep = 0;
    for (let n = 1; n < continuous.length; n++) maxStep = Math.max(maxStep, Math.abs(continuous[n] - continuous[n - 1]));
    expect(maxStep).toBeLessThanOrEqual(bound);

    let naiveMaxStep = 0;
    let previous = 1;
    for (let n = 0; n < bits.length * spb; n++) {
      const f = bits[Math.floor(n / spb)] ? f1 : f0;
      const value = Math.cos((TWO_PI * f * n) / F);
      if (n > 0) naiveMaxStep = Math.max(naiveMaxStep, Math.abs(value - previous));
      previous = value;
    }
    expect(naiveMaxStep).toBeGreaterThan(bound);
  });

  it('en el primer límite de bit la fase acumulada es 7,5 ciclos (π): s[S_b] = −1', () => {
    const { modulated } = generateSignals(bitsOf('01'), config('fsk'));
    expect(modulated[480]).toBeCloseTo(-1, 9);
  });
});

describe('BPSK absoluta (T-MOD-10…12)', () => {
  it('todo ceros coincide exactamente con la portadora y todo unos con su negativo', () => {
    const zeros = generateSignals(bitsOf('0'.repeat(64)), config('bpsk'));
    expect(zeros.modulated.every((v, n) => v === zeros.carrier[n])).toBe(true);
    const ones = generateSignals(bitsOf('1'.repeat(64)), config('bpsk'));
    expect(ones.modulated.every((v, n) => v === -ones.carrier[n])).toBe(true);
  });

  it('un bit repetido mantiene su estado de fase (no es diferencial)', () => {
    const { modulated, carrier } = generateSignals(bitsOf('11'), config('bpsk'));
    for (let n = 480; n < 960; n++) expect(modulated[n]).toBe(-carrier[n]);
  });
});
