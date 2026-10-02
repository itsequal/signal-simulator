import { useId } from 'react';
import { BINARY_EXAMPLES } from '../../config/constants';
import { useLab } from '../../state/LabProvider';

export function BinaryInput() {
  const { state, derived, actions } = useLab();
  const id = useId();
  const source = derived.source;
  const errorId = `${id}-error`;
  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="panel__title">
        2. Secuencia binaria
      </h2>
      <label htmlFor={`${id}-input`} className="field-label">
        Bits (0 y 1)
      </label>
      <textarea
        id={`${id}-input`}
        className="mono-input"
        rows={4}
        spellCheck={false}
        autoComplete="off"
        value={state.binaryRaw}
        placeholder="Ej.: 1011 0010 1110 0001"
        aria-invalid={source.status === 'error'}
        aria-describedby={errorId}
        onChange={(event) => actions.setBinaryRaw(event.target.value)}
      />
      <div id={errorId} aria-live="polite">
        {source.status === 'error' && source.issue && <p className="field-error">{source.issue.message}</p>}
        {source.status === 'empty' && <p className="field-error">Introduce al menos un bit (0 o 1) para simular.</p>}
      </div>
      <label htmlFor={`${id}-examples`} className="field-label">
        Ejemplos
      </label>
      <select
        id={`${id}-examples`}
        value=""
        onChange={(event) => {
          const example = BINARY_EXAMPLES.find((item) => item.id === event.target.value);
          if (example) actions.setBinaryRaw(example.bits);
        }}
      >
        <option value="">Cargar un ejemplo…</option>
        {BINARY_EXAMPLES.map((example) => (
          <option key={example.id} value={example.id}>
            {example.label}: {example.bits}
          </option>
        ))}
      </select>
    </section>
  );
}
