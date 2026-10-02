import { useLab } from '../../state/LabProvider';

export function DomainSwitch() {
  const { state, actions } = useLab();
  return (
    <fieldset className="segmented-field domain-switch">
      <legend className="sr-only">Dominio de las gráficas</legend>
      <div className="segmented" role="radiogroup" aria-label="Dominio de las gráficas">
        {(['time', 'frequency'] as const).map((domain) => (
          <label key={domain} className={`segmented__option${state.view.domain === domain ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="domain"
              value={domain}
              checked={state.view.domain === domain}
              onChange={() => actions.setDomain(domain)}
            />
            {domain === 'time' ? 'Tiempo' : 'Frecuencia'}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
