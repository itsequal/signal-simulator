import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlotMouseEvent, PlotRelayoutEvent } from 'plotly.js-dist-min';
import { FFT_POLICY, SIM_SAMPLE_RATE } from '../../config/constants';
import { formatCount, formatHz, formatMs } from '../../domain/format';
import type { F32, FreqRange, PlaybackTarget, SimulationMeta, Spectrum, TimeRange, TxSpectra } from '../../domain/types';
import { amplitudeToDb, visibleRange } from '../../dsp/spectrum';
import { decimateMinMax, decimateSpectrum } from '../../plots/decimate';
import {
  buildOverviewFigure,
  buildSpectrumFigure,
  buildTxTimeFigure,
  computeBitMarkers,
  symbolLabel,
  toneMarkersFor,
  type BitMarkers,
  type ToneMarker,
} from '../../plots/figures';
import { subscribePlayhead } from '../../audio/playheadClock';
import { Playhead } from '../../plots/Playhead';
import { PlotlyChart } from '../../plots/PlotlyChart';
import { bufferStore, type ResultBuffers } from '../../state/bufferStore';
import { timeViewKey, useLab } from '../../state/LabProvider';
import { MODULATION_LABELS } from '../help/texts';
import { PlayerControls } from '../player/PlayerControls';
import { useIsNarrow } from '../useMediaQuery';
import { DomainSwitch } from './DomainSwitch';
import { SignalRow } from './SignalRow';
import {
  centerView,
  defaultFreqView,
  defaultTimeView,
  panView,
  relayoutXRange,
  sameTimeRange,
  zoomView,
} from './views';

const F = SIM_SAMPLE_RATE;
const TIME_HEIGHT = 190;
const FREQ_HEIGHT = 190;
const OVERVIEW_HEIGHT = 74;
const TX_TARGETS: PlaybackTarget[] = ['carrier', 'modulated'];
const Y_RANGES = { nrz: [-0.1, 1.15] as [number, number], wave: [-1.12, 1.12] as [number, number] };

export function SignalsArea() {
  const { state, derived } = useLab();
  const meta = state.result.meta;
  const result = meta ? bufferStore.results.get(meta.resultId) : undefined;
  if (!meta || !result) {
    if (derived.status.kind === 'empty' || derived.status.kind === 'error') return null;
    return (
      <section className="signals signals--empty" aria-label="Señales" data-testid="signals">
        <p>Generando señales…</p>
      </section>
    );
  }
  return <SignalsContent meta={meta} result={result} />;
}

