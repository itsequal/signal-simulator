import type { U8 } from '../domain/types';

export function bytesToBitsMsbFirst(bytes: Uint8Array): U8 {
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let j = 0; j < 8; j++) bits[i * 8 + j] = (byte >> (7 - j)) & 1;
  }
  return bits;
}

export function byteToHex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0');
}

export function byteToBinary(byte: number): string {
  return byte.toString(2).padStart(8, '0');
}

export function bitsToString(bits: Uint8Array, start: number, length: number, groupSize = 8): string {
  const end = Math.min(bits.length, start + length);
  let text = '';
  for (let i = start; i < end; i++) {
    if (i > start && (i - start) % groupSize === 0) text += ' ';
    text += bits[i] ? '1' : '0';
  }
  return text;
}
