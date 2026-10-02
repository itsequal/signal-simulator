import { SIM_SAMPLE_RATE, type SourceKind } from '../config/constants';
import { computeWarnings } from '../dsp/metrics';
import type { BitSelection, PlaybackTarget, SimulationConfig, U8, ValidationIssue } from '../domain/types';
import { parseBinaryInput } from '../sources/binary';
import { formatCount, formatDecimal } from '../domain/format';
import {
  defaultSelection,
  fullSelectionFits,
  validateDuration,
  validateSelection,
  type Alignment,
} from '../sources/selection';
import { encodeText, type TextStats } from '../sources/text';
import { validateParams, type ParamValidation } from '../validation/params';
import { bufferStore } from './bufferStore';
import type { LabState } from './labState';

export interface SourceData {
  id: string;
  kind: SourceKind;
  bits: U8;
  bytes: U8 | null;
  totalBits: number;
  alignment: Alignment;
}

export interface DerivedSource {
  kind: SourceKind;
  status: 'ok' | 'empty' | 'error' | 'waiting';
  data: SourceData | null;
  issue: ValidationIssue | null;
  warning: ValidationIssue | null;
  textStats: TextStats | null;
}

let binaryCache: { raw: string; value: DerivedSource } | null = null;
let textCache: { raw: string; value: DerivedSource } | null = null;
let version = 0;

export function deriveBinarySource(raw: string): DerivedSource {
  if (binaryCache?.raw === raw) return binaryCache.value;
  const parsed = parseBinaryInput(raw);
  const base = { kind: 'binary' as const, warning: null, textStats: null };
  let value: DerivedSource;
  if (parsed.status === 'ok') {
    version++;
    value = {
      ...base,
      status: 'ok',
      issue: null,
      data: { id: `bin-${version}`, kind: 'binary', bits: parsed.bits, bytes: null, totalBits: parsed.bits.length, alignment: 1 },
    };
  } else if (parsed.status === 'empty') {
    value = { ...base, status: 'empty', issue: null, data: null };
  } else {
    value = { ...base, status: 'error', issue: parsed.issue, data: null };
  }
  binaryCache = { raw, value };
  return value;
}

export function deriveTextSource(raw: string): DerivedSource {
  if (textCache?.raw === raw) return textCache.value;
  const encoded = encodeText(raw);
  let value: DerivedSource;
  if (encoded.status === 'ok') {
    version++;
    value = {
      kind: 'text',
      status: 'ok',
      issue: null,
      warning: encoded.warning,
      textStats: encoded.stats,
      data: { id: `txt-${version}`, kind: 'text', bits: encoded.bits, bytes: encoded.bytes, totalBits: encoded.bits.length, alignment: 8 },
    };
  } else if (encoded.status === 'empty') {
    value = { kind: 'text', status: 'empty', issue: null, warning: null, textStats: encoded.stats, data: null };
  } else {
    value = { kind: 'text', status: 'error', issue: encoded.issue, warning: null, textStats: encoded.stats, data: null };
  }
  textCache = { raw, value };
  return value;
}

export function deriveMicSource(state: LabState): DerivedSource {
  const base = { kind: 'microphone' as const, issue: null, warning: null, textStats: null };
  const { mic } = state;
  if (mic.status === 'processing') return { ...base, status: 'waiting', data: null };
  const buffers = mic.sourceId ? bufferStore.mic.get(mic.sourceId) : undefined;
  if (!mic.sourceId || !buffers) return { ...base, status: 'empty', data: null };
  return {
    ...base,
    status: 'ok',
    data: { id: mic.sourceId, kind: 'microphone', bits: buffers.bits, bytes: buffers.pcmBytes, totalBits: buffers.bits.length, alignment: 8 },
  };
}

export function deriveSource(state: LabState, kind: SourceKind = state.sourceKind): DerivedSource {
  if (kind === 'binary') return deriveBinarySource(state.binaryRaw);
  if (kind === 'text') return deriveTextSource(state.textRaw);
  return deriveMicSource(state);
}

export type StatusKind =
  | 'empty'
  | 'ready'
  | 'requesting'
  | 'recording'
  | 'processing'
  | 'valid'
  | 'stale'
  | 'playing'
  | 'error';

export interface DisplayStatus {
  kind: StatusKind;
  label: string;
}

export interface Controls {
  sourceSwitch: boolean;
  sourceSwitchReason: string | null;
  play: Record<PlaybackTarget, boolean>;
  playReason: string | null;
  record: boolean;
  stopRecording: boolean;
  cancelRecording: boolean;
  fullSelection: boolean;
  fullSelectionReason: string | null;
}

export interface Derived {
  source: DerivedSource;
  selection: BitSelection | null;
  selectionIsDefault: boolean;
  selectionWasReset: boolean;
  selectionIssue: ValidationIssue | null;
  paramValidation: ParamValidation;
  durationIssue: ValidationIssue | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  canSimulate: boolean;
  config: SimulationConfig | null;
  configKey: string | null;

  signature: string;
  hasResult: boolean;
  resultMatches: boolean;
  status: DisplayStatus;
  controls: Controls;
}

const PLAYBACK_NAMES: Record<PlaybackTarget, string> = {
  original: 'audio original',
  carrier: 'portadora',
  modulated: 'señal modulada',
};

function configKeyFor(data: SourceData, selection: BitSelection, config: SimulationConfig): string {
  const { params, modulation } = config;
  const specific =
    modulation === 'fsk' ? `df=${params.deltaHz}` : modulation === 'ask' ? `a=${params.a0},${params.a1}` : '';
  return [data.id, selection.start, selection.length, modulation, params.carrierHz, params.bitRate, specific].join('|');
}

