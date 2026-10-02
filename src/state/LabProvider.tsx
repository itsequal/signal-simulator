import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from 'react';
import { subscribePreloadError } from '../app/preloadError';
import { audioEngine } from '../audio/audioEngine';
import { captureEngine, type CapturedRecording } from '../audio/captureEngine';
import { SIM_SAMPLE_RATE, TIMING, type BitRate, type SourceKind } from '../config/constants';
import { appError, isAppError } from '../domain/errors';
import { formatDecimal } from '../domain/format';
import type { FreqRange, ModulationKind, PlaybackTarget, RecordingMeta, SampleRange, TimeRange } from '../domain/types';
import { getDspClient, StaleJobError } from '../workers/dspClient';
import { bufferStore } from './bufferStore';
import { derive, type Derived } from './derive';
import { createInitialState, type Domain, type LabState, type SpectrumScale } from './labState';
import { labReducer, type LabAction } from './labReducer';

export interface LabActions {
  setSourceKind(kind: SourceKind): void;
  setBinaryRaw(raw: string): void;
  setTextRaw(raw: string): void;
  setSelection(start: number, length: number, notice?: string | null): void;
  setModulation(modulation: ModulationKind): void;
  setParam(field: 'carrierHz' | 'deltaHz' | 'a0' | 'a1', value: string): void;
  setBitRate(rate: BitRate): void;
  resetParams(): void;
  startRecording(): void;
  stopRecording(): void;
  cancelRecording(): void;
  play(target: PlaybackTarget): void;
  stopPlayback(): void;
  setVolume(target: PlaybackTarget, volume: number): void;
  setTimeView(range: TimeRange | null): void;
  setFreqView(range: FreqRange, forKey: string): void;
  setOriginalTimeView(range: TimeRange | null): void;
  analyzeTxRange(range: SampleRange, clampedFrom: number | null): void;
  resetTxSpectrum(): void;
  analyzeOriginalRange(range: SampleRange, clampedFrom: number | null): void;
  resetOriginalSpectrum(): void;
  setDomain(domain: Domain): void;
  setTxScale(scale: SpectrumScale): void;
  setOriginalScale(scale: SpectrumScale): void;
  setBpskReference(value: boolean): void;
  setFollow(value: boolean): void;
  dismissNotice(id: number): void;
}

export interface LabContextValue {
  state: LabState;
  derived: Derived;
  actions: LabActions;
}

const LabContext = createContext<LabContextValue | null>(null);

let recordingCounter = 0;

export function timeViewKey(sampleCount: number): string {
  return `dur:${sampleCount}`;
}

