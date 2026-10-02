import { PCM, SIM_SAMPLE_RATE, type SourceKind } from '../../config/constants';
import { formatCount, formatDecimal, formatDuration, formatHz, formatMs } from '../../domain/format';
import type { ModulationKind, ModulationParams, PcmMeta, RecordingMeta } from '../../domain/types';
import { pcmExpansionFactor } from '../../dsp/metrics';
import type { TextStats } from '../../sources/text';
import { MODULATION_LABELS } from '../help/texts';

export interface Indicator {
  id: string;
  label: string;
  value: string;
  help?: string;
}

export interface IndicatorGroup {
  id: 'tx' | 'tones' | 'sampling' | 'source';
  title: string;
  items: Indicator[];
}

export interface IndicatorInput {
  modulation: ModulationKind;
  params: ModulationParams;
  selectionStart: number;
  selectionLength: number;
  totalBits: number;
  sourceKind: SourceKind;
  textStats?: TextStats | null;
  recording?: RecordingMeta | null;
  pcm?: PcmMeta | null;
}

const F = SIM_SAMPLE_RATE;

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return 'no informado';
  return value ? 'sí' : 'no';
}

export function computeIndicators(input: IndicatorInput): IndicatorGroup[] {
  const { params, modulation } = input;
  const rb = params.bitRate;
  const n = input.selectionLength;
  const spb = F / rb;
  const groups: IndicatorGroup[] = [];

  groups.push({
    id: 'tx',
    title: 'Transmisión',
    items: [
      { id: 'modulation', label: 'Modulación', value: MODULATION_LABELS[modulation] },
      { id: 'm', label: 'M (símbolos)', value: '2 (binaria)', help: 'm' },
      { id: 'bitsPerSymbol', label: 'Bits por símbolo', value: '1 = log₂ M' },
      { id: 'rb', label: 'Tasa de bits R_b', value: `${formatCount(rb)} bit/s`, help: 'bitRate' },
      { id: 'rs', label: 'Tasa de símbolos R_s', value: `${formatCount(rb)} baudios`, help: 'baudRate' },
      { id: 'tb', label: 'Duración de bit T_b', value: formatMs(1 / rb) },
      { id: 'n', label: 'Bits del bloque N', value: `${formatCount(n)} de ${formatCount(input.totalBits)}` },
      { id: 'duration', label: 'Duración T = N/R_b', value: formatDuration(n / rb) },
      { id: 'samples', label: 'Muestras generadas', value: formatCount(n * spb) },
    ],
  });

  const toneItems: Indicator[] = [{ id: 'fc', label: 'Portadora f_c', value: formatHz(params.carrierHz), help: 'carrier' }];
  if (modulation === 'fsk') {
    const f0 = params.carrierHz - params.deltaHz;
    const f1 = params.carrierHz + params.deltaHz;
    toneItems.push(
      { id: 'f0', label: 'f₀ = f_c − Δf', value: formatHz(f0) },
      { id: 'f1', label: 'f₁ = f_c + Δf', value: formatHz(f1) },
      { id: 'df', label: 'Desviación Δf', value: formatHz(params.deltaHz), help: 'deltaF' },
      { id: 'separation', label: 'Separación total 2Δf', value: formatHz(2 * params.deltaHz) },
      { id: 'h', label: 'Índice h = 2Δf / R_b', value: formatDecimal((2 * params.deltaHz) / rb, 3) },
      { id: 'cycles0', label: 'Ciclos de f₀ por bit', value: formatDecimal(f0 / rb, 3) },
      { id: 'cycles1', label: 'Ciclos de f₁ por bit', value: formatDecimal(f1 / rb, 3) },
    );
  } else {
    toneItems.push({ id: 'cycles', label: 'Ciclos de portadora por bit', value: formatDecimal(params.carrierHz / rb, 3) });
    const low = Math.max(0, params.carrierHz - rb);
    toneItems.push({
      id: 'lobe',
      label: 'Lóbulo principal',
      value: `${formatCount(low)}–${formatCount(params.carrierHz + rb)} Hz`,
    });
  }
  if (modulation === 'ask') {
    toneItems.push(
      { id: 'a0', label: 'Amplitud A₀ (bit 0)', value: formatDecimal(params.a0, 3) },
      { id: 'a1', label: 'Amplitud A₁ (bit 1)', value: formatDecimal(params.a1, 3) },
    );
  }
  groups.push({ id: 'tones', title: modulation === 'fsk' ? 'Tonos' : 'Portadora', items: toneItems });

  const highest = modulation === 'fsk' ? params.carrierHz + params.deltaHz : params.carrierHz;
  groups.push({
    id: 'sampling',
    title: 'Muestreo de la simulación',
    items: [
      { id: 'fsim', label: 'F_sim', value: `${formatCount(F)} muestras/s`, help: 'fsim' },
      { id: 'spb', label: 'Muestras por bit S_b', value: formatCount(spb) },
      { id: 'spc', label: 'Muestras por ciclo (tono más alto)', value: formatDecimal(F / highest, 2) },
      { id: 'nyquist', label: 'Nyquist de simulación', value: formatHz(F / 2), help: 'nyquist' },
    ],
  });

  if (input.sourceKind === 'text' && input.textStats) {
    const stats = input.textStats;
    groups.push({
      id: 'source',
      title: 'Texto (UTF-8)',
      items: [
        { id: 'utf16', label: 'Unidades UTF-16 (longitud JS)', value: formatCount(stats.utf16Units) },
        { id: 'codePoints', label: 'Puntos de código', value: formatCount(stats.codePoints) },
        { id: 'graphemes', label: 'Caracteres visibles (grafemas)', value: stats.graphemes === null ? 'no disponible' : formatCount(stats.graphemes) },
        { id: 'bytes', label: 'Bytes UTF-8', value: formatCount(stats.byteCount) },
        { id: 'bits', label: 'Bits', value: formatCount(stats.byteCount * 8) },
      ],
    });
  }

  if (input.sourceKind === 'microphone' && input.recording) {
    const rec = input.recording;
    const items: Indicator[] = [
      { id: 'captureRate', label: 'Frecuencia de captura (AudioContext)', value: `${formatCount(rec.sampleRate)} muestras/s`, help: 'sampleRates' },
      {
        id: 'deviceRate',
        label: 'Frecuencia informada por la pista',
        value: rec.effective.sampleRate ? `${formatCount(rec.effective.sampleRate)} muestras/s` : 'no informada',
      },
      { id: 'channels', label: 'Canales recibidos', value: `${rec.channelCountReceived} (mezcla a mono: promedio)` },
      { id: 'recDuration', label: 'Duración de la grabación', value: formatDuration(rec.durationS) },
      { id: 'pcmFormat', label: 'PCM educativo', value: `${formatCount(PCM.sampleRate)} muestras/s · 8 bits/muestra = 64 000 bit/s`, help: 'pcm' },
    ];
    if (input.pcm) {
      const firstSample = input.selectionStart / 8;
      const samples = input.selectionLength / 8;
      items.push(
        { id: 'pcmSamples', label: 'Muestras PCM', value: formatCount(input.pcm.sampleCount) },
        { id: 'pcmBits', label: 'Bits PCM totales', value: formatCount(input.pcm.sampleCount * 8) },
        {
          id: 'blockAudio',
          label: 'Audio del bloque',
          value: `${formatMs(samples / PCM.sampleRate)} (muestras ${formatCount(firstSample)}…${formatCount(firstSample + samples - 1)})`,
        },
        { id: 'expansion', label: 'Expansión temporal', value: `×${formatDecimal(pcmExpansionFactor(rb), 1)} (64 000 / R_b)` },
      );
      if (input.pcm.clippedCount > 0) {
        items.push({ id: 'clipped', label: 'Muestras recortadas', value: formatCount(input.pcm.clippedCount) });
      }
    }
    items.push({
      id: 'processing',
      label: 'Procesado efectivo (AGC · eco · ruido)',
      value: `${yesNo(rec.effective.autoGainControl)} · ${yesNo(rec.effective.echoCancellation)} · ${yesNo(rec.effective.noiseSuppression)} (pedido: no · no · no)`,
    });
    groups.push({ id: 'source', title: 'Micrófono y PCM', items });
  }
  return groups;
}