function SignalsContent({ meta, result }: { meta: SimulationMeta; result: ResultBuffers }) {
  const { state, derived, actions } = useLab();
  const narrow = useIsNarrow();
  const [timeWidth, setTimeWidth] = useState(600);
  const [freqWidth, setFreqWidth] = useState(420);
  const [overviewWidth, setOverviewWidth] = useState(900);

  const bitRate = meta.config.params.bitRate;
  const modulation = meta.config.modulation;
  const shapeKey = timeViewKey(meta.sampleCount);
  const storedView = state.view.timeView;
  const view = useMemo(
    () => (storedView?.forKey === shapeKey ? storedView.value : defaultTimeView(meta.durationS, bitRate)),
    [storedView, shapeKey, meta.durationS, bitRate],
  );

  const custom = state.view.txSpectrum?.ownerId === meta.resultId ? state.view.txSpectrum : null;
  const spectra: TxSpectra | null = (custom && bufferStore.txSpectra.get(custom.key)) || result.spectra;
  const fftBand = useMemo<TimeRange | null>(
    () => (spectra ? { t0: spectra.range.start / F, t1: (spectra.range.start + spectra.range.length) / F } : null),
    [spectra],
  );

  const freqDefault = useMemo(() => defaultFreqView(meta.tones, bitRate, F), [meta.tones, bitRate]);
  const freqKey = `freq:${freqDefault.f1}`;
  const freqView = state.view.freqView?.forKey === freqKey ? state.view.freqView.value : freqDefault;

  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (!state.view.followPlayhead) return;
    return subscribePlayhead((frame) => {
      if (!frame || (frame.target !== 'carrier' && frame.target !== 'modulated')) return;
      const current = viewRef.current;
      const margin = (current.t1 - current.t0) * 0.08;
      if (frame.positionS < current.t0 + margin || frame.positionS > current.t1 - margin) {
        actions.setTimeView(centerView(current, frame.positionS, meta.durationS));
      }
    });
  }, [state.view.followPlayhead, actions, meta.durationS]);

  const bits = result.buffers.bits;
  const nrzMarkers = useMemo(
    () => computeBitMarkers(bits, bitRate, view, timeWidth, (bit) => String(bit)),
    [bits, bitRate, view, timeWidth],
  );
  const carrierMarkers = useMemo<BitMarkers | null>(
    () => (nrzMarkers ? { boundariesS: nrzMarkers.boundariesS, labels: [] } : null),
    [nrzMarkers],
  );
  const modulatedMarkers = useMemo(
    () => computeBitMarkers(bits, bitRate, view, timeWidth, (bit) => symbolLabel(modulation, bit)),
    [bits, bitRate, view, timeWidth, modulation],
  );

  const onTimeRelayout = useCallback(
    (event: PlotRelayoutEvent) => {
      const { range, autorange } = relayoutXRange(event as unknown as Record<string, unknown>);
      if (range) {
        const next = { t0: range[0] / 1000, t1: range[1] / 1000 };
        if (!sameTimeRange(next, view)) actions.setTimeView(next);
      } else if (autorange) {
        actions.setTimeView(null);
      }
    },
    [actions, view],
  );
  const onFreqRelayout = useCallback(
    (event: PlotRelayoutEvent) => {
      const { range, autorange } = relayoutXRange(event as unknown as Record<string, unknown>);
      if (range) actions.setFreqView({ f0: Math.max(0, range[0]), f1: Math.min(F / 2, range[1]) }, freqKey);
      else if (autorange) actions.setFreqView(freqDefault, freqKey);
    },
    [actions, freqKey, freqDefault],
  );
  const centerAt = useCallback((t: number) => actions.setTimeView(centerView(view, t, meta.durationS)), [actions, view, meta.durationS]);

  const stale = !derived.resultMatches;
  const showTime = !narrow || state.view.domain === 'time';
  const showFreq = !narrow || state.view.domain === 'frequency';
  const scale = state.view.txScale;
  const { tones } = meta;
  const showReference = modulation === 'bpsk' && state.view.showBpskReference;
  const viewLabel = `vista de ${formatMs(view.t0)} a ${formatMs(view.t1)}`;

  const timePlot = (kind: 'nrz' | 'carrier' | 'modulated', markers: BitMarkers | null, label: string, reference?: F32) =>
    showTime ? (
      <TxTimePlot
        kind={kind}
        samples={result.buffers[kind]}
        reference={reference}
        view={view}
        width={timeWidth}
        markers={markers}
        fftBand={fftBand}
        ariaLabel={`${label} en el tiempo, ${viewLabel}`}
        onRelayout={onTimeRelayout}
        onWidth={setTimeWidth}
      />
    ) : undefined;

  const spectrumPlot = (kind: 'nrz' | 'carrier' | 'modulated', label: string) =>
    showFreq ? (
      spectra ? (
        <TxSpectrumPlot
          kind={kind}
          spectrum={spectra[kind]}
          view={freqView}
          width={freqWidth}
          scale={scale}
          markers={toneMarkersFor(tones, kind)}
          ariaLabel={`Espectro de ${label} de ${formatHz(freqView.f0)} a ${formatHz(freqView.f1)}`}
          onRelayout={onFreqRelayout}
          onWidth={setFreqWidth}
        />
      ) : (
        <p className="plot-message">Intervalo demasiado corto para calcular el espectro.</p>
      )
    ) : undefined;

  return (
    <section className={`signals${stale ? ' is-stale' : ''}`} aria-label="Señales" data-testid="signals" data-result-key={meta.configKey}>
      {stale && (
        <div className="stale-banner" role="status" data-testid="stale-banner">
          Resultado desactualizado.
        </div>
      )}
      <ViewToolbar meta={meta} view={view} hasCustom={Boolean(custom)} />
      <OverviewStrip
        samples={result.buffers.modulated}
        durationS={meta.durationS}
        view={view}
        fftBand={fftBand}
        width={overviewWidth}
        onWidth={setOverviewWidth}
        onCenter={centerAt}
      />
      {narrow && <DomainSwitch />}
      <SignalRow
        kind="nrz"
        title="Modulante NRZ"
        time={timePlot('nrz', nrzMarkers, 'Modulante NRZ')}
        spectrum={spectrumPlot('nrz', 'la modulante NRZ')}
      />
      <SignalRow
        kind="carrier"
        title="Portadora"
        player={<PlayerControls target="carrier" />}
        time={timePlot('carrier', carrierMarkers, 'Portadora')}
        spectrum={spectrumPlot('carrier', 'la portadora')}
      />
      <SignalRow
        kind="modulated"
        title={MODULATION_LABELS[modulation]}
        player={<PlayerControls target="modulated" />}
        time={timePlot('modulated', modulatedMarkers, `Señal modulada ${MODULATION_LABELS[modulation]}`, showReference ? result.buffers.carrier : undefined)}
        spectrum={spectrumPlot('modulated', 'la señal modulada')}
      />
    </section>
  );
}

