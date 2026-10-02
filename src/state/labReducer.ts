import type { BitRate, SourceKind } from '../config/constants';
import type { AppError } from '../domain/errors';
import type {
  AudioCtxStatus,
  FreqRange,
  MicStatus,
  ModulationKind,
  PcmMeta,
  PlaybackTarget,
  RecordingMeta,
  SimulationMeta,
  SpectrumMeta,
  TimeRange,
} from '../domain/types';
import { defaultRawParams, type RawParams } from '../validation/params';
import type { WorkerMode } from '../workers/dspClient';
import type { CustomSpectrum, Domain, LabState, Notice, SpectrumScale, StoredSelection } from './labState';

export type LabAction =
  | { type: 'source/kind'; kind: SourceKind }
  | { type: 'input/binary'; raw: string }
  | { type: 'input/text'; raw: string }
  | { type: 'selection/set'; kind: SourceKind; selection: StoredSelection; notice?: string | null }
  | { type: 'modulation/set'; modulation: ModulationKind }
  | { type: 'params/set'; field: 'carrierHz' | 'deltaHz' | 'a0' | 'a1'; value: string }
  | { type: 'params/bitRate'; value: BitRate }
  | { type: 'params/reset' }
  | { type: 'sim/pending'; key: string }
  | { type: 'sim/computing'; key: string }
  | { type: 'sim/done'; meta: SimulationMeta }
  | { type: 'sim/failed'; key: string; error: AppError }
  | { type: 'mic/status'; status: MicStatus }
  | { type: 'mic/error'; error: AppError }
  | { type: 'mic/cancelled' }
  | { type: 'mic/recorded'; recording: RecordingMeta; notice: string | null }
  | { type: 'mic/pcm'; recordingId: string; sourceId: string; pcm: PcmMeta; originalSpectrum: SpectrumMeta | null }
  | { type: 'view/time'; value: TimeRange; forKey: string }
  | { type: 'view/freq'; value: FreqRange; forKey: string }
  | { type: 'view/originalTime'; value: TimeRange; forKey: string }
  | { type: 'view/txSpectrum'; value: CustomSpectrum | null }
  | { type: 'view/originalSpectrum'; value: CustomSpectrum | null }
  | { type: 'view/domain'; domain: Domain }
  | { type: 'view/txScale'; scale: SpectrumScale }
  | { type: 'view/originalScale'; scale: SpectrumScale }
  | { type: 'view/bpskReference'; value: boolean }
  | { type: 'view/follow'; value: boolean }
  | { type: 'playback/state'; playing: PlaybackTarget | null; error: AppError | null }
  | { type: 'playback/volume'; target: PlaybackTarget; volume: number }
  | { type: 'playback/error'; error: AppError | null }
  | { type: 'audio/context'; state: AudioCtxStatus }
  | { type: 'engine/worker'; mode: WorkerMode }
  | { type: 'notice/add'; tone: Notice['tone']; text: string }
  | { type: 'notice/dismiss'; id: number };

function withParams(state: LabState, params: RawParams): LabState {
  return { ...state, params };
}

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'source/kind':
      return state.sourceKind === action.kind ? state : { ...state, sourceKind: action.kind, selectionNotice: null };
    case 'input/binary':
      return { ...state, binaryRaw: action.raw, selectionNotice: null };
    case 'input/text':
      return { ...state, textRaw: action.raw, selectionNotice: null };
    case 'selection/set':
      return {
        ...state,
        selections: { ...state.selections, [action.kind]: action.selection },
        selectionNotice: action.notice ?? null,
      };
    case 'modulation/set':
      return state.modulation === action.modulation ? state : { ...state, modulation: action.modulation };
    case 'params/set':
      return withParams(state, { ...state.params, [action.field]: action.value });
    case 'params/bitRate':
      return withParams(state, { ...state.params, bitRate: action.value });
    case 'params/reset':
      return withParams(state, defaultRawParams());
    case 'sim/pending':
      return { ...state, result: { ...state.result, status: 'pending', requestedKey: action.key, error: null } };
    case 'sim/computing':
      return { ...state, result: { ...state.result, status: 'computing', requestedKey: action.key, error: null } };
    case 'sim/done':
      return { ...state, result: { status: 'idle', meta: action.meta, error: null, requestedKey: null } };
    case 'sim/failed':
      return state.result.requestedKey !== action.key
        ? state
        : { ...state, result: { ...state.result, status: 'error', error: action.error, requestedKey: null } };
    case 'mic/status':
      return { ...state, mic: { ...state.mic, status: action.status, error: action.status === 'requesting' ? null : state.mic.error } };
    case 'mic/error':
      return {
        ...state,
        mic: { ...state.mic, status: 'error', error: action.error, notice: null },
      };
    case 'mic/cancelled':
      return { ...state, mic: { ...state.mic, status: state.mic.sourceId ? 'ready' : 'idle', error: null } };
    case 'mic/recorded':
      return {
        ...state,
        mic: {
          ...state.mic,
          status: 'processing',
          error: null,
          notice: action.notice,
          recording: action.recording,
          pcm: null,
          sourceId: null,
          originalSpectrum: null,
        },
        view: { ...state.view, originalTimeView: null, originalSpectrum: null },
      };
    case 'mic/pcm':
      if (state.mic.recording?.id !== action.recordingId) return state;
      return {
        ...state,
        mic: {
          ...state.mic,
          status: 'ready',
          pcm: action.pcm,
          sourceId: action.sourceId,
          originalSpectrum: action.originalSpectrum,
        },
      };
    case 'view/time':
      return { ...state, view: { ...state.view, timeView: { value: action.value, forKey: action.forKey } } };
    case 'view/freq':
      return { ...state, view: { ...state.view, freqView: { value: action.value, forKey: action.forKey } } };
    case 'view/originalTime':
      return { ...state, view: { ...state.view, originalTimeView: { value: action.value, forKey: action.forKey } } };
    case 'view/txSpectrum':
      return { ...state, view: { ...state.view, txSpectrum: action.value } };
    case 'view/originalSpectrum':
      return { ...state, view: { ...state.view, originalSpectrum: action.value } };
    case 'view/domain':
      return { ...state, view: { ...state.view, domain: action.domain } };
    case 'view/txScale':
      return { ...state, view: { ...state.view, txScale: action.scale } };
    case 'view/originalScale':
      return { ...state, view: { ...state.view, originalScale: action.scale } };
    case 'view/bpskReference':
      return { ...state, view: { ...state.view, showBpskReference: action.value } };
    case 'view/follow':
      return { ...state, view: { ...state.view, followPlayhead: action.value } };
    case 'playback/state':
      return { ...state, playback: { ...state.playback, playing: action.playing, error: action.error ?? state.playback.error } };
    case 'playback/volume':
      return {
        ...state,
        playback: { ...state.playback, volumes: { ...state.playback.volumes, [action.target]: action.volume } },
      };
    case 'playback/error':
      return { ...state, playback: { ...state.playback, error: action.error } };
    case 'audio/context':
      return state.audioContext === action.state ? state : { ...state, audioContext: action.state };
    case 'engine/worker':
      return { ...state, workerMode: action.mode };
    case 'notice/add':
      if (state.notices.some((notice) => notice.text === action.text)) return state;
      return {
        ...state,
        notices: [...state.notices, { id: state.nextNoticeId, tone: action.tone, text: action.text }],
        nextNoticeId: state.nextNoticeId + 1,
      };
    case 'notice/dismiss':
      return { ...state, notices: state.notices.filter((notice) => notice.id !== action.id) };
  }
}
