import { describe, expect, it } from 'vitest';
import { quantizePcm, quantizeSample } from './pcm';

describe('cuantización PCM de 8 bits (T-PCM-01…03)', () => {
  it('−1, 0 y +1 dan 0, 128 y 255', () => {
    expect(quantizeSample(-1).q).toBe(0);
    expect(quantizeSample(0).q).toBe(128);
    expect(quantizeSample(1).q).toBe(255);
  });

  it('recorta lo que queda fuera de [−1, 1] y lo cuenta', () => {
    expect(quantizeSample(-1.5)).toMatchObject({ q: 0, clipped: true });
    expect(quantizeSample(2)).toMatchObject({ q: 255, clipped: true });
    const block = quantizePcm(Float32Array.of(-2, 0, 3));
    expect(Array.from(block.bytes)).toEqual([0, 128, 255]);
    expect(block.clippedCount).toBe(2);
  });

  it('un valor no finito se sustituye por silencio y se cuenta', () => {
    const sample = quantizeSample(Number.NaN);
    expect(sample).toMatchObject({ q: 128, nonFinite: true, clipped: false });
    expect(quantizePcm(Float32Array.of(Number.POSITIVE_INFINITY, 0)).nonFiniteCount).toBe(1);
  });
});
