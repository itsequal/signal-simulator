import type { Config, Layout } from 'plotly.js-dist-min';
import { PALETTE } from '../config/constants';
import type { SignalKind } from '../domain/types';

export const MARGINS = { l: 64, r: 16, t: 30, b: 40 } as const;

export interface SignalStyle {
  name: string;
  short: string;
  color: string;
  dash: 'solid' | 'dash' | 'dot' | 'dashdot';
  width: number;
}

export const SIGNAL_STYLES: Record<SignalKind | 'reference', SignalStyle> = {
  nrz: { name: 'Modulante NRZ b(t)', short: 'NRZ', color: PALETTE.nrz, dash: 'solid', width: 1.6 },
  carrier: { name: 'Portadora c(t)', short: 'Portadora', color: PALETTE.carrier, dash: 'dash', width: 1.4 },
  modulated: { name: 'Señal modulada s(t)', short: 'Modulada', color: PALETTE.modulated, dash: 'solid', width: 1.6 },
  original: { name: 'Audio original x(t)', short: 'Original', color: PALETTE.original, dash: 'solid', width: 1.2 },
  reference: { name: 'Portadora de referencia c(t)', short: 'Referencia', color: PALETTE.carrier, dash: 'dot', width: 1.2 },
};

export const BASE_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: false,
  scrollZoom: false,
  doubleClick: 'reset',
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
  locale: 'es',
};

export function baseLayout(height: number): Partial<Layout> {
  return {
    height,
    autosize: true,
    margin: { ...MARGINS, pad: 0 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    font: { family: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', size: 12, color: PALETTE.text },
    showlegend: false,
    hovermode: 'closest',
    separators: ', ',
  };
}
