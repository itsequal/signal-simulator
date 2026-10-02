import { describe, expect, it } from 'vitest';
import { bitsToString, byteToHex } from './bytes';
import { encodeText } from './text';

describe('texto UTF-8 (T-TXT-01…05)', () => {
  it('«A» produce el byte 41 y los bits 01000001', () => {
    const result = encodeText('A');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Array.from(result.bytes)).toEqual([0x41]);
    expect(bitsToString(result.bits, 0, 8)).toBe('01000001');
    expect(result.stats).toMatchObject({ utf16Units: 1, codePoints: 1, byteCount: 1 });
  });

  it('«ñ» produce C3 B1 y 11000011 10110001', () => {
    const result = encodeText('ñ');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Array.from(result.bytes).map(byteToHex)).toEqual(['C3', 'B1']);
    expect(bitsToString(result.bits, 0, 16)).toBe('11000011 10110001');
    expect(result.stats.utf16Units).toBe(1);
  });

  it('conserva el salto de línea como 0A y no recorta espacios', () => {
    const result = encodeText(' A\n');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Array.from(result.bytes)).toEqual([0x20, 0x41, 0x0a]);
  });

  it('un emoji ocupa 4 bytes y 2 unidades UTF-16', () => {
    const result = encodeText('\u{1F600}');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.bytes.length).toBe(4);
    expect(result.bits.length).toBe(32);
    expect(result.stats).toMatchObject({ utf16Units: 2, codePoints: 1, byteCount: 4 });
    expect(result.stats.graphemes).toBe(1);
  });

  it('rechaza más de 1 024 bytes sin recortar', () => {
    const result = encodeText('ñ'.repeat(600));
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.issue.code).toBe('E-INPUT-BYTES');
    expect(result.stats.byteCount).toBe(1200);
  });

  it('una cadena vacía no permite simular', () => {
    expect(encodeText('').status).toBe('empty');
  });
});