function recordingNotice(recording: CapturedRecording): string | null {
  const parts: string[] = [];
  if (recording.endedBy === 'limit') parts.push('Se alcanzó el límite de 5 s: la grabación se detuvo automáticamente.');
  if (recording.endedBy === 'interrupted') {
    parts.push(`La captura se interrumpió; se conservan ${formatDecimal(recording.durationS, 2)} s de audio.`);
  }
  if (recording.peak < 0.003) {
    parts.push('La grabación parece silenciosa (pico inferior a −50 dB respecto a la escala completa ±1).');
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createJobs(dispatch: Dispatch<LabAction>) {
  const requestTxSpectrum = async (resultId: string, range: SampleRange, clampedFrom: number | null) => {
    const result = bufferStore.results.get(resultId);
    if (!result) return;
    const end = range.start + range.length;
    const signals = (['nrz', 'carrier', 'modulated'] as const).map((kind) => ({
      kind,
      samples: result.buffers[kind].slice(range.start, end),
    }));
    try {
      const response = await getDspClient().request('tx-spectrum', {
        type: 'spectrum',
        sampleRate: SIM_SAMPLE_RATE,
        rangeStart: range.start,
        signals,
      });
      if (response.type !== 'spectrum-done') return;
      const [nrz, carrier, modulated] = response.spectra;
      const key = `${resultId}|${range.start}|${range.length}`;
      bufferStore.txSpectra.set(key, { range, nrz, carrier, modulated });
      dispatch({ type: 'view/txSpectrum', value: { ownerId: resultId, key, range, clampedFrom } });
    } catch (error) {
      if (!(error instanceof StaleJobError)) {
        dispatch({ type: 'notice/add', tone: 'error', text: appError('E-DSP', errorText(error)).message });
      }
    }
  };

  const requestOriginalSpectrum = async (recording: RecordingMeta, range: SampleRange, clampedFrom: number | null) => {
    const samples = bufferStore.recordings.get(recording.id);
    if (!samples) return;
    try {
      const response = await getDspClient().request('original-spectrum', {
        type: 'spectrum',
        sampleRate: recording.sampleRate,
        rangeStart: range.start,
        signals: [{ kind: 'original', samples: samples.slice(range.start, range.start + range.length) }],
      });
      if (response.type !== 'spectrum-done') return;
      const key = `${recording.id}|${range.start}|${range.length}`;
      bufferStore.originalSpectra.set(key, response.spectra[0]);
      dispatch({ type: 'view/originalSpectrum', value: { ownerId: recording.id, key, range, clampedFrom } });
    } catch (error) {
      if (!(error instanceof StaleJobError)) {
        dispatch({ type: 'notice/add', tone: 'error', text: appError('E-DSP', errorText(error)).message });
      }
    }
  };

  const processRecording = async (recording: CapturedRecording) => {
    recordingCounter++;
    const id = `rec-${recordingCounter}`;
    bufferStore.recordings.set(id, recording.samples);
    audioEngine.invalidate('orig:');
    const meta: RecordingMeta = {
      id,
      sampleRate: recording.sampleRate,
      frameCount: recording.frameCount,
      durationS: recording.durationS,
      channelCountReceived: recording.channelCountReceived,
      downmix: 'average',
      requested: recording.requested,
      effective: recording.effective,
      deviceLabel: recording.deviceLabel,
      endedBy: recording.endedBy,
      peak: recording.peak,
    };
    dispatch({ type: 'mic/recorded', recording: meta, notice: recordingNotice(recording) });
    try {

      const response = await getDspClient().request('pcm', {
        type: 'pcm',
        samples: recording.samples.slice(),
        sampleRate: recording.sampleRate,
      });
      if (response.type !== 'pcm-done') return;
      const sourceId = `mic-${id}`;
      bufferStore.mic.set(sourceId, {
        pcmFloat: response.pcmFloat,
        pcmBytes: response.pcmBytes,
        bits: response.bits,
        originalSpectrum: response.originalSpectrum,
      });
      dispatch({
        type: 'mic/pcm',
        recordingId: id,
        sourceId,
        pcm: {
          sampleRate: response.resampler.outputRate,
          bitsPerSample: 8,
          encoding: 'u8-floor-offset128',
          sampleCount: response.pcmBytes.length,
          clippedCount: response.clippedCount,
          nonFiniteCount: response.nonFiniteCount,
          resampler: response.resampler,
        },
        originalSpectrum: response.originalSpectrum?.meta ?? null,
      });
    } catch (error) {
      if (error instanceof StaleJobError) return;
      dispatch({ type: 'mic/error', error: appError('E-DSP', errorText(error)) });
    }
  };

  return { requestTxSpectrum, requestOriginalSpectrum, processRecording };
}

type Jobs = ReturnType<typeof createJobs>;

function createActions(
  dispatch: Dispatch<LabAction>,
  stateRef: RefObject<LabState>,
  derivedRef: RefObject<Derived>,
  jobs: Jobs,
): LabActions {
  const onPlayError = (error: unknown) => {
    dispatch({ type: 'playback/error', error: isAppError(error) ? error : appError('E-AUDIO-FAILED') });
  };

  return {
    setSourceKind: (kind) => {
      if (!derivedRef.current.controls.sourceSwitch) return;
      dispatch({ type: 'source/kind', kind });
    },
    setBinaryRaw: (raw) => dispatch({ type: 'input/binary', raw }),
    setTextRaw: (raw) => dispatch({ type: 'input/text', raw }),
    setSelection: (start, length, notice) => {
      const data = derivedRef.current.source.data;
      if (!data) return;
      dispatch({ type: 'selection/set', kind: data.kind, selection: { sourceId: data.id, start, length }, notice: notice ?? null });
    },
    setModulation: (modulation) => dispatch({ type: 'modulation/set', modulation }),
    setParam: (field, value) => dispatch({ type: 'params/set', field, value }),
    setBitRate: (value) => dispatch({ type: 'params/bitRate', value }),
    resetParams: () => dispatch({ type: 'params/reset' }),
    startRecording: () => {
      if (!derivedRef.current.controls.record) return;

      captureEngine.start({
        onStatus: (status) => dispatch({ type: 'mic/status', status }),
        onFinished: (recording) => void jobs.processRecording(recording),
        onError: (error) => dispatch({ type: 'mic/error', error }),
        onCancelled: () => dispatch({ type: 'mic/cancelled' }),
      });
    },
    stopRecording: () => captureEngine.stop('user'),
    cancelRecording: () => captureEngine.cancel(),
    play: (target) => {
      const current = stateRef.current;
      const derived = derivedRef.current;
      if (!derived.controls.play[target]) return;
      dispatch({ type: 'playback/error', error: null });
      if (target === 'original') {
        const recording = current.mic.recording;
        const samples = recording ? bufferStore.recordings.get(recording.id) : undefined;
        if (!recording || !samples) return;
        audioEngine
          .play({ target, cacheKey: `orig:${recording.id}`, samples, sampleRate: recording.sampleRate, volume: current.playback.volumes.original })
          .catch(onPlayError);
        return;
      }
      const meta = current.result.meta;
      const result = meta ? bufferStore.results.get(meta.resultId) : undefined;
      if (!meta || !result || !derived.resultMatches) return;
      audioEngine
        .play({
          target,
          cacheKey: `tx:${meta.resultId}:${target}`,
          samples: target === 'carrier' ? result.buffers.carrier : result.buffers.modulated,
          sampleRate: meta.config.sampleRate,
          volume: current.playback.volumes[target],
        })
        .catch(onPlayError);
    },
    stopPlayback: () => audioEngine.stop(),
    setVolume: (target, volume) => {
      dispatch({ type: 'playback/volume', target, volume });
      audioEngine.setVolume(target, volume);
    },
    setTimeView: (range) => {
      const meta = stateRef.current.result.meta;
      if (!meta) return;
      const minSpan = 1 / meta.config.sampleRate;
      const value = range
        ? {
            t0: Math.max(0, Math.min(range.t0, meta.durationS - minSpan)),
            t1: Math.min(meta.durationS, Math.max(range.t1, Math.max(0, range.t0) + minSpan)),
          }
        : { t0: 0, t1: meta.durationS };
      dispatch({ type: 'view/time', value, forKey: timeViewKey(meta.sampleCount) });
    },
    setFreqView: (range, forKey) => dispatch({ type: 'view/freq', value: range, forKey }),
    setOriginalTimeView: (range) => {
      const recording = stateRef.current.mic.recording;
      if (!recording) return;
      const minSpan = 1 / recording.sampleRate;
      const value = range
        ? {
            t0: Math.max(0, Math.min(range.t0, recording.durationS - minSpan)),
            t1: Math.min(recording.durationS, Math.max(range.t1, Math.max(0, range.t0) + minSpan)),
          }
        : { t0: 0, t1: recording.durationS };
      dispatch({ type: 'view/originalTime', value, forKey: recording.id });
    },
    analyzeTxRange: (range, clampedFrom) => {
      const meta = stateRef.current.result.meta;
      if (meta) void jobs.requestTxSpectrum(meta.resultId, range, clampedFrom);
    },
    resetTxSpectrum: () => dispatch({ type: 'view/txSpectrum', value: null }),
    analyzeOriginalRange: (range, clampedFrom) => {
      const recording = stateRef.current.mic.recording;
      if (recording) void jobs.requestOriginalSpectrum(recording, range, clampedFrom);
    },
    resetOriginalSpectrum: () => dispatch({ type: 'view/originalSpectrum', value: null }),
    setDomain: (domain) => dispatch({ type: 'view/domain', domain }),
    setTxScale: (scale) => dispatch({ type: 'view/txScale', scale }),
    setOriginalScale: (scale) => dispatch({ type: 'view/originalScale', scale }),
    setBpskReference: (value) => dispatch({ type: 'view/bpskReference', value }),
    setFollow: (value) => dispatch({ type: 'view/follow', value }),
    dismissNotice: (id) => dispatch({ type: 'notice/dismiss', id }),
  };
}

export function LabProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(labReducer, undefined, createInitialState);
  const derived = useMemo(() => derive(state), [state]);
  const stateRef = useRef(state);
  const derivedRef = useRef(derived);

  useEffect(() => {
    stateRef.current = state;
    derivedRef.current = derived;
  });

  const jobs = useMemo(() => createJobs(dispatch), []);
  const actions = useMemo(() => createActions(dispatch, stateRef, derivedRef, jobs), [jobs]);

  useEffect(
    () =>
      audioEngine.subscribe((snapshot) => {
        dispatch({ type: 'playback/state', playing: snapshot.playing, error: snapshot.lastError });
        dispatch({ type: 'audio/context', state: snapshot.contextState });
      }),
    [],
  );
  useEffect(() => getDspClient().onModeChange((mode) => dispatch({ type: 'engine/worker', mode })), []);
  useEffect(() => {
    if (state.workerMode === 'inline') dispatch({ type: 'notice/add', tone: 'warning', text: appError('E-WORKER').message });
  }, [state.workerMode]);
  useEffect(
    () => subscribePreloadError(() => dispatch({ type: 'notice/add', tone: 'error', text: appError('E-PRELOAD').message })),
    [],
  );

  const signatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (signatureRef.current !== null && signatureRef.current !== derived.signature) audioEngine.stop();
    signatureRef.current = derived.signature;
  }, [derived.signature]);

  useEffect(() => {
    const key = derived.configKey;
    if (!key) return;
    const meta = stateRef.current.result.meta;
    if (meta?.configKey === key && bufferStore.results.has(meta.resultId)) return;
    dispatch({ type: 'sim/pending', key });
    const timer = window.setTimeout(
      () => {
        void (async () => {
          const d = derivedRef.current;
          if (d.configKey !== key || !d.config || !d.source.data || !d.selection) return;
          dispatch({ type: 'sim/computing', key });
          const { data } = d.source;
          const { selection, config } = d;
          const bits = data.bits.slice(selection.start, selection.start + selection.length);
          try {
            const response = await getDspClient().request('simulate', { type: 'simulate', bits, config });
            if (response.type !== 'simulate-done') return;
            const resultId = `res-${response.jobId}`;
            bufferStore.results.set(resultId, { buffers: response.buffers, spectra: response.spectra });
            audioEngine.invalidate('tx:');
            dispatch({
              type: 'sim/done',
              meta: {
                resultId,
                configKey: key,
                jobId: response.jobId,
                sourceId: data.id,
                sourceKind: data.kind,
                selection,
                totalBits: data.totalBits,
                config,
                samplesPerBit: response.samplesPerBit,
                sampleCount: response.sampleCount,
                durationS: response.durationS,
                tones: response.tones,
              },
            });
            const custom = stateRef.current.view.txSpectrum;
            if (custom) {
              if (custom.range.start + custom.range.length <= response.sampleCount) {
                void jobs.requestTxSpectrum(resultId, custom.range, custom.clampedFrom);
              } else {
                dispatch({ type: 'view/txSpectrum', value: null });
              }
            }
          } catch (error) {
            if (error instanceof StaleJobError) return;
            dispatch({ type: 'sim/failed', key, error: appError('E-DSP', errorText(error)) });
          }
        })();
      },
      meta === null ? 0 : TIMING.debounceMs,
    );
    return () => window.clearTimeout(timer);
  }, [derived.configKey, jobs]);

  const value = useMemo(() => ({ state, derived, actions }), [state, derived, actions]);
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

export function useLab(): LabContextValue {
  const context = useContext(LabContext);
  if (!context) throw new Error('useLab debe usarse dentro de <LabProvider>');
  return context;
}
