import { describe, expect, it } from 'vitest';
import { bitsToString, byteToBinary, byteToHex, bytesToBitsMsbFirst } from './bytes';

describe('bytes y bits', () => {
  it('serializa MSB primero (T-TXT-10)', () => {
    const bits = bytesToBitsMsbFirst(Uint8Array.of(0x80, 0x01));
    expect(bitsToString(bits, 0, bits.length)).toBe('10000000 00000001');
  });

  it('formatea hex y binario con ceros a la izquierda', () => {
    expect(byteToHex(0x0a)).toBe('0A');
    expect(byteToBinary(0x41)).toBe('01000001');
  });

  it('bitsToString respeta el inicio y el agrupamiento', () => {
    const bits = Uint8Array.of(1, 0, 1, 1, 0, 0, 1, 0, 1);
    expect(bitsToString(bits, 1, 5, 2)).toBe('01 10 0');
  });
});
