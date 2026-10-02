import { useMemo, useState } from 'react';
import type { PlotRelayoutEvent } from 'plotly.js-dist-min';
import type { Spectrum } from '../../domain/types';
import { amplitudeToDb } from '../../dsp/spectrum';
import { decimateMinMax, decimateSpectrum } from '../../plots/decimate';
import { buildSpectrumFigure, buildTxTimeFigure } from '../../plots/figures';
import { PlotlyChart } from '../../plots/PlotlyChart';
import { pcmSpanForSelection } from '../../sources/selection';
import { bufferStore } from '../../state/bufferStore';
import { useLab } from '../../state/LabProvider';
import { SignalRow } from './SignalRow';
import { relayoutXRange } from './views';

export function OriginalArea() {
  const { state, derived, actions } = useLab();
  const recording = state.mic.recording;
  const samples = recording ? bufferStore.recordings.get(recording.id) : undefined;
  const [width, setWidth] = useState(700);
  if (state.sourceKind !== 'microphone' || !recording || !samples) return null;
  const stored = state.view.originalTimeView;
  const view = stored?.forKey === recording.id ? stored.value : { t0: 0, t1: recording.durationS };
  const selection = derived.selection;
  const span = state.sourceKind === 'microphone' && selection && derived.source.data ? pcmSpanForSelection(selection) : null;
  const spectrum = state.mic.originalSpectrum ? bufferStore.mic.get(state.mic.sourceId ?? '')?.originalSpectrum : null;
  return (
    <section className="signals" aria-label="Audio original">
      <SignalRow
        kind="original"
        title="Audio original"
        time={
          <OriginalTime
            samples={samples}
            sampleRate={recording.sampleRate}
            view={view}
            width={width}
            highlight={span}
            onWidth={setWidth}
            onRelayout={(event) => {
              const parsed = relayoutXRange(event as unknown as Record<string, unknown>);
              if (parsed.range) actions.setOriginalTimeView({ t0: parsed.range[0] / 1000, t1: parsed.range[1] / 1000 });
              else if (parsed.autorange) actions.setOriginalTimeView(null);
            }}
          />
        }
        spectrum={
          spectrum ? (
            <OriginalSpectrum spectrum={spectrum} sampleRate={recording.sampleRate} scale={state.view.originalScale} />
          ) : null
        }
      />
    </section>
  );
}

function OriginalTime({
  samples,
  sampleRate,
  view,
  width,
  highlight,
  onWidth,
  onRelayout,
}: {
  samples: Float32Array;
  sampleRate: number;
  view: { t0: number; t1: number };
  width: number;
  highlight: { startS: number; endS: number } | null;
  onWidth: (width: number) => void;
  onRelayout: (event: PlotRelayoutEvent) => void;
}) {
  const series = useMemo(
    () => decimateMinMax(samples, sampleRate, view.t0, view.t1, width),
    [samples, sampleRate, view, width],
  );
  const figure = useMemo(
    () =>
      buildTxTimeFigure({
        kind: 'original',
        series,
        view,
        height: 180,
        markers: null,
        fftBand: highlight ? { t0: highlight.startS, t1: highlight.endS } : null,
        yRange: [-1.12, 1.12],
      }),
    [series, view, highlight],
  );
  return (
    <PlotlyChart data={figure.data} layout={figure.layout} ariaLabel="Audio original en el tiempo" testId="plot-original-time" onRelayout={onRelayout} onPlotWidth={onWidth} />
  );
}

function OriginalSpectrum({
  spectrum,
  sampleRate,
  scale,
}: {
  spectrum: Spectrum | null;
  sampleRate: number;
  scale: 'linear' | 'db';
}) {
  const data = spectrum;
  const [width, setWidth] = useState(420);
  const series = useMemo(() => {
    if (!data) return null;
    return decimateSpectrum(data.amplitude, data.meta.binHz, 0, sampleRate / 2, width, scale === 'db' ? amplitudeToDb : undefined);
  }, [data, sampleRate, width, scale]);
  if (!data || !series) return null;
  const figure = buildSpectrumFigure({
    kind: 'original',
    series,
    view: { f0: 0, f1: sampleRate / 2 },
    scale,
    linearRange: [0, Math.max(0.05, Math.max(...series.y) * 1.1)],
    dbRange: [-100, 5],
    toneMarkers: [],
    height: 180,
  });
  return (
    <figure className="plot">
      <PlotlyChart data={figure.data} layout={figure.layout} ariaLabel="Espectro del audio original" testId="plot-original-freq" onPlotWidth={setWidth} />
    </figure>
  );
}
