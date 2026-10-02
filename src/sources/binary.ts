import { LIMITS } from '../config/constants';
import { formatCodePoint, formatCount } from '../domain/format';
import type { U8, ValidationIssue } from '../domain/types';

export type BinaryParseResult =
  | { status: 'ok'; bits: U8; separatorCount: number }
  | { status: 'empty' }
  | { status: 'error'; issue: ValidationIssue; bitCount: number };

const SEPARATORS = new Set([0x20, 0x09, 0x0a, 0x0d]);

const INVISIBLE_NAMES: Record<number, string> = {
  0x00a0: 'espacio de no separación',
  0x2009: 'espacio fino',
  0x202f: 'espacio fino de no separación',
  0x200b: 'espacio de ancho cero',
  0xfeff: 'marca de orden de bytes',
  0x3000: 'espacio ideográfico',
};

function describeChar(char: string, codePoint: number): string {
  const name = INVISIBLE_NAMES[codePoint];
  if (name) return `${formatCodePoint(codePoint)} (${name})`;
  if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) return `${formatCodePoint(codePoint)} (carácter de control)`;
  return `«${char}» (${formatCodePoint(codePoint)})`;
}

export function parseBinaryInput(raw: string, maxBits: number = LIMITS.maxBinaryBits): BinaryParseResult {
  const bits = new Uint8Array(raw.length);
  let count = 0;
  let separatorCount = 0;
  let line = 1;
  let column = 0;
  let previousWasCr = false;
  let invalidCount = 0;
  let firstInvalid: { char: string; codePoint: number; line: number; column: number } | null = null;

  for (const char of raw) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint === 0x0a) {
      separatorCount++;
      if (!previousWasCr) line++;
      column = 0;
      previousWasCr = false;
      continue;
    }
    previousWasCr = false;
    if (codePoint === 0x0d) {
      separatorCount++;
      line++;
      column = 0;
      previousWasCr = true;
      continue;
    }
    column++;
    if (char === '0' || char === '1') {
      bits[count++] = char === '1' ? 1 : 0;
    } else if (SEPARATORS.has(codePoint)) {
      separatorCount++;
    } else {
      invalidCount++;
      if (!firstInvalid) firstInvalid = { char, codePoint, line, column };
    }
  }

  if (firstInvalid) {
    const others = invalidCount > 1 ? ` Hay ${formatCount(invalidCount)} caracteres no permitidos en total.` : '';
    return {
      status: 'error',
      bitCount: count,
      issue: {
        code: 'E-INPUT-CHAR',
        severity: 'error',
        field: 'input',
        message: `Carácter no permitido ${describeChar(firstInvalid.char, firstInvalid.codePoint)} en la línea ${firstInvalid.line}, columna ${firstInvalid.column}. Sólo se admiten 0, 1, espacios, tabulaciones y saltos de línea.${others}`,
      },
    };
  }
  if (count === 0) return { status: 'empty' };
  if (count > maxBits) {
    return {
      status: 'error',
      bitCount: count,
      issue: {
        code: 'E-INPUT-LIMIT',
        severity: 'error',
        field: 'input',
        message: `La entrada tiene ${formatCount(count)} bits y el máximo es ${formatCount(maxBits)}. Elimina ${formatCount(count - maxBits)} bits; no se recorta automáticamente.`,
      },
    };
  }
  return { status: 'ok', bits: bits.slice(0, count), separatorCount };
}
