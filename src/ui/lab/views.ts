import { VIEW } from '../../config/constants';
import type { FreqRange, TimeRange, ToneSet } from '../../domain/types';

export function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function defaultTimeView(durationS: number, bitRate: number): TimeRange {
  return { t0: 0, t1: Math.min(durationS, VIEW.defaultViewBits / bitRate) };
}

function clampView(t0: number, span: number, durationS: number): TimeRange {
  const width = Math.min(span, durationS);
  const start = Math.min(Math.max(0, t0), durationS - width);
  return { t0: start, t1: start + width };
}

export function panView(view: TimeRange, direction: -1 | 1, durationS: number): TimeRange {
  const span = view.t1 - view.t0;
  return clampView(view.t0 + (direction * span) / 2, span, durationS);
}

export function zoomView(view: TimeRange, factor: number, durationS: number, minSpan: number): TimeRange {
  const center = (view.t0 + view.t1) / 2;
  const span = Math.min(durationS, Math.max(minSpan, (view.t1 - view.t0) * factor));
  return clampView(center - span / 2, span, durationS);
}

export function centerView(view: TimeRange, t: number, durationS: number): TimeRange {
  const span = view.t1 - view.t0;
  return clampView(t - span / 2, span, durationS);
}

export function defaultFreqView(tones: ToneSet, bitRate: number, sampleRate: number): FreqRange {
  const highest = Math.max(tones.carrierHz, tones.f1Hz ?? 0);
  return { f0: 0, f1: Math.min(sampleRate / 2, ceilTo(highest + 6 * bitRate, 500)) };
}

export function sameTimeRange(a: TimeRange, b: TimeRange, epsilon = 1e-7): boolean {
  return Math.abs(a.t0 - b.t0) < epsilon && Math.abs(a.t1 - b.t1) < epsilon;
}

export function relayoutXRange(event: Record<string, unknown>): { range: [number, number] | null; autorange: boolean } {
  const r0 = event['xaxis.range[0]'];
  const r1 = event['xaxis.range[1]'];
  if (typeof r0 === 'number' && typeof r1 === 'number') return { range: [r0, r1], autorange: false };
  const pair = event['xaxis.range'];
  if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number') {
    return { range: [pair[0], pair[1]], autorange: false };
  }
  return { range: null, autorange: event['xaxis.autorange'] === true };
}
