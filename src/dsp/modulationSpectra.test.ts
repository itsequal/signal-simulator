import { describe, expect, it } from 'vitest';
import type { ModulationKind, SimulationConfig } from '../domain/types';
import { generateSignals, samplesPerBit } from './modulation';
import { computeTxSpectra, defaultTxRange } from './spectrum';

const F = 48_000;

function spectraFor(pattern: string, modulation: ModulationKind) {
  const bits = Uint8Array.from(pattern, (c) => (c === '1' ? 1 : 0));
  const config: SimulationConfig = {
    modulation,
    sampleRate: F,
    params: { carrierHz: 1000, bitRate: 100, deltaHz: 250, a0: 0.25, a1: 1 },
  };
  const buffers = generateSignals(bits, config);
  const spectra = computeTxSpectra(buffers, defaultTxRange(buffers.modulated.length, samplesPerBit(100)), F);
  if (!spectra) throw new Error('sin espectro');
  return spectra;
}

function argMax(values: Float32Array): number {
  let best = 0;
  for (let k = 1; k < values.length; k++) if (values[k] > values[best]) best = k;
  return best;
}

describe('espectros de las modulaciones (T-FFT-10…13)', () => {
  it('BPSK con todo ceros y con todo unos tiene el mismo espectro de magnitud', () => {
    const zeros = spectraFor('0'.repeat(256), 'bpsk').modulated.amplitude;
    const ones = spectraFor('1'.repeat(256), 'bpsk').modulated.amplitude;
    expect(ones.every((v, k) => v === zeros[k])).toBe(true);
  });

  it('BPSK alternante no tiene su máximo en f_c: aparece en f_c ± R_b/2', () => {
    const { modulated } = spectraFor('01'.repeat(128), 'bpsk');
    const bin = modulated.meta.binHz;
    const peakHz = argMax(modulated.amplitude) * bin;
    expect(Math.abs(peakHz - 1000)).toBeGreaterThan(2 * bin);
    expect(Math.min(Math.abs(peakHz - 950), Math.abs(peakHz - 1050))).toBeLessThanOrEqual(2 * bin);
  });

  it('FSK: todo ceros en f_0 = 750 Hz y todo unos en f_1 = 1 250 Hz', () => {
    for (const [pattern, f] of [['0', 750], ['1', 1250]] as const) {
      const { modulated } = spectraFor(pattern.repeat(256), 'fsk');
      const peak = argMax(modulated.amplitude);
      expect(Math.abs(peak * modulated.meta.binHz - f)).toBeLessThanOrEqual(modulated.meta.binHz);
      expect(modulated.amplitude[peak]).toBeGreaterThanOrEqual(0.84);
    }
  });

  it('ASK con todo unos tiene su pico en f_c y la NRZ de unos tiene DC = 1', () => {
    const spectra = spectraFor('1'.repeat(256), 'ask');
    const peak = argMax(spectra.modulated.amplitude);
    expect(Math.abs(peak * spectra.modulated.meta.binHz - 1000)).toBeLessThanOrEqual(spectra.modulated.meta.binHz);
    expect(spectra.modulated.amplitude[peak]).toBeGreaterThanOrEqual(0.84);
    expect(spectra.nrz.amplitude[0]).toBeCloseTo(1, 6);
  });

  it('NRZ, portadora y modulada comparten el mismo intervalo analizado', () => {
    const spectra = spectraFor('1011001011100001', 'ook');
    expect(spectra.nrz.meta.range).toEqual(spectra.range);
    expect(spectra.carrier.meta.range).toEqual(spectra.range);
    expect(spectra.modulated.meta.range).toEqual(spectra.range);
  });
});
