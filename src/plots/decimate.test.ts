import { describe, expect, it } from 'vitest';
import { generateCarrier } from '../dsp/modulation';
import { decimateMinMax, decimateSpectrum } from './decimate';

describe('decimación visual (T-DEC-01…04)', () => {
  const carrier = generateCarrier(48_000 * 30, 1000);

  it('una portadora de 1 kHz en 30 s se ve como banda [−1, 1]; el submuestreo ingenuo inventa una línea', () => {
    const series = decimateMinMax(carrier, 48_000, 0, 30, 1000);
    expect(series.mode).toBe('envelope');
    for (let i = 0; i < series.y.length; i += 2) {
      expect(Math.min(series.y[i], series.y[i + 1])).toBeLessThan(-0.999);
      expect(Math.max(series.y[i], series.y[i + 1])).toBeGreaterThan(0.999);
    }

    const naive: number[] = [];
    for (let n = 0; n < carrier.length; n += 1440) naive.push(carrier[n]);
    expect(naive.every((v) => Math.abs(v - 1) < 1e-6)).toBe(true);
  });

  it('nunca devuelve más de 2 puntos por píxel y, si caben, devuelve las muestras exactas', () => {
    const wide = decimateMinMax(carrier, 48_000, 0, 30, 800);
    expect(wide.x.length).toBeLessThanOrEqual(1600);
    const narrow = decimateMinMax(carrier, 48_000, 0, 0.01, 800);
    expect(narrow.mode).toBe('raw');
    expect(narrow.y.length).toBe(481);
    for (let i = 0; i < narrow.y.length; i++) expect(narrow.y[i]).toBe(carrier[i]);
  });

  it('todos los valores dibujados pertenecen a la señal y respetan el orden temporal', () => {
    const series = decimateMinMax(carrier, 48_000, 1, 3, 500);
    for (let i = 1; i < series.x.length; i++) expect(series.x[i]).toBeGreaterThanOrEqual(series.x[i - 1]);
    for (let i = 0; i < series.y.length; i++) {
      const n = Math.round((series.x[i] / 1000) * 48_000);
      expect(series.y[i]).toBe(carrier[n]);
    }
  });

  it('el espectro amplio conserva los picos estrechos (máximo por columna)', () => {
    const amplitude = new Float32Array(32_769);
    amplitude[1365] = 0.9;
    const series = decimateSpectrum(amplitude, 48_000 / 65_536, 0, 24_000, 400);
    expect(Math.max(...series.y)).toBeCloseTo(0.9, 6);
  });
});
