import type { Data, Layout } from 'plotly.js-dist-min';
import { PALETTE, VIEW } from '../config/constants';
import { formatHz } from '../domain/format';
import type { FreqRange, ModulationKind, SignalKind, TimeRange } from '../domain/types';
import type { Series } from './decimate';
import { baseLayout, SIGNAL_STYLES, type SignalStyle } from './theme';

export interface Figure {
  data: Data[];
  layout: Partial<Layout>;
}

type Shape = NonNullable<Layout['shapes']>[number];
type Annotation = NonNullable<Layout['annotations']>[number];

export interface BitMarkers {
  boundariesS: number[];
  labels: Array<{ timeS: number; text: string }>;
}

export function symbolLabel(modulation: ModulationKind, bit: number): string {
  switch (modulation) {
    case 'ask':
      return bit ? 'A₁' : 'A₀';
    case 'ook':
      return bit ? 'enc.' : 'apag.';
    case 'fsk':
      return bit ? 'f₁' : 'f₀';
    case 'bpsk':
      return bit ? '180°' : '0°';
  }
}

export function computeBitMarkers(
  bits: Uint8Array,
  bitRate: number,
  view: TimeRange,
  widthPx: number,
  labelFor: (bit: number, k: number) => string,
): BitMarkers | null {
  const span = view.t1 - view.t0;
  if (span <= 0 || bits.length === 0 || widthPx <= 0) return null;
  const kFirst = Math.max(0, Math.floor(view.t0 * bitRate + 1e-9));
  const kLast = Math.min(bits.length - 1, Math.ceil(view.t1 * bitRate - 1e-9) - 1);
  if (kLast < kFirst) return null;
  const pxPerBit = widthPx / (span * bitRate);
  if (kLast - kFirst + 1 > VIEW.bitLabelMaxBits || pxPerBit < VIEW.bitLabelMinPx) return null;
  const boundariesS: number[] = [];
  for (let k = kFirst; k <= kLast + 1; k++) {
    const t = k / bitRate;
    if (t >= view.t0 - 1e-12 && t <= view.t1 + 1e-12) boundariesS.push(t);
  }
  const labels: BitMarkers['labels'] = [];
  for (let k = kFirst; k <= kLast; k++) {
    const center = (k + 0.5) / bitRate;
    if (center >= view.t0 && center <= view.t1) labels.push({ timeS: center, text: labelFor(bits[k], k) });
  }
  return { boundariesS, labels };
}

function lineTrace(series: Series, style: SignalStyle, options: { step?: boolean; hoverUnit: 'ms' | 's' }): Data {
  const xLabel = options.hoverUnit === 'ms' ? 't = %{x:.3f} ms' : 't = %{x:.4f} s';
  return {
    type: 'scatter',
    mode: series.markers ? 'lines+markers' : 'lines',
    x: series.x,
    y: series.y,
    name: style.name,

    line: {
      color: style.color,
      width: style.width,
      dash: series.mode === 'envelope' ? 'solid' : style.dash,
      shape: options.step && series.mode === 'raw' ? 'hv' : 'linear',
    },
    marker: { size: 4, color: style.color },
    hovertemplate: `${xLabel}<br>%{y:.3f} u. a.<extra>${style.short}</extra>`,
  } as Data;
}

function band(range: TimeRange, scale: number, fill: string, border?: string): Shape {
  return {
    type: 'rect',
    xref: 'x',
    yref: 'paper',
    x0: range.t0 * scale,
    x1: range.t1 * scale,
    y0: 0,
    y1: 1,
    fillcolor: fill,
    line: border ? { color: border, width: 1 } : { width: 0 },
    layer: 'below',
  } as Shape;
}

function verticalLine(x: number, color: string, dash: 'dot' | 'dash'): Shape {
  return {
    type: 'line',
    xref: 'x',
    yref: 'paper',
    x0: x,
    x1: x,
    y0: 0,
    y1: 1,
    line: { color, width: 1, dash },
  } as Shape;
}

function topLabel(x: number, text: string): Annotation {
  return {
    x,
    y: 1,
    xref: 'x',
    yref: 'paper',
    yanchor: 'bottom',
    text,
    showarrow: false,
    font: { size: 11, color: PALETTE.text },
  } as Annotation;
}

export interface TxTimeFigureInput {
  kind: 'nrz' | 'carrier' | 'modulated' | 'original';
  series: Series;
  reference?: Series | null;
  view: TimeRange;
  height: number;
  markers: BitMarkers | null;
  fftBand: TimeRange | null;
  yRange: [number, number];
}

