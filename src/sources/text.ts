import { LIMITS } from '../config/constants';
import { formatCount } from '../domain/format';
import type { U8, ValidationIssue } from '../domain/types';
import { bytesToBitsMsbFirst } from './bytes';

export interface TextStats {

  utf16Units: number;
  codePoints: number;

  graphemes: number | null;
  byteCount: number;
  hasLoneSurrogates: boolean;
}

export type TextEncodeResult =
  | { status: 'ok'; bytes: U8; bits: U8; stats: TextStats; warning: ValidationIssue | null }
  | { status: 'empty'; stats: TextStats }
  | { status: 'error'; issue: ValidationIssue; stats: TextStats };

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function hasLoneSurrogates(text: string): boolean {
  const withCheck = text as string & { isWellFormed?: () => boolean };
  return typeof withCheck.isWellFormed === 'function' ? !withCheck.isWellFormed() : LONE_SURROGATE.test(text);
}

let segmenter: Intl.Segmenter | null | undefined;

export function countGraphemes(text: string): number | null {
  if (segmenter === undefined) {
    segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('es', { granularity: 'grapheme' }) : null;
  }
  if (!segmenter) return null;
  let count = 0;
  for (const _ of segmenter.segment(text)) count++;
  return count;
}

const encoder = new TextEncoder();

export function encodeText(raw: string, maxBytes: number = LIMITS.maxTextBytes): TextEncodeResult {
  const bytes = encoder.encode(raw) as U8;
  const stats: TextStats = {
    utf16Units: raw.length,
    codePoints: Array.from(raw).length,
    graphemes: countGraphemes(raw),
    byteCount: bytes.length,
    hasLoneSurrogates: hasLoneSurrogates(raw),
  };
  if (bytes.length === 0) return { status: 'empty', stats };
  if (bytes.length > maxBytes) {
    return {
      status: 'error',
      stats,
      issue: {
        code: 'E-INPUT-BYTES',
        severity: 'error',
        field: 'input',
        message: `El texto ocupa ${formatCount(bytes.length)} bytes UTF-8 y el máximo es ${formatCount(maxBytes)} (se cuentan bytes, no caracteres: ahora hay ${formatCount(stats.codePoints)} puntos de código). Acorta el texto; no se recorta automáticamente.`,
      },
    };
  }
  const warning: ValidationIssue | null = stats.hasLoneSurrogates
    ? {
        code: 'W-TEXT-SURROGATE',
        severity: 'warning',
        field: 'input',
        message: 'El texto contiene sustitutos UTF-16 aislados; TextEncoder los codifica como U+FFFD (EF BF BD).',
      }
    : null;
  return { status: 'ok', bytes, bits: bytesToBitsMsbFirst(bytes), stats, warning };
}

export interface ByteOrigin {
  codePoint: number;
  char: string;

  part: number;
  parts: number;
  replaced: boolean;
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

export function describeUtf8Bytes(text: string): ByteOrigin[] {
  const origins: ByteOrigin[] = [];
  for (const char of text) {
    const raw = char.codePointAt(0) ?? 0;
    const replaced = raw >= 0xd800 && raw <= 0xdfff;
    const codePoint = replaced ? 0xfffd : raw;
    const parts = utf8Length(codePoint);
    for (let part = 1; part <= parts; part++) {
      origins.push({ codePoint, char: replaced ? '\uFFFD' : char, part, parts, replaced });
    }
  }
  return origins;
}