export function derive(state: LabState): Derived {
  const source = deriveSource(state);
  const data = source.data;
  const stored = state.selections[source.kind];

  let selection: BitSelection | null = null;
  let selectionIsDefault = true;
  let selectionIssue: ValidationIssue | null = null;
  const selectionWasReset = Boolean(data && stored && stored.sourceId !== data.id);
  if (data) {
    if (stored && stored.sourceId === data.id) {
      selection = { start: stored.start, length: stored.length };
      selectionIsDefault = false;
      selectionIssue = validateSelection(selection, data.totalBits, data.alignment);
    } else {
      selection = defaultSelection(data.totalBits);
    }
  }

  const paramValidation = validateParams(state.params, state.modulation);
  const durationIssue =
    data && selection && !selectionIssue ? validateDuration(selection.length, state.params.bitRate, data.alignment) : null;

  const errors: ValidationIssue[] = [];
  if (source.issue) errors.push(source.issue);
  if (selectionIssue) errors.push(selectionIssue);
  errors.push(...paramValidation.issues);
  if (durationIssue) errors.push(durationIssue);

  const warnings: ValidationIssue[] = [];
  if (source.warning) warnings.push(source.warning);
  if (paramValidation.params) warnings.push(...computeWarnings(paramValidation.params, state.modulation));

  const canSimulate = Boolean(source.status === 'ok' && data && selection && errors.length === 0 && paramValidation.params);
  const config: SimulationConfig | null =
    canSimulate && paramValidation.params
      ? { modulation: state.modulation, params: paramValidation.params, sampleRate: SIM_SAMPLE_RATE }
      : null;
  const configKey = config && data && selection ? configKeyFor(data, selection, config) : null;
  const signature = [
    source.kind,
    data?.id ?? `${source.status}:${source.issue?.message ?? ''}`,
    selection ? `${selection.start}+${selection.length}` : '-',
    state.modulation,
    JSON.stringify(state.params),
  ].join('|');

  const meta = state.result.meta;
  const hasResult = meta !== null && bufferStore.results.has(meta.resultId);
  const resultMatches = hasResult && configKey !== null && meta?.configKey === configKey;

  const micBusy = state.mic.status === 'requesting' || state.mic.status === 'recording' || state.mic.status === 'stopping';
  const status = displayStatus(state, source, errors, hasResult, resultMatches, micBusy);

  const recordingAvailable = Boolean(state.mic.recording && bufferStore.recordings.has(state.mic.recording.id));
  let playReason: string | null = null;
  if (micBusy) playReason = 'No se reproduce nada mientras se graba.';
  else if (!resultMatches) playReason = hasResult ? 'El resultado está desactualizado: espera a que se regenere o corrige la configuración.' : 'Todavía no hay señales generadas.';

  const fits = data ? fullSelectionFits(data.totalBits, state.params.bitRate) : false;
  const fullSelectionReason =
    data && !fits
      ? `La entrada completa (${formatCount(data.totalBits)} bits) duraría ${formatDecimal(data.totalBits / state.params.bitRate, 2)} s a ${formatCount(state.params.bitRate)} bit/s (máximo 30 s).`
      : null;

  const controls: Controls = {
    sourceSwitch: !micBusy,
    sourceSwitchReason: micBusy ? 'Detén o cancela la grabación para cambiar de fuente.' : null,
    play: {
      carrier: !micBusy && resultMatches,
      modulated: !micBusy && resultMatches,
      original: !micBusy && recordingAvailable,
    },
    playReason,
    record: !micBusy && state.mic.status !== 'processing',
    stopRecording: state.mic.status === 'recording',
    cancelRecording: state.mic.status === 'requesting' || state.mic.status === 'recording',
    fullSelection: Boolean(data && fits),
    fullSelectionReason,
  };

  return {
    source,
    selection,
    selectionIsDefault,
    selectionWasReset,
    selectionIssue,
    paramValidation,
    durationIssue,
    errors,
    warnings,
    canSimulate,
    config,
    configKey,
    signature,
    hasResult,
    resultMatches,
    status,
    controls,
  };
}

function displayStatus(
  state: LabState,
  source: DerivedSource,
  errors: ValidationIssue[],
  hasResult: boolean,
  resultMatches: boolean,
  micBusy: boolean,
): DisplayStatus {
  if (state.mic.status === 'requesting') return { kind: 'requesting', label: 'Solicitando permiso' };
  if (micBusy) return { kind: 'recording', label: 'Grabando' };
  if (state.playback.playing) {
    return { kind: 'playing', label: `Reproduciendo: ${PLAYBACK_NAMES[state.playback.playing]}` };
  }
  if ((source.kind === 'microphone' && state.mic.status === 'processing') || state.result.status === 'computing') {
    return { kind: 'processing', label: 'Procesando' };
  }
  if (source.kind === 'microphone' && state.mic.status === 'error' && source.status !== 'ok') {
    return { kind: 'error', label: 'Error' };
  }
  if (source.status === 'empty') return { kind: 'empty', label: 'Entrada vacía' };
  if (state.result.status === 'error' && !resultMatches) return { kind: 'error', label: 'Error' };
  if (errors.length > 0) return hasResult ? { kind: 'stale', label: 'Resultado desactualizado' } : { kind: 'error', label: 'Error' };
  if (resultMatches) return { kind: 'valid', label: 'Resultado válido' };
  if (hasResult) return { kind: 'stale', label: 'Resultado desactualizado' };
  return { kind: 'ready', label: 'Lista para simular' };
}
