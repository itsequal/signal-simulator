import { FFT_POLICY } from '../config/constants';
import type { SampleRange, SignalKind, SimulationBuffers, Spectrum, TxSpectra } from '../domain/types';
import { fftInPlace } from './fft';

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function fftSizeFor(length: number): number {
  if (!Number.isInteger(length) || length < FFT_POLICY.minLength) {
    throw new RangeError(`Intervalo demasiado corto para el espectro: ${length} muestras (mínimo ${FFT_POLICY.minLength})`);
  }
  if (length > FFT_POLICY.maxLength) {
    throw new RangeError(`Intervalo demasiado largo: ${length} muestras (máximo ${FFT_POLICY.maxLength})`);
  }
  return Math.min(FFT_POLICY.maxSize, Math.max(FFT_POLICY.minSize, nextPow2(length)));
}

const windowCache = new Map<number, { window: Float64Array; sum: number }>();

export function hannPeriodic(length: number): { window: Float64Array; sum: number } {
  let entry = windowCache.get(length);
  if (entry) return entry;
  const window = new Float64Array(length);
  let sum = 0;
  for (let n = 0; n < length; n++) {
    window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / length);
    sum += window[n];
  }
  entry = { window, sum };
  if (windowCache.size > 6) windowCache.clear();
  windowCache.set(length, entry);
  return entry;
}

export function amplitudeSpectrum(
  samples: ArrayLike<number>,
  sampleRate: number,
  signal: SignalKind,
  rangeStart = 0,
  fftSizeOverride?: number,
): Spectrum {
  const length = samples.length;
  const fftSize = fftSizeOverride ?? fftSizeFor(length);
  if (fftSize < length) throw new RangeError('N_FFT no puede ser menor que la longitud observada');
  const { window, sum } = hannPeriodic(length);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  for (let n = 0; n < length; n++) re[n] = window[n] * samples[n];
  fftInPlace(re, im);
  const bins = fftSize / 2 + 1;
  const amplitude = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    const factor = k === 0 || k === fftSize / 2 ? 1 : 2;
    amplitude[k] = (factor * Math.sqrt(re[k] * re[k] + im[k] * im[k])) / sum;
  }
  return {
    meta: {
      signal,
      sampleRate,
      range: { start: rangeStart, length },
      window: 'hann-periodic',
      windowSum: sum,
      fftSize,
      binHz: sampleRate / fftSize,
      resolutionHz: (1.44 * sampleRate) / length,
      zeroPadFactor: fftSize / length,
    },
    amplitude,
  };
}

export function amplitudeToDb(amplitude: number): number {
  return 20 * Math.log10(Math.max(amplitude, FFT_POLICY.dbFloorAmplitude));
}

export function defaultTxRange(sampleCount: number, samplesPerBit: number): SampleRange {
  if (sampleCount <= FFT_POLICY.maxLength) return { start: 0, length: sampleCount };
  const bits = Math.max(1, Math.floor(FFT_POLICY.maxLength / samplesPerBit));
  return { start: 0, length: Math.min(sampleCount, bits * samplesPerBit) };
}

export function visibleRange(
  t0: number,
  t1: number,
  sampleRate: number,
  sampleCount: number,
): { range: SampleRange; clamped: boolean; visibleLength: number } {
  const start = Math.min(Math.max(0, Math.round(t0 * sampleRate)), Math.max(0, sampleCount - 1));
  const end = Math.min(sampleCount, Math.max(start, Math.round(t1 * sampleRate)));
  const visibleLength = end - start;
  const length = Math.min(visibleLength, FFT_POLICY.maxLength);
  return { range: { start, length }, clamped: length < visibleLength, visibleLength };
}

export function maxEnergyRange(samples: Float32Array, maxLength: number = FFT_POLICY.maxLength, hop: number = FFT_POLICY.originalHop): SampleRange {
  const length = Math.min(samples.length, maxLength);
  if (length === samples.length) return { start: 0, length };
  const prefix = new Float64Array(samples.length + 1);
  for (let i = 0; i < samples.length; i++) prefix[i + 1] = prefix[i] + samples[i] * samples[i];
  let bestStart = 0;
  let bestEnergy = -1;
  for (let start = 0; start + length <= samples.length; start += hop) {
    const energy = prefix[start + length] - prefix[start];
    if (energy > bestEnergy + 1e-12) {
      bestEnergy = energy;
      bestStart = start;
    }
  }
  return { start: bestStart, length };
}

export function computeTxSpectra(buffers: SimulationBuffers, range: SampleRange, sampleRate: number): TxSpectra | null {
  if (range.length < FFT_POLICY.minLength) return null;
  const end = range.start + range.length;
  return {
    range,
    nrz: amplitudeSpectrum(buffers.nrz.subarray(range.start, end), sampleRate, 'nrz', range.start),
    carrier: amplitudeSpectrum(buffers.carrier.subarray(range.start, end), sampleRate, 'carrier', range.start),
    modulated: amplitudeSpectrum(buffers.modulated.subarray(range.start, end), sampleRate, 'modulated', range.start),
  };
}
