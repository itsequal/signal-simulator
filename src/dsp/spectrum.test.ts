import { describe, expect, it } from 'vitest';
import { fftInPlace } from './fft';
import {
  amplitudeSpectrum,
  amplitudeToDb,
  defaultTxRange,
  fftSizeFor,
  maxEnergyRange,
  visibleRange,
} from './spectrum';

const F = 48_000;

function tone(length: number, frequency: number, amplitude: number, sampleRate = F): Float64Array {
  const out = new Float64Array(length);
  for (let n = 0; n < length; n++) out[n] = amplitude * Math.cos((2 * Math.PI * frequency * n) / sampleRate);
  return out;
}

function naiveDft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      outRe[k] += re[t] * Math.cos(angle) - im[t] * Math.sin(angle);
      outIm[k] += re[t] * Math.sin(angle) + im[t] * Math.cos(angle);
    }
  }
  return { outRe, outIm };
}

function sixDbWidth(spectrum: ReturnType<typeof amplitudeSpectrum>): number {
  const a = spectrum.amplitude;
  let peak = 0;
  for (let k = 1; k < a.length; k++) if (a[k] > a[peak]) peak = k;
  const threshold = a[peak] / 2;
  let left = peak;
  while (left > 0 && a[left] >= threshold) left--;
  let right = peak;
  while (right < a.length - 1 && a[right] >= threshold) right++;
  const fLeft = left + (threshold - a[left]) / (a[left + 1] - a[left]);
  const fRight = right - (threshold - a[right]) / (a[right - 1] - a[right]);
  return (fRight - fLeft) * spectrum.meta.binHz;
}

describe('FFT radix-2 (T-FFT-00)', () => {
  it('coincide con la DFT directa y cumple Parseval', () => {
    let seed = 7;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32 - 0.5;
    };
    for (const n of [8, 16, 64, 256, 1024]) {
      const re = Float64Array.from({ length: n }, random);
      const im = Float64Array.from({ length: n }, random);
      const { outRe, outIm } = naiveDft(re, im);
      let energyTime = 0;
      for (let t = 0; t < n; t++) energyTime += re[t] * re[t] + im[t] * im[t];
      fftInPlace(re, im);
      let maxError = 0;
      let energyFreq = 0;
      for (let k = 0; k < n; k++) {
        maxError = Math.max(maxError, Math.abs(re[k] - outRe[k]), Math.abs(im[k] - outIm[k]));
        energyFreq += re[k] * re[k] + im[k] * im[k];
      }
      expect(maxError).toBeLessThan(1e-9 * n);
      expect(Math.abs(energyFreq / n - energyTime) / energyTime).toBeLessThan(1e-12);
    }
  });
});