export function buildTxTimeFigure(input: TxTimeFigureInput): Figure {
  const data: Data[] = [];
  if (input.reference) data.push(lineTrace(input.reference, SIGNAL_STYLES.reference, { hoverUnit: 'ms' }));
  data.push(lineTrace(input.series, SIGNAL_STYLES[input.kind], { step: input.kind === 'nrz', hoverUnit: 'ms' }));
  const shapes: Shape[] = [];
  if (input.fftBand) shapes.push(band(input.fftBand, 1000, PALETTE.fftBand));
  for (const t of input.markers?.boundariesS ?? []) shapes.push(verticalLine(t * 1000, 'rgba(0,0,0,0.3)', 'dot'));
  const annotations = (input.markers?.labels ?? []).map((label) => topLabel(label.timeS * 1000, label.text));
  return {
    data,
    layout: {
      ...baseLayout(input.height),
      xaxis: {
        range: [input.view.t0 * 1000, input.view.t1 * 1000],
        autorange: false,
        title: { text: 'Tiempo (ms)', standoff: 4 },
        zeroline: false,
        separatethousands: true,
        automargin: false,
      },
      yaxis: {
        range: input.yRange,
        fixedrange: true,
        title: { text: 'Amplitud (u. a.)', standoff: 4 },
        zeroline: true,
        zerolinecolor: '#c8ccd2',
        automargin: false,
      },
      shapes,
      annotations,
    },
  };
}

export interface ToneMarker {
  hz: number;
  label: string;
}

export interface SpectrumFigureInput {
  kind: SignalKind;
  series: Series;
  view: FreqRange;
  scale: 'linear' | 'db';
  linearRange: [number, number];
  dbRange: [number, number];
  toneMarkers: ToneMarker[];
  height: number;
}

export function buildSpectrumFigure(input: SpectrumFigureInput): Figure {
  const style = SIGNAL_STYLES[input.kind];
  const isDb = input.scale === 'db';
  const shapes = input.toneMarkers.map((marker) => verticalLine(marker.hz, PALETTE.tone, 'dash'));
  const annotations = input.toneMarkers.map((marker) => topLabel(marker.hz, marker.label));
  return {
    data: [
      {
        type: 'scatter',
        mode: 'lines',
        x: input.series.x,
        y: input.series.y,
        name: style.name,
        line: { color: style.color, width: 1.3 },
        hovertemplate: isDb ? 'f = %{x:.1f} Hz<br>%{y:.1f} dB<extra></extra>' : 'f = %{x:.1f} Hz<br>%{y:.4f} u. a.<extra></extra>',
      } as Data,
    ],
    layout: {
      ...baseLayout(input.height),
      xaxis: {
        range: [input.view.f0, input.view.f1],
        autorange: false,
        title: { text: 'Frecuencia (Hz)', standoff: 4 },
        separatethousands: true,
        automargin: false,
        zeroline: false,
      },
      yaxis: {
        range: isDb ? input.dbRange : input.linearRange,
        fixedrange: true,
        title: { text: isDb ? 'Amplitud (dB re 1 u. a.)' : 'Amplitud (u. a.)', standoff: 4 },
        automargin: false,
      },
      shapes,
      annotations,
    },
  };
}

export interface OverviewFigureInput {
  series: Series;
  durationS: number;
  detail: TimeRange;
  fftBand: TimeRange | null;
  height: number;
}

export function buildOverviewFigure(input: OverviewFigureInput): Figure {
  const shapes: Shape[] = [];
  if (input.fftBand) shapes.push(band(input.fftBand, 1000, PALETTE.fftBand));
  shapes.push(band(input.detail, 1000, PALETTE.detailBand, PALETTE.modulated));
  const base = baseLayout(input.height);
  return {
    data: [lineTrace(input.series, SIGNAL_STYLES.modulated, { hoverUnit: 'ms' })],
    layout: {
      ...base,
      margin: { l: 64, r: 16, t: 6, b: 26, pad: 0 },
      hovermode: false,
      clickanywhere: true,
      xaxis: {
        range: [0, input.durationS * 1000],
        autorange: false,
        fixedrange: true,
        separatethousands: true,
        automargin: false,
        ticksuffix: ' ms',
      },
      yaxis: { range: [-1.1, 1.1], fixedrange: true, showticklabels: false, automargin: false, zeroline: false },
      shapes,
    } as Partial<Layout>,
  };
}

export function toneMarkersFor(tones: { carrierHz: number; f0Hz?: number; f1Hz?: number }, kind: SignalKind): ToneMarker[] {
  if (kind === 'nrz' || kind === 'original') return [];
  if (tones.f0Hz !== undefined && tones.f1Hz !== undefined && kind === 'modulated') {
    return [
      { hz: tones.f0Hz, label: `f₀ ${formatHz(tones.f0Hz)}` },
      { hz: tones.f1Hz, label: `f₁ ${formatHz(tones.f1Hz)}` },
    ];
  }
  return [{ hz: tones.carrierHz, label: `f_c ${formatHz(tones.carrierHz)}` }];
}
