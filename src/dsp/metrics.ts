import { PCM, SIM_SAMPLE_RATE, WARN } from '../config/constants';
import { formatDecimal, formatHz, formatPercent } from '../domain/format';
import type { ModulationKind, ModulationParams, ValidationIssue } from '../domain/types';

export function tonesInUse(params: ModulationParams, modulation: ModulationKind): number[] {
  return modulation === 'fsk' ? [params.carrierHz - params.deltaHz, params.carrierHz + params.deltaHz] : [params.carrierHz];
}

export function nyquistLobes(highestHz: number, bitRate: number, sampleRate: number = SIM_SAMPLE_RATE): number {
  return (sampleRate / 2 - highestHz) / bitRate;
}

export function nyquistTailFraction(lobes: number): number {
  return 1 / (2 * Math.PI * Math.PI * lobes);
}

export function pcmExpansionFactor(bitRate: number): number {
  return (PCM.sampleRate * PCM.bitsPerSample) / bitRate;
}

function warning(code: string, message: string): ValidationIssue {
  return { code, severity: 'warning', field: 'tones', message };
}

export function computeWarnings(params: ModulationParams, modulation: ModulationKind): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const tones = tonesInUse(params, modulation);
  const low = Math.min(...tones);
  const high = Math.max(...tones);
  const rate = params.bitRate;

  const samplesPerCycle = SIM_SAMPLE_RATE / high;
  if (samplesPerCycle < WARN.samplesPerCycleMin) {
    out.push(
      warning(
        'W-SPC',
        `Sólo hay ${formatDecimal(samplesPerCycle, 2)} muestras por ciclo de ${formatHz(high)}: la curva dibujada uniendo muestras se verá quebrada, pero el audio y la FFT son correctos.`,
      ),
    );
  }
  if (low / rate < 1) {
    out.push(
      warning('W-CPB', `Cada bit contiene menos de un ciclo de ${formatHz(low)} (${formatDecimal(low / rate, 2)} ciclos por bit): la forma de onda no se parecerá a una portadora con envolvente.`),
    );
  }
  if (low - rate <= 0) {
    out.push(
      warning('W-DC', `El lóbulo principal (${formatHz(low)} − R_b) alcanza 0 Hz: el espectro de la señal pasabanda se solapa con su imagen en frecuencias negativas.`),
    );
  }
  if (modulation === 'fsk' && 2 * params.deltaHz < rate) {
    out.push(
      warning('W-FSK-SEP', `La separación 2Δf = ${formatHz(2 * params.deltaHz)} es menor que R_b: los lóbulos de f₀ y f₁ se solapan y el espectro no mostrará dos picos separados.`),
    );
  }
  if (modulation === 'fsk' && low < WARN.f0LowHz) {
    out.push(warning('W-F0-LOW', `f₀ = ${formatHz(low)} está por debajo de ${formatHz(WARN.f0LowHz)} y puede ser poco audible.`));
  }
  if (modulation === 'ask' && params.a1 - params.a0 < WARN.askMinGap) {
    out.push(warning('W-ASK-CLOSE', 'A₀ y A₁ son muy parecidas: los bits serán difíciles de distinguir a simple vista o de oído.'));
  }
  const spb = SIM_SAMPLE_RATE / rate;
  if (spb < WARN.samplesPerBitMin) {
    out.push(warning('W-SPB', `Sólo hay ${formatDecimal(spb, 2)} muestras por bit.`));
  }
  const lobes = nyquistLobes(high, rate);
  if (lobes < WARN.nyquistLobesMin) {
    out.push(
      warning(
        'W-NYQ',
        `Entre ${formatHz(high)} y Nyquist (24 000 Hz) caben ${formatDecimal(lobes, 1)} lóbulos de ancho R_b: se estima que ${formatPercent(nyquistTailFraction(lobes), 2)} de la potencia del pulso rectangular queda por encima de Nyquist y se pliega en la señal muestreada.`,
      ),
    );
  }
  for (const tone of tones) {
    const cycles = tone / rate;
    if (!Number.isInteger(cycles) && cycles >= 1) {
      out.push({
        code: 'I-CYCLES',
        severity: 'info',
        field: 'tones',
        message: `${formatHz(tone)} completa ${formatDecimal(cycles, 3)} ciclos por bit (no entero): la fase al inicio de cada bit varía; no es un error.`,
      });
    }
  }
  return out;
}
