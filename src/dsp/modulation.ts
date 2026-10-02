import { SIM_SAMPLE_RATE } from '../config/constants';
import type { F32, SimulationBuffers, SimulationConfig, ToneSet, U8 } from '../domain/types';

const TWO_PI = 2 * Math.PI;

export function samplesPerBit(bitRate: number, sampleRate: number = SIM_SAMPLE_RATE): number {
  const value = sampleRate / bitRate;
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`F_sim / R_b = ${value} no es un número entero positivo de muestras por bit`);
  }
  return value;
}

export function sampleCountFor(bitCount: number, bitRate: number, sampleRate: number = SIM_SAMPLE_RATE): number {
  return bitCount * samplesPerBit(bitRate, sampleRate);
}

export function durationFor(bitCount: number, bitRate: number): number {
  return bitCount / bitRate;
}

export function tonesFor(config: SimulationConfig): ToneSet {
  const { carrierHz, deltaHz } = config.params;
  if (config.modulation === 'fsk') return { carrierHz, f0Hz: carrierHz - deltaHz, f1Hz: carrierHz + deltaHz };
  return { carrierHz };
}

export function generateNrz(bits: Uint8Array, spb: number): F32 {
  const out = new Float32Array(bits.length * spb);
  for (let k = 0; k < bits.length; k++) {
    if (bits[k]) out.fill(1, k * spb, (k + 1) * spb);
  }
  return out;
}

export function generateCarrier(length: number, carrierHz: number, sampleRate: number = SIM_SAMPLE_RATE): F32 {
  const out = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const turns = (carrierHz * n) / sampleRate;
    out[n] = Math.cos(TWO_PI * (turns - Math.floor(turns)));
  }
  return out;
}

export function generateAsk(bits: Uint8Array, spb: number, carrier: F32, a0: number, a1: number): F32 {
  const out = new Float32Array(carrier.length);
  for (let k = 0; k < bits.length; k++) {
    const amplitude = bits[k] ? a1 : a0;
    for (let n = k * spb, end = n + spb; n < end; n++) out[n] = amplitude * carrier[n];
  }
  return out;
}

export function generateOok(bits: Uint8Array, spb: number, carrier: F32): F32 {
  const out = new Float32Array(carrier.length);
  for (let k = 0; k < bits.length; k++) {
    if (bits[k]) out.set(carrier.subarray(k * spb, (k + 1) * spb), k * spb);
  }
  return out;
}

export function generateBpsk(bits: Uint8Array, spb: number, carrier: F32): F32 {
  const out = new Float32Array(carrier.length);
  for (let k = 0; k < bits.length; k++) {
    const start = k * spb;
    if (bits[k]) {
      for (let n = start, end = start + spb; n < end; n++) out[n] = -carrier[n];
    } else {
      out.set(carrier.subarray(start, start + spb), start);
    }
  }
  return out;
}

export function generateFsk(bits: Uint8Array, spb: number, f0: number, f1: number, sampleRate: number = SIM_SAMPLE_RATE): F32 {
  const out = new Float32Array(bits.length * spb);
  const inc0 = f0 / sampleRate;
  const inc1 = f1 / sampleRate;
  let phase = 0;
  let n = 0;
  for (let k = 0; k < bits.length; k++) {
    const increment = bits[k] ? inc1 : inc0;
    for (let j = 0; j < spb; j++) {
      out[n++] = Math.cos(TWO_PI * phase);
      phase += increment;
      phase -= Math.floor(phase);
    }
  }
  return out;
}

export function generateSignals(bits: U8, config: SimulationConfig): SimulationBuffers {
  const { modulation, params, sampleRate } = config;
  const spb = samplesPerBit(params.bitRate, sampleRate);
  const nrz = generateNrz(bits, spb);
  const carrier = generateCarrier(bits.length * spb, params.carrierHz, sampleRate);
  let modulated: F32;
  switch (modulation) {
    case 'ask':
      modulated = generateAsk(bits, spb, carrier, params.a0, params.a1);
      break;
    case 'ook':
      modulated = generateOok(bits, spb, carrier);
      break;
    case 'bpsk':
      modulated = generateBpsk(bits, spb, carrier);
      break;
    case 'fsk':
      modulated = generateFsk(bits, spb, params.carrierHz - params.deltaHz, params.carrierHz + params.deltaHz, sampleRate);
      break;
  }
  return { bits, nrz, carrier, modulated };
}
