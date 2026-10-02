import type {
  F32,
  ResamplerInfo,
  SignalKind,
  SimulationBuffers,
  SimulationConfig,
  Spectrum,
  ToneSet,
  TxSpectra,
  U8,
} from '../domain/types';

export type WorkerRequest =
  | { type: 'ping'; jobId: number; payload: F32 }
  | { type: 'pcm'; jobId: number; samples: F32; sampleRate: number }
  | { type: 'simulate'; jobId: number; bits: U8; config: SimulationConfig }
  | {
      type: 'spectrum';
      jobId: number;
      sampleRate: number;

      rangeStart: number;
      signals: Array<{ kind: SignalKind; samples: F32 }>;
    };

export type WorkerRequestType = WorkerRequest['type'];

export interface PcmDone {
  type: 'pcm-done';
  jobId: number;
  pcmFloat: F32;
  pcmBytes: U8;
  bits: U8;
  clippedCount: number;
  nonFiniteCount: number;
  resampler: ResamplerInfo;
  originalSpectrum: Spectrum | null;
}

export interface SimulateDone {
  type: 'simulate-done';
  jobId: number;
  buffers: SimulationBuffers;
  spectra: TxSpectra | null;
  samplesPerBit: number;
  sampleCount: number;
  durationS: number;
  tones: ToneSet;
}

export interface SpectrumDone {
  type: 'spectrum-done';
  jobId: number;
  spectra: Spectrum[];
}

export type WorkerResponse =
  | { type: 'pong'; jobId: number; payload: F32 }
  | PcmDone
  | SimulateDone
  | SpectrumDone
  | { type: 'error'; jobId: number; code: string; message: string };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type WorkerRequestInput = DistributiveOmit<WorkerRequest, 'jobId'>;

export function requestTransferList(request: WorkerRequest): ArrayBuffer[] {
  switch (request.type) {
    case 'ping':
      return [request.payload.buffer];
    case 'pcm':
      return [request.samples.buffer];
    case 'simulate':
      return [request.bits.buffer];
    case 'spectrum':
      return request.signals.map((signal) => signal.samples.buffer);
  }
}

export function responseTransferList(response: WorkerResponse): ArrayBuffer[] {
  switch (response.type) {
    case 'pong':
      return [response.payload.buffer];
    case 'pcm-done': {
      const list = [response.pcmFloat.buffer, response.pcmBytes.buffer, response.bits.buffer];
      if (response.originalSpectrum) list.push(response.originalSpectrum.amplitude.buffer);
      return list;
    }
    case 'simulate-done': {
      const { bits, nrz, carrier, modulated } = response.buffers;
      const list = [bits.buffer, nrz.buffer, carrier.buffer, modulated.buffer];
      if (response.spectra) {
        list.push(
          response.spectra.nrz.amplitude.buffer,
          response.spectra.carrier.amplitude.buffer,
          response.spectra.modulated.amplitude.buffer,
        );
      }
      return list;
    }
    case 'spectrum-done':
      return response.spectra.map((spectrum) => spectrum.amplitude.buffer);
    case 'error':
      return [];
  }
}
