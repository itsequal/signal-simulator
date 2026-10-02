import { FFT_POLICY, LIMITS, PCM } from '../config/constants';
import { generateSignals, samplesPerBit, tonesFor } from '../dsp/modulation';
import { quantizePcm } from '../dsp/pcm';
import { designResampler, resample } from '../dsp/resample';
import { amplitudeSpectrum, computeTxSpectra, defaultTxRange, maxEnergyRange } from '../dsp/spectrum';
import { bytesToBitsMsbFirst } from '../sources/bytes';
import { responseTransferList, type WorkerRequest, type WorkerResponse } from './protocol';

export interface HandledRequest {
  response: WorkerResponse;
  transfer: ArrayBuffer[];
}

export class DspError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DspError';
    this.code = code;
  }
}

export function handleRequest(request: WorkerRequest): HandledRequest {
  let response: WorkerResponse;
  try {
    response = dispatch(request);
  } catch (error) {
    const code = error instanceof DspError ? error.code : 'E-DSP';
    const message = error instanceof Error ? error.message : String(error);
    response = { type: 'error', jobId: request.jobId, code, message };
  }
  return { response, transfer: responseTransferList(response) };
}

function dispatch(request: WorkerRequest): WorkerResponse {
  switch (request.type) {
    case 'ping':
      return { type: 'pong', jobId: request.jobId, payload: request.payload };
    case 'simulate': {
      const { bits, config } = request;
      const durationS = bits.length / config.params.bitRate;
      if (bits.length === 0) throw new DspError('E-DSP', 'No hay bits que simular');

      if (durationS > LIMITS.maxSimSeconds + 1e-9) {
        throw new DspError('E-DSP', `Duración ${durationS} s por encima del máximo de ${LIMITS.maxSimSeconds} s`);
      }
      const spb = samplesPerBit(config.params.bitRate, config.sampleRate);
      const buffers = generateSignals(bits, config);
      const spectra = computeTxSpectra(buffers, defaultTxRange(buffers.modulated.length, spb), config.sampleRate);
      return {
        type: 'simulate-done',
        jobId: request.jobId,
        buffers,
        spectra,
        samplesPerBit: spb,
        sampleCount: buffers.modulated.length,
        durationS,
        tones: tonesFor(config),
      };
    }
    case 'pcm': {
      const { samples, sampleRate } = request;
      const sameRate = Math.abs(sampleRate - PCM.sampleRate) < 0.5;
      const pcmFloat = sameRate ? Float32Array.from(samples) : resample(samples, sampleRate, PCM.sampleRate);
      const quantized = quantizePcm(pcmFloat);
      const design = designResampler(sampleRate, PCM.sampleRate);
      const { i0Beta: _unused, ...resampler } = design;
      void _unused;
      let originalSpectrum = null;
      if (samples.length >= FFT_POLICY.minLength) {
        const range = maxEnergyRange(samples instanceof Float32Array ? samples : Float32Array.from(samples));
        originalSpectrum = amplitudeSpectrum(samples.subarray(range.start, range.start + range.length), sampleRate, 'original', range.start);
      }
      return {
        type: 'pcm-done',
        jobId: request.jobId,
        pcmFloat,
        pcmBytes: quantized.bytes,
        bits: bytesToBitsMsbFirst(quantized.bytes),
        clippedCount: quantized.clippedCount,
        nonFiniteCount: quantized.nonFiniteCount,
        resampler,
        originalSpectrum,
      };
    }
    case 'spectrum':
      return {
        type: 'spectrum-done',
        jobId: request.jobId,
        spectra: request.signals.map(({ kind, samples }) =>
          amplitudeSpectrum(samples, request.sampleRate, kind, request.rangeStart),
        ),
      };
  }
}
