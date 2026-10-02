import { useId } from 'react';
import type { ValidationIssue } from '../../domain/types';
import { InfoToggle } from '../help/InfoToggle';
import type { GlossaryEntry } from '../help/texts';

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  inputMode?: 'numeric' | 'decimal';
  slider?: { min: number; max: number; step: number };
  issue?: ValidationIssue;
  help?: GlossaryEntry;
  testId?: string;
}


export function NumberField({ label, value, onChange, unit, inputMode = 'numeric', slider, issue, help, testId }: NumberFieldProps) {
  const id = useId();
  const parsed = Number(value.trim().replace(',', '.'));
  const sliderValue = slider ? (Number.isFinite(parsed) ? Math.min(slider.max, Math.max(slider.min, parsed)) : slider.min) : 0;
  return (
    <div className="number-field" data-testid={testId}>
      <label htmlFor={`${id}-input`} className="field-label">
        {label}
        {help && <InfoToggle entry={help} />}
      </label>
      <div className="field-row">
        <input
          id={`${id}-input`}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(issue)}
          aria-describedby={issue ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
      {slider && (
        <input
          type="range"
          className="number-field__slider"
          aria-label={`${label} (deslizador)`}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={sliderValue}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {issue && (
        <p id={`${id}-error`} className="field-error">
          {issue.message}
        </p>
      )}
    </div>
  );
}
