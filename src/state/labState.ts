import { DEFAULTS, type SourceKind } from '../config/constants';
import type { AppError } from '../domain/errors';
import type {
  AudioCtxStatus,
  FreqRange,
  MicStatus,
  ModulationKind,
  PcmMeta,
  PlaybackTarget,
  RecordingMeta,
  SampleRange,
  SimulationMeta,
  SpectrumMeta,
  TimeRange,
} from '../domain/types';
import { defaultRawParams, type RawParams } from '../validation/params';
import type { WorkerMode } from '../workers/dspClient';

export interface StoredSelection {
  sourceId: string;
  start: number;
  length: number;
}

export interface Notice {
  id: number;
  tone: 'info' | 'warning' | 'error';
  text: string;
}

export interface MicState {
  status: MicStatus;
  error: AppError | null;
  notice: string | null;
  recording: RecordingMeta | null;
  pcm: PcmMeta | null;
  sourceId: string | null;
  originalSpectrum: SpectrumMeta | null;
}

export interface ResultState {
  status: 'idle' | 'pending' | 'computing' | 'error';
  meta: SimulationMeta | null;
  error: AppError | null;
  requestedKey: string | null;
}

export interface Keyed<T> {
  value: T;

  forKey: string;
}

export interface CustomSpectrum {
  ownerId: string;
  key: string;
  range: SampleRange;

  clampedFrom: number | null;
}

export type SpectrumScale = 'linear' | 'db';
export type Domain = 'time' | 'frequency';

export interface ViewState {
  timeView: Keyed<TimeRange> | null;
  freqView: Keyed<FreqRange> | null;
  originalTimeView: Keyed<TimeRange> | null;
  txSpectrum: CustomSpectrum | null;
  originalSpectrum: CustomSpectrum | null;
  domain: Domain;
  txScale: SpectrumScale;
  originalScale: SpectrumScale;
  showBpskReference: boolean;
  followPlayhead: boolean;
}

export interface PlaybackState {
  playing: PlaybackTarget | null;
  volumes: Record<PlaybackTarget, number>;
  error: AppError | null;
}

export interface LabState {
  sourceKind: SourceKind;
  binaryRaw: string;
  textRaw: string;
  selections: Record<SourceKind, StoredSelection | null>;
  selectionNotice: string | null;
  modulation: ModulationKind;
  params: RawParams;
  mic: MicState;
  result: ResultState;
  view: ViewState;
  playback: PlaybackState;
  audioContext: AudioCtxStatus;
  workerMode: WorkerMode;
  notices: Notice[];
  nextNoticeId: number;
}

export function createInitialState(): LabState {
  return {
    sourceKind: 'binary',
    binaryRaw: DEFAULTS.binaryInput,
    textRaw: DEFAULTS.textInput,
    selections: { binary: null, text: null, microphone: null },
    selectionNotice: null,
    modulation: DEFAULTS.modulation,
    params: defaultRawParams(),
    mic: {
      status: 'idle',
      error: null,
      notice: null,
      recording: null,
      pcm: null,
      sourceId: null,
      originalSpectrum: null,
    },
    result: { status: 'idle', meta: null, error: null, requestedKey: null },
    view: {
      timeView: null,
      freqView: null,
      originalTimeView: null,
      txSpectrum: null,
      originalSpectrum: null,
      domain: 'time',
      txScale: 'linear',
      originalScale: 'db',
      showBpskReference: true,
      followPlayhead: false,
    },
    playback: {
      playing: null,
      volumes: { original: DEFAULTS.volume, carrier: DEFAULTS.volume, modulated: DEFAULTS.volume },
      error: null,
    },
    audioContext: 'uninitialized',
    workerMode: 'starting',
    notices: [],
    nextNoticeId: 1,
  };
}
