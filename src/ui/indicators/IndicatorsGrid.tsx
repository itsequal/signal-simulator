import { useLab } from '../../state/LabProvider';
import { computeIndicators } from './indicators';

export function IndicatorsGrid() {
  const { state, derived } = useLab();
  const meta = state.result.meta;
  const current = derived.config && derived.selection && derived.source.data;
  const params = current ? derived.config?.params : meta?.config.params;
  const modulation = current ? state.modulation : meta?.config.modulation;
  const selection = current ? derived.selection : meta?.selection;
  const totalBits = current ? derived.source.data?.totalBits : meta?.totalBits;
  if (!params || !modulation || !selection || totalBits === undefined) {
    return <section className="indicators" aria-label="Indicadores" />;
  }
  const groups = computeIndicators({
    modulation,
    params,
    selectionStart: selection.start,
    selectionLength: selection.length,
    totalBits,
    sourceKind: current ? state.sourceKind : (meta?.sourceKind ?? state.sourceKind),
    textStats: derived.source.textStats,
    recording: state.mic.recording,
    pcm: state.mic.pcm,
  });
  return (
    <section className="indicators" aria-label="Indicadores" data-testid="indicators">
      <div className="indicators__groups">
        {groups.map((group) => (
          <div key={group.id} className="indicators__group">
            <h3>{group.title}</h3>
            <dl>
              {group.items.map((item) => (
                <div key={item.id} className="indicator" data-indicator={item.id}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
