import type { BitRate, ModulationKind, SourceKind } from '../config/constants';

export type { BitRate, ModulationKind, SourceKind };

export type F32 = Float32Array<ArrayBuffer>;
export type U8 = Uint8Array<ArrayBuffer>;

export type TxSignalKind = 'nrz' | 'carrier' | 'modulated';
export type SignalKind = TxSignalKind | 'original';
export type PlaybackTarget = 'original' | 'carrier' | 'modulated';

export interface BitSelection {
  start: number;
  length: number;
}

export interface SampleRange {
  start: number;
  length: number;
}

export interface TimeRange {
  t0: number;
  t1: number;
}

export interface FreqRange {
  f0: number;
  f1: number;
}

export type Severity = 'error' | 'warning' | 'info';
export type IssueField =
  | 'input'
  | 'selection'
  | 'carrierHz'
  | 'bitRate'
  | 'deltaHz'
  | 'a0'
  | 'a1'
  | 'duration'
  | 'tones';

export interface ValidationIssue {
  code: string;
  severity: Severity;
  field: IssueField;

  message: string;
}

export interface ModulationParams {
  carrierHz: number;
  bitRate: BitRate;
  deltaHz: number;
  a0: number;
  a1: number;
}

export interface SimulationConfig {
  modulation: ModulationKind;
  params: ModulationParams;
  sampleRate: number;
}

export interface ToneSet {
  carrierHz: number;
  f0Hz?: number;
  f1Hz?: number;
}

export interface SimulationMeta {
  resultId: string;
  configKey: string;
  jobId: number;
  sourceId: string;
  sourceKind: SourceKind;
  selection: BitSelection;
  totalBits: number;
  config: SimulationConfig;
  samplesPerBit: number;
  sampleCount: number;
  durationS: number;
  tones: ToneSet;
}

export interface SimulationBuffers {
  bits: U8;
  nrz: F32;
  carrier: F32;
  modulated: F32;
}

export interface SpectrumMeta {
  signal: SignalKind;
  sampleRate: number;
  range: SampleRange;
  window: 'hann-periodic';
  windowSum: number;
  fftSize: number;
  binHz: number;
  resolutionHz: number;
  zeroPadFactor: number;
}

export interface Spectrum {
  meta: SpectrumMeta;
  amplitude: F32;
}

export interface TxSpectra {
  range: SampleRange;
  nrz: Spectrum;
  carrier: Spectrum;
  modulated: Spectrum;
}

export interface AudioProcessingFlags {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface EffectiveAudioSettings {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: number;
}

export type RecordingEnd = 'user' | 'limit' | 'interrupted';

export interface RecordingMeta {
  id: string;
  sampleRate: number;
  frameCount: number;
  durationS: number;
  channelCountReceived: number;
  downmix: 'average';
  requested: AudioProcessingFlags;
  effective: EffectiveAudioSettings;
  deviceLabel: string | null;
  endedBy: RecordingEnd;
  peak: number;
}

export interface ResamplerInfo {
  method: 'kaiser-windowed-sinc';
  inputRate: number;
  outputRate: number;
  passbandHz: number;
  stopbandHz: number;
  cutoffHz: number;
  attenuationDb: number;
  beta: number;
  halfLength: number;
  tableOversampling: number;
  delaySamples: 0;
  edges: 'zero-extension';
}

export interface PcmMeta {
  sampleRate: number;
  bitsPerSample: number;
  encoding: 'u8-floor-offset128';
  sampleCount: number;
  clippedCount: number;
  nonFiniteCount: number;
  resampler: ResamplerInfo;
}

export type MicStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'processing' | 'ready' | 'error';
export type AudioCtxStatus = 'uninitialized' | 'suspended' | 'running' | 'interrupted' | 'closed';