describe('espectro unilateral de amplitud', () => {
  it('un tono en bin exacto da su amplitud; los vecinos, la mitad (T-FFT-01)', () => {
    const s = amplitudeSpectrum(tone(4096, 1500, 0.7), F, 'carrier');
    expect(s.meta.fftSize).toBe(4096);
    expect(s.amplitude[128]).toBeCloseTo(0.7, 6);
    expect(s.amplitude[127]).toBeCloseTo(0.35, 6);
    expect(s.amplitude[129]).toBeCloseTo(0.35, 6);
    for (let k = 0; k < s.amplitude.length; k++) {
      if (k < 127 || k > 129) expect(s.amplitude[k]).toBeLessThan(1e-6);
    }
  });

  it('conserva DC sin duplicarla (T-FFT-02)', () => {
    const exact = amplitudeSpectrum(new Float64Array(4096).fill(0.5), F, 'nrz');
    expect(exact.amplitude[0]).toBeCloseTo(0.5, 9);
    expect(exact.amplitude[1]).toBeCloseTo(0.5, 9);
    for (let k = 2; k < exact.amplitude.length; k++) expect(exact.amplitude[k]).toBeLessThan(1e-6);

    const padded = amplitudeSpectrum(new Float64Array(4800).fill(0.5), F, 'nrz');
    expect(padded.meta.fftSize).toBe(8192);
    expect(padded.amplitude[0]).toBeCloseTo(0.5, 9);
    for (let k = 0; k < padded.amplitude.length; k++) {
      if (k * padded.meta.binHz >= (10 * F) / 4800) expect(padded.amplitude[k]).toBeLessThan(5e-4);
    }
  });

  it('no duplica el bin de Nyquist (T-FFT-03)', () => {
    const x = Float64Array.from({ length: 4096 }, (_, n) => (n % 2 === 0 ? 0.3 : -0.3));
    expect(amplitudeSpectrum(x, F, 'carrier').amplitude[2048]).toBeCloseTo(0.3, 6);
  });

  it('el silencio no produce NaN ni infinitos (T-FFT-04, T-FFT-05)', () => {
    const s = amplitudeSpectrum(new Float32Array(480), F, 'modulated');
    expect(s.amplitude.every((v) => v === 0)).toBe(true);
    expect(amplitudeToDb(0)).toBe(-120);
    expect(amplitudeToDb(1)).toBe(0);
    expect(amplitudeToDb(0.001)).toBeCloseTo(-60, 9);
  });

  it('política de tamaño de FFT determinista (T-FFT-06)', () => {
    expect(fftSizeFor(48)).toBe(4096);
    expect(fftSizeFor(7680)).toBe(8192);
    expect(fftSizeFor(65_280)).toBe(65_536);
    expect(fftSizeFor(65_536)).toBe(65_536);
    expect(() => fftSizeFor(31)).toThrow(RangeError);
    expect(() => fftSizeFor(65_537)).toThrow(RangeError);
  });

  it('el relleno con ceros interpola pero no estrecha el lóbulo (T-FFT-07)', () => {
    const x = tone(4800, 1000, 0.5);
    const policy = amplitudeSpectrum(x, F, 'carrier');
    let peak = 0;
    for (let k = 1; k < policy.amplitude.length; k++) if (policy.amplitude[k] > policy.amplitude[peak]) peak = k;
    expect(Math.abs(peak * policy.meta.binHz - 1000)).toBeLessThanOrEqual(policy.meta.binHz / 2);
    expect(policy.amplitude[peak]).toBeGreaterThanOrEqual(0.97 * 0.5);

    const w16 = sixDbWidth(amplitudeSpectrum(x, F, 'carrier', 0, 16_384));
    const w64 = sixDbWidth(amplitudeSpectrum(x, F, 'carrier', 0, 65_536));
    expect(Math.abs(w16 - 20)).toBeLessThanOrEqual(2);
    expect(Math.abs(w64 - 20)).toBeLessThanOrEqual(2);
    expect(Math.abs(w16 - w64)).toBeLessThanOrEqual(1);
  });

  it('metadatos: espaciado de bins frente a resolución', () => {
    const s = amplitudeSpectrum(tone(7680, 1000, 1), F, 'carrier');
    expect(s.meta.binHz).toBeCloseTo(F / 8192, 9);
    expect(s.meta.resolutionHz).toBeCloseTo((1.44 * F) / 7680, 9);
    expect(s.meta.zeroPadFactor).toBeCloseTo(8192 / 7680, 9);
  });
});

describe('intervalo analizado (T-FFT-08, T-FFT-09)', () => {
  it('por defecto todo el bloque o un número entero de bits', () => {
    expect(defaultTxRange(7680, 480)).toEqual({ start: 0, length: 7680 });
    expect(defaultTxRange(122_880, 480)).toEqual({ start: 0, length: 65_280 });
    expect(defaultTxRange(1_228_800, 4800)).toEqual({ start: 0, length: 62_400 });
  });

  it('el intervalo visible se limita a 65 536 muestras y lo informa', () => {
    const visible = visibleRange(0, 2, F, 1_440_000);
    expect(visible.range).toEqual({ start: 0, length: 65_536 });
    expect(visible.clamped).toBe(true);
    expect(visibleRange(0.1, 0.2, F, 1_440_000)).toMatchObject({ range: { start: 4800, length: 4800 }, clamped: false });
  });

  it('la ventana de mayor energía del original encuentra el tono', () => {
    const samples = new Float32Array(F * 2.5);
    samples.set(Float32Array.from(tone(24_000, 440, 0.5)), 48_000);
    const range = maxEnergyRange(samples, 24_000, 1024);
    expect(range.length).toBe(24_000);
    expect(range.start).toBeGreaterThan(47_000);
    expect(range.start).toBeLessThan(49_000);
  });
});
