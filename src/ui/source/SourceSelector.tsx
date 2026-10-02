import { SOURCE_KINDS } from '../../config/constants';
import { useLab } from '../../state/LabProvider';
import { SOURCE_LABELS } from '../help/texts';

export function SourceSelector() {
  const { state, derived, actions } = useLab();
  const disabled = !derived.controls.sourceSwitch;
  return (
    <fieldset className="panel segmented-field">
      <legend>1. Fuente de los bits</legend>
      <div className="segmented" role="radiogroup" aria-label="Fuente de los bits">
        {SOURCE_KINDS.map((kind) => (
          <label key={kind} className={`segmented__option${state.sourceKind === kind ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="source-kind"
              value={kind}
              checked={state.sourceKind === kind}
              disabled={disabled && state.sourceKind !== kind}
              onChange={() => actions.setSourceKind(kind)}
            />
            {SOURCE_LABELS[kind]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
