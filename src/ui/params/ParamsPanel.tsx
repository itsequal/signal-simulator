import { useId } from 'react';
import { BIT_RATES, RANGES, SIM_SAMPLE_RATE, type BitRate } from '../../config/constants';
import { formatCount } from '../../domain/format';
import { useLab } from '../../state/LabProvider';
import { NumberField } from './NumberField';

export function ParamsPanel() {
  const { state, derived, actions } = useLab();
  const id = useId();
  const byField = derived.paramValidation.byField;
  const fsk = state.modulation === 'fsk';
  const ask = state.modulation === 'ask';
  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="panel__title">
        4. Parámetros
      </h2>
      <NumberField
        label="Frecuencia de portadora f_c"
        unit="Hz"
        value={state.params.carrierHz}
        onChange={(value) => actions.setParam('carrierHz', value)}
        slider={{ min: RANGES.carrierHz.min, max: RANGES.carrierHz.max, step: 10 }}
        issue={byField.carrierHz}
        testId="field-carrier"
      />
      <label htmlFor={`${id}-rate`} className="field-label">
        Tasa de bits R_b
      </label>
      <select
        id={`${id}-rate`}
        value={state.params.bitRate}
        onChange={(event) => actions.setBitRate(Number(event.target.value) as BitRate)}
        aria-describedby={derived.durationIssue ? `${id}-duration` : undefined}
      >
        {BIT_RATES.map((rate) => (
          <option key={rate} value={rate}>
            {formatCount(rate)} bit/s ({formatCount(SIM_SAMPLE_RATE / rate)} muestras por bit)
          </option>
        ))}
      </select>
      {derived.durationIssue && (
        <p id={`${id}-duration`} className="field-error">
          {derived.durationIssue.message}
        </p>
      )}
      {fsk && (
        <>
          <NumberField
            label="Desviación Δf (FSK)"
            unit="Hz"
            value={state.params.deltaHz}
            onChange={(value) => actions.setParam('deltaHz', value)}
            slider={{ min: RANGES.deltaHz.min, max: RANGES.deltaHz.max, step: 5 }}
            issue={byField.deltaHz}
            testId="field-delta"
          />
        </>
      )}
      {ask && (
        <div className="field-pair">
          <NumberField
            label="Amplitud A₀ (bit 0)"
            inputMode="decimal"
            value={state.params.a0}
            onChange={(value) => actions.setParam('a0', value)}
            issue={byField.a0}
            testId="field-a0"
          />
          <NumberField
            label="Amplitud A₁ (bit 1)"
            inputMode="decimal"
            value={state.params.a1}
            onChange={(value) => actions.setParam('a1', value)}
            issue={byField.a1}
            testId="field-a1"
          />
        </div>
      )}
      {byField.tones && <p className="field-error">{byField.tones.message}</p>}
      <button type="button" className="button" onClick={() => actions.resetParams()}>
        Restablecer valores iniciales
      </button>
    </section>
  );
}
