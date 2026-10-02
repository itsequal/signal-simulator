import type { U8 } from '../domain/types';

export interface QuantizedSample {

  q: number;
  clipped: boolean;
  nonFinite: boolean;
}

export function quantizeSample(x: number): QuantizedSample {
  if (!Number.isFinite(x)) return { q: 128, clipped: false, nonFinite: true };
  const clipped = x < -1 || x > 1;
  const limited = Math.min(1, Math.max(-1, x));
  const q = Math.min(255, Math.max(0, Math.floor(128 * (limited + 1))));
  return { q, clipped, nonFinite: false };
}

export interface QuantizedPcm {
  bytes: U8;

  reconstructed: Float32Array<ArrayBuffer>;
  clippedCount: number;
  nonFiniteCount: number;
}

export function quantizePcm(samples: ArrayLike<number>): QuantizedPcm {
  const bytes = new Uint8Array(samples.length);
  const reconstructed = new Float32Array(samples.length);
  let clippedCount = 0;
  let nonFiniteCount = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = quantizeSample(samples[i]);
    bytes[i] = sample.q;
    reconstructed[i] = sample.q / 128 - 1;
    if (sample.clipped) clippedCount++;
    if (sample.nonFinite) nonFiniteCount++;
  }
  return { bytes, reconstructed, clippedCount, nonFiniteCount };
}
