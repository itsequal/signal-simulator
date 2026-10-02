import { MODULATIONS } from '../../config/constants';
import { useLab } from '../../state/LabProvider';
import { MODULATION_LABELS } from '../help/texts';

export function ModulationSelector() {
  const { state, actions } = useLab();
  return (
    <section className="modulation-bar" aria-label="Modulación">
      <fieldset className="segmented-field">
        <legend>Modulación</legend>
        <div className="segmented segmented--large" role="radiogroup" aria-label="Modulación">
          {MODULATIONS.map((modulation) => (
            <label key={modulation} className={`segmented__option${state.modulation === modulation ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="modulation"
                value={modulation}
                checked={state.modulation === modulation}
                onChange={() => actions.setModulation(modulation)}
              />
              {MODULATION_LABELS[modulation]}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