interface TxTimePlotProps {
  kind: 'nrz' | 'carrier' | 'modulated';
  samples: F32;
  reference?: F32;
  view: TimeRange;
  width: number;
  markers: BitMarkers | null;
  fftBand: TimeRange | null;
  ariaLabel: string;
  onRelayout: (event: PlotRelayoutEvent) => void;
  onWidth: (width: number) => void;
}

const TxTimePlot = memo(function TxTimePlot(props: TxTimePlotProps) {
  const { kind, samples, reference, view, width, markers, fftBand } = props;
  const series = useMemo(() => decimateMinMax(samples, F, view.t0, view.t1, width), [samples, view.t0, view.t1, width]);
  const referenceSeries = useMemo(
    () => (reference ? decimateMinMax(reference, F, view.t0, view.t1, width) : null),
    [reference, view.t0, view.t1, width],
  );
  const figure = useMemo(
    () =>
      buildTxTimeFigure({
        kind,
        series,
        reference: referenceSeries,
        view,
        height: TIME_HEIGHT,
        markers,
        fftBand,
        yRange: kind === 'nrz' ? Y_RANGES.nrz : Y_RANGES.wave,
      }),
    [kind, series, referenceSeries, view, markers, fftBand],
  );
  return (
    <figure className="plot plot--time">
      <PlotlyChart
        data={figure.data}
        layout={figure.layout}
        ariaLabel={props.ariaLabel}
        testId={`plot-time-${kind}`}
        onRelayout={props.onRelayout}
        onPlotWidth={props.onWidth}
      >
        <Playhead targets={TX_TARGETS} view={view} widthPx={width} />
      </PlotlyChart>
    </figure>
  );
});

interface TxSpectrumPlotProps {
  kind: 'nrz' | 'carrier' | 'modulated';
  spectrum: Spectrum;
  view: FreqRange;
  width: number;
  scale: 'linear' | 'db';
  markers: ToneMarker[];
  ariaLabel: string;
  onRelayout: (event: PlotRelayoutEvent) => void;
  onWidth: (width: number) => void;
}

const TxSpectrumPlot = memo(function TxSpectrumPlot(props: TxSpectrumPlotProps) {
  const { kind, spectrum, view, width, scale, markers } = props;
  const series = useMemo(
    () =>
      decimateSpectrum(spectrum.amplitude, spectrum.meta.binHz, view.f0, view.f1, width, scale === 'db' ? amplitudeToDb : undefined),
    [spectrum, view.f0, view.f1, width, scale],
  );
  const figure = useMemo(
    () =>
      buildSpectrumFigure({
        kind,
        series,
        view,
        scale,
        linearRange: [0, 1.05],
        dbRange: [-100, 5],
        toneMarkers: markers,
        height: FREQ_HEIGHT,
      }),
    [kind, series, view, scale, markers],
  );
  return (
    <figure className="plot plot--freq">
      <PlotlyChart
        data={figure.data}
        layout={figure.layout}
        ariaLabel={props.ariaLabel}
        testId={`plot-freq-${kind}`}
        onRelayout={props.onRelayout}
        onPlotWidth={props.onWidth}
      />
    </figure>
  );
});

interface OverviewProps {
  samples: F32;
  durationS: number;
  view: TimeRange;
  fftBand: TimeRange | null;
  width: number;
  onWidth: (width: number) => void;
  onCenter: (t: number) => void;
}

function OverviewStrip({ samples, durationS, view, fftBand, width, onWidth, onCenter }: OverviewProps) {
  const series = useMemo(() => decimateMinMax(samples, F, 0, durationS, width), [samples, durationS, width]);
  const figure = useMemo(
    () => buildOverviewFigure({ series, durationS, detail: view, fftBand, height: OVERVIEW_HEIGHT }),
    [series, durationS, view, fftBand],
  );
  const fullView = useMemo(() => ({ t0: 0, t1: durationS }), [durationS]);
  const onClick = useCallback(
    (event: PlotMouseEvent) => {

      const x = (event as PlotMouseEvent & { xvals?: unknown[] }).xvals?.[0] ?? event.points?.[0]?.x;
      if (typeof x === 'number') onCenter(x / 1000);
    },
    [onCenter],
  );
  return (
    <figure className="plot plot--overview">
      <PlotlyChart
        data={figure.data}
        layout={figure.layout}
        config={{ displayModeBar: false }}
        ariaLabel={`Vista general de la señal modulada, ${formatMs(durationS)} en total`}
        testId="plot-overview"
        onClick={onClick}
        onPlotWidth={onWidth}
      >
        <Playhead targets={TX_TARGETS} view={fullView} widthPx={width} />
      </PlotlyChart>
    </figure>
  );
}

