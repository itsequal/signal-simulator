import { describe, expect, it } from 'vitest';
import { parseBinaryInput } from './binary';

const asString = (bits: Uint8Array) => Array.from(bits).join('');

describe('parseBinaryInput', () => {
  it('elimina sólo separadores y conserva el orden (T-BIN-01)', () => {
    const result = parseBinaryInput('1011 0010\t1110\n0001');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(asString(result.bits)).toBe('1011001011100001');
      expect(result.separatorCount).toBe(3);
    }
  });

  it('conserva ceros iniciales (T-BIN-02)', () => {
    const result = parseBinaryInput('0001');
    expect(result.status === 'ok' && asString(result.bits)).toBe('0001');
  });

  it('rechaza caracteres no permitidos con línea y columna (T-BIN-03)', () => {
    const result = parseBinaryInput('10a1');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.issue.code).toBe('E-INPUT-CHAR');
      expect(result.issue.message).toContain('«a» (U+0061)');
      expect(result.issue.message).toContain('línea 1, columna 3');
    }
  });

  it('identifica espacios invisibles no admitidos (T-BIN-04)', () => {
    const result = parseBinaryInput('10\u00A01');
    expect(result.status === 'error' && result.issue.message).toContain('U+00A0 (espacio de no separación)');
    const second = parseBinaryInput('11\n0x');
    expect(second.status === 'error' && second.issue.message).toContain('línea 2, columna 2');
  });

  it('vacío o sólo separadores no permite simular (T-BIN-05)', () => {
    expect(parseBinaryInput('').status).toBe('empty');
    expect(parseBinaryInput(' \n\t ').status).toBe('empty');
  });

  it('respeta el límite sin recortar (T-BIN-06)', () => {
    expect(parseBinaryInput('1'.repeat(4096)).status).toBe('ok');
    const over = parseBinaryInput('1'.repeat(4097));
    expect(over.status).toBe('error');
    if (over.status === 'error') {
      expect(over.issue.code).toBe('E-INPUT-LIMIT');
      expect(over.bitCount).toBe(4097);
    }
  });

  it('trata CRLF como un único salto de línea (T-BIN-07)', () => {
    const result = parseBinaryInput('1\r\n0\r\n2');
    expect(result.status === 'error' && result.issue.message).toContain('línea 3, columna 1');
    const ok = parseBinaryInput('1\r\n0');
    expect(ok.status === 'ok' && asString(ok.bits)).toBe('10');
  });
});
