import { VIEW } from '../config/constants';

export interface Series {
  x: Float64Array;
  y: Float32Array;

  mode: 'raw' | 'envelope';

  markers: boolean;
}

export function decimateMinMax(
  samples: ArrayLike<number>,
  sampleRate: number,
  t0: number,
  t1: number,
  widthPx: number,
  xScale = 1000,
): Series {
  const total = samples.length;
  const n0 = Math.min(total, Math.max(0, Math.floor(t0 * sampleRate)));
  const n1 = Math.min(total, Math.max(n0, Math.ceil(t1 * sampleRate) + 1));
  const count = n1 - n0;
  const width = Math.max(1, Math.floor(widthPx));

  if (count <= VIEW.rawSamplesPerPx * width) {
    const x = new Float64Array(count);
    const y = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      x[i] = ((n0 + i) / sampleRate) * xScale;
      y[i] = samples[n0 + i];
    }
    return { x, y, mode: 'raw', markers: count > 0 && width / count >= VIEW.markersMinPxPerSample };
  }

  const x = new Float64Array(width * 2);
  const y = new Float32Array(width * 2);
  let out = 0;
  for (let column = 0; column < width; column++) {
    const a = n0 + Math.floor((column * count) / width);
    const b = n0 + Math.floor(((column + 1) * count) / width);
    if (b <= a) continue;
    let min = Infinity;
    let max = -Infinity;
    let iMin = a;
    let iMax = a;
    for (let i = a; i < b; i++) {
      const v = samples[i];
      if (v < min) {
        min = v;
        iMin = i;
      }
      if (v > max) {
        max = v;
        iMax = i;
      }
    }
    const first = iMin <= iMax ? iMin : iMax;
    const second = iMin <= iMax ? iMax : iMin;
    x[out] = (first / sampleRate) * xScale;
    y[out++] = samples[first];
    x[out] = (second / sampleRate) * xScale;
    y[out++] = samples[second];
  }
  return { x: x.slice(0, out), y: y.slice(0, out), mode: 'envelope', markers: false };
}

export function decimateSpectrum(
  amplitude: ArrayLike<number>,
  binHz: number,
  f0: number,
  f1: number,
  widthPx: number,
  transform: (value: number) => number = (value) => value,
): Series {
  const last = amplitude.length - 1;
  const k0 = Math.min(last, Math.max(0, Math.floor(f0 / binHz)));
  const k1 = Math.min(last, Math.max(k0, Math.ceil(f1 / binHz)));
  const count = k1 - k0 + 1;
  const width = Math.max(1, Math.floor(widthPx));
  if (count <= VIEW.rawSamplesPerPx * width) {
    const x = new Float64Array(count);
    const y = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      x[i] = (k0 + i) * binHz;
      y[i] = transform(amplitude[k0 + i]);
    }
    return { x, y, mode: 'raw', markers: false };
  }
  const x = new Float64Array(width);
  const y = new Float32Array(width);
  let out = 0;
  for (let column = 0; column < width; column++) {
    const a = k0 + Math.floor((column * count) / width);
    const b = k0 + Math.floor(((column + 1) * count) / width);
    if (b <= a) continue;
    let best = a;
    for (let k = a + 1; k < b; k++) if (amplitude[k] > amplitude[best]) best = k;
    x[out] = best * binHz;
    y[out++] = transform(amplitude[best]);
  }
  return { x: x.slice(0, out), y: y.slice(0, out), mode: 'envelope', markers: false };
}
