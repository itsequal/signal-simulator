import { BIT_RATES, DEFAULTS, RANGES, SIM_SAMPLE_RATE, type BitRate } from '../config/constants';
import { formatCount, formatDecimal } from '../domain/format';
import type { IssueField, ModulationKind, ModulationParams, ValidationIssue } from '../domain/types';

export interface RawParams {
  carrierHz: string;
  bitRate: BitRate;
  deltaHz: string;
  a0: string;
  a1: string;
}

export function defaultRawParams(): RawParams {
  return {
    carrierHz: String(DEFAULTS.carrierHz),
    bitRate: DEFAULTS.bitRate,
    deltaHz: String(DEFAULTS.deltaHz),
    a0: String(DEFAULTS.a0),
    a1: String(DEFAULTS.a1),
  };
}

export interface ParamValidation {
  params: ModulationParams | null;
  issues: ValidationIssue[];
  byField: Partial<Record<IssueField, ValidationIssue>>;
}

function error(code: string, field: IssueField, message: string): ValidationIssue {
  return { code, severity: 'error', field, message };
}

function parseNumber(raw: string): number {
  return Number(raw.trim().replace(',', '.'));
}

function parseHz(
  raw: string,
  field: 'carrierHz' | 'deltaHz',
  prefix: 'FC' | 'DF',
  label: string,
  range: { min: number; max: number },
): { value?: number; issue?: ValidationIssue } {
  const text = raw.trim();
  if (text === '') return { issue: error(`E-${prefix}-EMPTY`, field, `Introduce ${label}.`) };
  const value = parseNumber(text);
  if (!Number.isFinite(value)) {
    return { issue: error(`E-${prefix}-NAN`, field, `${capitalize(label)} debe ser un número finito (se leyó «${text}»).`) };
  }
  if (value < 0) return { issue: error(`E-${prefix}-NEG`, field, `${capitalize(label)} no puede ser negativa.`) };
  if (!Number.isInteger(value)) {
    return { issue: error(`E-${prefix}-INT`, field, `${capitalize(label)} se introduce en hercios enteros.`) };
  }
  if (value < range.min || value > range.max) {
    return {
      issue: error(
        `E-${prefix}-RANGE`,
        field,
        `${capitalize(label)} debe estar entre ${formatCount(range.min)} y ${formatCount(range.max)} Hz (rango didáctico).`,
      ),
    };
  }
  return { value };
}

function parseAmplitude(raw: string, field: 'a0' | 'a1', label: string): { value?: number; issue?: ValidationIssue } {
  const text = raw.trim();
  if (text === '') return { issue: error('E-A-EMPTY', field, `Introduce la amplitud ${label}.`) };
  const value = parseNumber(text);
  if (!Number.isFinite(value)) return { issue: error('E-A-NAN', field, `La amplitud ${label} debe ser un número finito.`) };
  return { value };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function validateParams(raw: RawParams, modulation: ModulationKind): ParamValidation {
  const issues: ValidationIssue[] = [];
  const nyquist = SIM_SAMPLE_RATE / 2;

  const carrier = parseHz(raw.carrierHz, 'carrierHz', 'FC', 'la frecuencia de portadora f_c', RANGES.carrierHz);
  if (carrier.issue) issues.push(carrier.issue);

  const bitRateValid = (BIT_RATES as readonly number[]).includes(raw.bitRate);
  if (!bitRateValid || !Number.isInteger(SIM_SAMPLE_RATE / raw.bitRate)) {
    issues.push(error('E-RB', 'bitRate', `La tasa ${raw.bitRate} bit/s no está entre las disponibles.`));
  }

  let deltaHz = Number.NaN;
  if (modulation === 'fsk') {
    const delta = parseHz(raw.deltaHz, 'deltaHz', 'DF', 'la desviación Δf', RANGES.deltaHz);
    if (delta.issue) issues.push(delta.issue);
    if (delta.value !== undefined) deltaHz = delta.value;
    if (carrier.value !== undefined && delta.value !== undefined) {
      const f0 = carrier.value - delta.value;
      const f1 = carrier.value + delta.value;
      if (f0 <= 0) {
        issues.push(
          error('E-F0-NONPOS', 'deltaHz', `f₀ = f_c − Δf debe ser mayor que 0 Hz (ahora: ${formatDecimal(f0)} Hz). Reduce Δf o aumenta f_c.`),
        );
      }
      if (f1 >= nyquist) {
        issues.push(error('E-TONE-NYQ', 'tones', `f₁ = ${formatCount(f1)} Hz no es menor que la mitad de F_sim (${formatCount(nyquist)} Hz).`));
      }
    }
  } else {
    const delta = Number(raw.deltaHz);
    deltaHz = Number.isFinite(delta) ? delta : DEFAULTS.deltaHz;
    if (carrier.value !== undefined && carrier.value >= nyquist) {
      issues.push(error('E-TONE-NYQ', 'tones', `f_c no es menor que la mitad de F_sim (${formatCount(nyquist)} Hz).`));
    }
  }

  let a0 = DEFAULTS.a0;
  let a1 = DEFAULTS.a1;
  if (modulation === 'ask') {
    const p0 = parseAmplitude(raw.a0, 'a0', 'A₀');
    const p1 = parseAmplitude(raw.a1, 'a1', 'A₁');
    if (p0.issue) issues.push(p0.issue);
    if (p1.issue) issues.push(p1.issue);
    if (p0.value !== undefined && p0.value <= 0) {
      issues.push(error('E-A0-NONPOS', 'a0', 'A₀ debe ser mayor que 0; con A₀ = 0 la modulación sería OOK.'));
    }
    if (p1.value !== undefined && p1.value > 1) {
      issues.push(error('E-A1-MAX', 'a1', 'A₁ no puede superar 1 (amplitud normalizada).'));
    }
    if (p0.value !== undefined && p1.value !== undefined && p0.value > 0 && p1.value <= 1 && p0.value >= p1.value) {
      issues.push(error('E-A-ORDER', 'a0', 'A₀ debe ser menor que A₁ para que los dos bits se distingan.'));
    }
    if (p0.value !== undefined) a0 = p0.value;
    if (p1.value !== undefined) a1 = p1.value;
  }

  const byField: ParamValidation['byField'] = {};
  for (const item of issues) byField[item.field] ??= item;
  const params =
    issues.length === 0 && carrier.value !== undefined
      ? { carrierHz: carrier.value, bitRate: raw.bitRate, deltaHz, a0, a1 }
      : null;
  return { params, issues, byField };
}