interface ToolbarProps {
  meta: SimulationMeta;
  view: TimeRange;
  hasCustom: boolean;
}

function ViewToolbar({ meta, view, hasCustom }: ToolbarProps) {
  const { state, actions } = useLab();
  const [bitInput, setBitInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const bitRate = meta.config.params.bitRate;
  const durationS = meta.durationS;
  const minSpan = 4 / F;
  const firstK = meta.selection.start;
  const lastK = meta.selection.start + meta.selection.length - 1;
  const goToBit = () => {
    const k = Number(bitInput);
    if (!Number.isInteger(k) || k < firstK || k > lastK) {
      setMessage(`Introduce un índice de bit entre ${formatCount(firstK)} y ${formatCount(lastK)}.`);
      return;
    }
    setMessage(null);
    actions.setTimeView(centerView(view, (k - firstK + 0.5) / bitRate, durationS));
  };

  const analyzeVisible = () => {
    const visible = visibleRange(view.t0, view.t1, F, meta.sampleCount);
    if (visible.range.length < FFT_POLICY.minLength) {
      setMessage(`El intervalo visible tiene ${visible.range.length} muestras; el mínimo para el espectro es ${FFT_POLICY.minLength}.`);
      return;
    }
    setMessage(null);
    actions.analyzeTxRange(visible.range, visible.clamped ? visible.visibleLength : null);
  };

  return (
    <div className="lab-toolbar">
      <div className="toolbar" role="toolbar" aria-label="Vista temporal">
        <button type="button" className="button" onClick={() => actions.setTimeView(null)}>
          Vista completa
        </button>
        <button type="button" className="button" onClick={() => actions.setTimeView(defaultTimeView(durationS, bitRate))}>
          Primeros 32 bits
        </button>
        <button
          type="button"
          className="button"
          aria-label="Desplazar la vista a la izquierda"
          disabled={view.t0 <= 0}
          onClick={() => actions.setTimeView(panView(view, -1, durationS))}
        >
          ◀
        </button>
        <button
          type="button"
          className="button"
          aria-label="Desplazar la vista a la derecha"
          disabled={view.t1 >= durationS}
          onClick={() => actions.setTimeView(panView(view, 1, durationS))}
        >
          ▶
        </button>
        <button type="button" className="button" onClick={() => actions.setTimeView(zoomView(view, 0.5, durationS, minSpan))}>
          Acercar
        </button>
        <button type="button" className="button" onClick={() => actions.setTimeView(zoomView(view, 2, durationS, minSpan))}>
          Alejar
        </button>
        <span className="toolbar__inline">
          <label htmlFor="go-to-bit">Ir al bit k</label>
          <input
            id="go-to-bit"
            type="number"
            inputMode="numeric"
            min={firstK}
            max={lastK}
            value={bitInput}
            onChange={(event) => setBitInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') goToBit();
            }}
          />
          <button type="button" className="button" onClick={goToBit}>
            Ir
          </button>
        </span>
        <label className="toolbar__inline">
          <input
            type="checkbox"
            checked={state.view.followPlayhead}
            onChange={(event) => actions.setFollow(event.target.checked)}
          />
          Seguir el cursor
        </label>
        {meta.config.modulation === 'bpsk' && (
          <label className="toolbar__inline">
            <input
              type="checkbox"
              checked={state.view.showBpskReference}
              onChange={(event) => actions.setBpskReference(event.target.checked)}
            />
            Superponer la portadora de referencia
          </label>
        )}
      </div>
      <div className="toolbar" role="toolbar" aria-label="Espectro">
        <fieldset className="segmented-field segmented-field--inline">
          <legend>Escala del espectro</legend>
          <div className="segmented" role="radiogroup" aria-label="Escala del espectro">
            {(['linear', 'db'] as const).map((value) => (
              <label key={value} className={`segmented__option${state.view.txScale === value ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="tx-scale"
                  value={value}
                  checked={state.view.txScale === value}
                  onChange={() => actions.setTxScale(value)}
                />
                {value === 'linear' ? 'Lineal (u. a.)' : 'dB re 1 u. a.'}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" className="button" onClick={analyzeVisible}>
          Analizar el intervalo visible
        </button>
        <button type="button" className="button" disabled={!hasCustom} onClick={() => actions.resetTxSpectrum()}>
          Intervalo FFT por defecto
        </button>
      </div>
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

