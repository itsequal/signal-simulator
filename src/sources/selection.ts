import { BIT_RATES, LIMITS, PCM, type BitRate } from '../config/constants';
import { formatCount, formatDecimal, formatMs } from '../domain/format';
import type { BitSelection, SourceKind, ValidationIssue } from '../domain/types';

export type Alignment = 1 | 8;

export function alignmentFor(kind: SourceKind): Alignment {
  return kind === 'binary' ? 1 : 8;
}

export function defaultSelection(totalBits: number): BitSelection | null {
  if (totalBits <= 0) return null;
  return { start: 0, length: Math.min(totalBits, LIMITS.defaultSelectionBits) };
}

export function maxBitsForDuration(bitRate: number, alignment: Alignment): number {
  const raw = Math.floor(LIMITS.maxSimSeconds * bitRate + 1e-9);
  return raw - (raw % alignment);
}

export function minBitRateFor(bitCount: number): BitRate | null {
  for (const rate of BIT_RATES) {
    if (bitCount / rate <= LIMITS.maxSimSeconds + 1e-9) return rate;
  }
  return null;
}

export function fullSelectionFits(totalBits: number, bitRate: number): boolean {
  return totalBits > 0 && totalBits / bitRate <= LIMITS.maxSimSeconds + 1e-9;
}

function issue(code: string, message: string): ValidationIssue {
  return { code, severity: 'error', field: 'selection', message };
}

export function validateSelection(selection: BitSelection, totalBits: number, alignment: Alignment): ValidationIssue | null {
  const { start, length } = selection;
  const unit = alignment === 8 ? 'bytes' : 'bits';
  if (!Number.isInteger(start) || !Number.isInteger(length)) {
    return issue('E-SEL-INT', `El inicio y la longitud del bloque deben ser números enteros de ${unit}.`);
  }
  if (length <= 0) return issue('E-SEL-EMPTY', `El bloque debe contener al menos 1 ${alignment === 8 ? 'byte' : 'bit'}.`);
  if (start < 0 || start + length > totalBits) {
    const describe = alignment === 8
      ? `bytes ${formatCount(start / 8)}…${formatCount((start + length) / 8 - 1)}`
      : `bits ${formatCount(start)}…${formatCount(start + length - 1)}`;
    const total = alignment === 8 ? `${formatCount(totalBits / 8)} bytes` : `${formatCount(totalBits)} bits`;
    return issue('E-SEL-RANGE', `El bloque (${describe}) sobrepasa la entrada, que tiene ${total}. Los índices empiezan en 0.`);
  }
  if (alignment === 8 && (start % 8 !== 0 || length % 8 !== 0)) {
    return issue('E-SEL-ALIGN', 'Con texto y PCM el bloque debe empezar y terminar en bytes completos (múltiplos de 8 bits).');
  }
  return null;
}

export function validateDuration(bitCount: number, bitRate: BitRate, alignment: Alignment): ValidationIssue | null {
  const duration = bitCount / bitRate;
  if (duration <= LIMITS.maxSimSeconds + 1e-9) return null;
  const maxBits = maxBitsForDuration(bitRate, alignment);
  const minRate = minBitRateFor(bitCount);
  const bytes = alignment === 8 ? ` (${formatCount(maxBits / 8)} bytes)` : '';
  const rate = minRate
    ? ` o sube la tasa a ${formatCount(minRate)} bit/s o más`
    : '; ninguna de las tasas disponibles basta para este bloque completo';
  return {
    code: 'E-DURATION',
    severity: 'error',
    field: 'duration',
    message: `La simulación duraría ${formatDecimal(duration, 2)} s (${formatCount(bitCount)} bits a ${formatCount(bitRate)} bit/s) y el máximo es ${LIMITS.maxSimSeconds} s. Reduce el bloque a ${formatCount(maxBits)} bits${bytes} como máximo${rate}. No se recorta nada automáticamente.`,
  };
}

export function nextBlock(selection: BitSelection, totalBits: number): { selection: BitSelection; shortened: boolean } | null {
  const start = selection.start + selection.length;
  if (start >= totalBits) return null;
  const length = Math.min(selection.length, totalBits - start);
  return { selection: { start, length }, shortened: length < selection.length };
}

export function previousBlock(selection: BitSelection): BitSelection | null {
  if (selection.start <= 0) return null;
  return { start: Math.max(0, selection.start - selection.length), length: selection.length };
}

export interface PcmSpan {
  firstSample: number;
  sampleCount: number;
  startS: number;
  endS: number;
}

export function pcmSpanForSelection(selection: BitSelection): PcmSpan {
  const firstSample = selection.start / 8;
  const sampleCount = selection.length / 8;
  return {
    firstSample,
    sampleCount,
    startS: firstSample / PCM.sampleRate,
    endS: (firstSample + sampleCount) / PCM.sampleRate,
  };
}

export function describeSelection(selection: BitSelection, totalBits: number, kind: SourceKind): string {
  const last = selection.start + selection.length - 1;
  const bitsPart = `k = ${formatCount(selection.start)}…${formatCount(last)} · ${formatCount(selection.length)} de ${formatCount(totalBits)} bits`;
  if (kind === 'binary') return bitsPart;
  const firstByte = selection.start / 8;
  const lastByte = (selection.start + selection.length) / 8 - 1;
  if (kind === 'text') {
    return `${bitsPart} · bytes ${formatCount(firstByte)}…${formatCount(lastByte)} (${formatCount(selection.length / 8)} de ${formatCount(totalBits / 8)})`;
  }
  const span = pcmSpanForSelection(selection);
  return `${bitsPart} · muestras PCM ${formatCount(firstByte)}…${formatCount(lastByte)} = ${formatMs(span.startS)} a ${formatMs(span.endS)} de la grabación`;
}
