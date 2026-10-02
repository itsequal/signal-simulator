import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Config, Data, Layout, PlotlyHTMLElement, PlotMouseEvent, PlotRelayoutEvent } from 'plotly.js-dist-min';
import { getDragMode, setDragMode, subscribeDragMode, type PlotDragMode } from './dragMode';
import { loadPlotly, type PlotlyStatic } from './plotlyLoader';
import { BASE_CONFIG, MARGINS } from './theme';

export interface PlotlyChartProps {
  data: Data[];
  layout: Partial<Layout>;
  config?: Partial<Config>;
  ariaLabel: string;
  testId?: string;
  onRelayout?: (event: PlotRelayoutEvent) => void;
  onClick?: (event: PlotMouseEvent) => void;

  onPlotWidth?: (widthPx: number) => void;
  children?: ReactNode;
}

export function PlotlyChart(props: PlotlyChartProps) {
  const { data, layout, config, ariaLabel, testId, onRelayout, onClick, onPlotWidth, children } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotly, setPlotly] = useState<PlotlyStatic | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dragMode, setLocalDragMode] = useState<PlotDragMode>(getDragMode);
  const handlers = useRef({ onRelayout, onClick, onPlotWidth });

  useEffect(() => {
    handlers.current = { onRelayout, onClick, onPlotWidth };
  }, [onRelayout, onClick, onPlotWidth]);

  useEffect(() => subscribeDragMode(setLocalDragMode), []);

  useEffect(() => {
    let alive = true;
    loadPlotly().then(
      (module) => {
        if (alive) setPlotly(() => module);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    const element = plotRef.current;
    if (!plotly || !element) return;
    void plotly.react(element, data, { ...layout, dragmode: dragMode }, { ...BASE_CONFIG, ...config });
  }, [plotly, data, layout, config, dragMode]);

  useEffect(() => {
    const element = plotRef.current as PlotlyHTMLElement | null;
    if (!plotly || !element) return;
    element.on('plotly_relayout', (event) => {
      if (event.dragmode === 'zoom' || event.dragmode === 'pan') setDragMode(event.dragmode);
      handlers.current.onRelayout?.(event);
    });
    element.on('plotly_click', (event) => handlers.current.onClick?.(event));
    return () => {
      element.removeAllListeners?.('plotly_relayout');
      element.removeAllListeners?.('plotly_click');
      plotly.purge(element);
    };
  }, [plotly]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        handlers.current.onPlotWidth?.(Math.max(1, width - MARGINS.l - MARGINS.r));
        if (plotly && plotRef.current) plotly.Plots.resize(plotRef.current);
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [plotly]);

  return (
    <div className="plot-container" ref={containerRef} data-testid={testId}>
      <div ref={plotRef} className="plot-surface" role="img" aria-label={ariaLabel} />
      {!plotly && !failed && <div className="plot-placeholder">Cargando gráficas…</div>}
      {failed && (
        <div className="plot-placeholder plot-placeholder--error" role="alert">
          No se pudieron cargar las gráficas.{' '}
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
