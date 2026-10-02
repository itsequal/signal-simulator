import type PlotlyNamespace from 'plotly.js-dist-min';

export type PlotlyStatic = typeof PlotlyNamespace;

let loading: Promise<PlotlyStatic> | null = null;

export function loadPlotly(): Promise<PlotlyStatic> {
  loading ??= Promise.all([import('plotly.js-basic-dist-min'), import('plotly.js-locales/es')])
    .then(([plotlyModule, localeModule]) => {
      const Plotly =
        (plotlyModule as { default?: PlotlyStatic }).default ?? (plotlyModule as unknown as PlotlyStatic);
      const locale = (localeModule as { default?: unknown }).default ?? localeModule;
      Plotly.register(locale as Parameters<PlotlyStatic['register']>[0]);
      Plotly.setPlotConfig({ locale: 'es' });
      return Plotly;
    })
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}
