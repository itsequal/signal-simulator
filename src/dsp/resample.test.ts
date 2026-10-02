import { describe, expect, it } from 'vitest';
import { resample } from './resample';
import { amplitudeSpectrum } from './spectrum';

const INPUT_RATE = 48_000;
const OUTPUT_RATE = 8_000;

function tone(rate: number, frequency: number, seconds: number, amplitude: number): Float32Array {
  const length = Math.round(rate * seconds);
  const out = new Float32Array(length);
  for (let n = 0; n < length; n++) out[n] = amplitude * Math.cos((2 * Math.PI * frequency * n) / rate);
  return out;
}

function peakNear(samples: Float32Array, sampleRate: number, frequency: number): number {
  const spectrum = amplitudeSpectrum(samples, sampleRate, 'original');
  const bin = Math.round(frequency / spectrum.meta.binHz);
  let peak = 0;
  for (let k = Math.max(0, bin - 2); k <= bin + 2 && k < spectrum.amplitude.length; k++) {
    peak = Math.max(peak, spectrum.amplitude[k]);
  }
  return peak;
}

describe('remuestreo con filtro antialias (T-RES-01…03)', () => {
  it('conserva un tono de 1 kHz dentro de la banda de paso', () => {
    const output = resample(tone(INPUT_RATE, 1000, 0.5, 0.5), INPUT_RATE);
    expect(output.length).toBe(4_000);

    const middle = output.subarray(500, 3500);
    expect(peakNear(middle, OUTPUT_RATE, 1000)).toBeGreaterThan(0.45);
  });

  it('atenúa un tono de 5 kHz, por encima de la banda de rechazo', () => {
    const kept = resample(tone(INPUT_RATE, 1000, 0.5, 0.5), INPUT_RATE);
    const rejected = resample(tone(INPUT_RATE, 5000, 0.5, 0.5), INPUT_RATE);
    const keptPeak = peakNear(kept.subarray(500, 3500), OUTPUT_RATE, 1000);
    const folded = peakNear(rejected.subarray(500, 3500), OUTPUT_RATE, 3000);
    expect(folded).toBeLessThan(keptPeak * 0.01);
  });

  it('si las frecuencias coinciden devuelve una copia y no desplaza una constante', () => {
    const input = Float32Array.of(0.2, -0.4, 0.6);
    const copy = resample(input, OUTPUT_RATE, OUTPUT_RATE);
    expect(copy.length).toBe(input.length);
    for (let i = 0; i < input.length; i++) expect(copy[i]).toBeCloseTo(input[i], 6);
    expect(copy).not.toBe(input);
    const constant = resample(new Float32Array(INPUT_RATE).fill(0.25), INPUT_RATE);
    expect(constant[OUTPUT_RATE / 2]).toBeCloseTo(0.25, 3);
  });
});
