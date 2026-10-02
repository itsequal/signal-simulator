import { PCM, RESAMPLER } from '../config/constants';
import type { F32, ResamplerInfo } from '../domain/types';

function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const half = x / 2;
  for (let k = 1; k < 32; k++) {
    term *= (half * half) / (k * k);
    sum += term;
    if (term < sum * 1e-12) break;
  }
  return sum;
}

export function kaiserBeta(attenuationDb: number): number {
  if (attenuationDb > 50) return 0.1102 * (attenuationDb - 8.7);
  if (attenuationDb >= 21) return 0.5842 * Math.pow(attenuationDb - 21, 0.4) + 0.07886 * (attenuationDb - 21);
  return 0;
}

export interface ResamplerDesign extends ResamplerInfo {
  i0Beta: number;
}

export function designResampler(inputRate: number, outputRate: number = PCM.sampleRate): ResamplerDesign {
  const beta = kaiserBeta(RESAMPLER.attenuationDb);
  const transitionHz = RESAMPLER.stopbandHz - RESAMPLER.passbandHz;
  const deltaOmega = (2 * Math.PI * transitionHz) / inputRate;
  const order = Math.ceil((RESAMPLER.attenuationDb - 8) / (2.285 * deltaOmega));
  return {
    method: 'kaiser-windowed-sinc',
    inputRate,
    outputRate,
    passbandHz: RESAMPLER.passbandHz,
    stopbandHz: RESAMPLER.stopbandHz,
    cutoffHz: RESAMPLER.cutoffHz,
    attenuationDb: RESAMPLER.attenuationDb,
    beta,
    halfLength: Math.ceil(order / 2),
    tableOversampling: RESAMPLER.tableOversampling,
    delaySamples: 0,
    edges: 'zero-extension',
    i0Beta: besselI0(beta),
  };
}

export function kernelAt(offset: number, design: ResamplerDesign): number {
  const distance = Math.abs(offset);
  if (distance > design.halfLength) return 0;
  const x = distance / design.halfLength;
  const window = x >= 1 ? 0 : besselI0(design.beta * Math.sqrt(1 - x * x)) / design.i0Beta;
  const cycles = (design.cutoffHz / design.inputRate) * offset;
  const sinc = offset === 0 ? (2 * design.cutoffHz) / design.inputRate : Math.sin(2 * Math.PI * cycles) / (Math.PI * offset);
  return sinc * window;
}

export function resample(input: ArrayLike<number>, inputRate: number, outputRate: number = PCM.sampleRate): F32 {
  if (!(inputRate > 0) || !(outputRate > 0)) throw new RangeError('Frecuencia de muestreo no válida');
  if (Math.abs(inputRate - outputRate) < 0.5) return Float32Array.from(input);
  const design = designResampler(inputRate, outputRate);
  const length = Math.max(0, Math.round((input.length * outputRate) / inputRate));
  const out = new Float32Array(length);
  const ratio = inputRate / outputRate;
  const radius = design.halfLength;
  for (let n = 0; n < length; n++) {
    const position = n * ratio;
    const first = Math.ceil(position - radius);
    const last = Math.floor(position + radius);
    let sum = 0;
    for (let k = first; k <= last; k++) {
      const sample = k >= 0 && k < input.length ? input[k] : 0;
      sum += sample * kernelAt(k - position, design);
    }
    out[n] = sum;
  }
  return out;
}
