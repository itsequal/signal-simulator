import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface ToneSpec {
  frequency: number;
  sampleRate: number;
  seconds: number;
  amplitude: number;
}

export function makeToneWav({ frequency, sampleRate, seconds, amplitude }: ToneSpec): Buffer {
  const frames = Math.round(sampleRate * seconds);
  const dataBytes = frames * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  for (let n = 0; n < frames; n++) {
    const value = amplitude * Math.sin((2 * Math.PI * frequency * n) / sampleRate);
    buffer.writeInt16LE(Math.round(value * 32767), 44 + n * 2);
  }
  return buffer;
}

export default function globalSetup(): void {
  const file = path.resolve('e2e/fixtures/tone-1k-48k-mono.wav');
  if (existsSync(file)) return;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, makeToneWav({ frequency: 1000, sampleRate: 48_000, seconds: 3, amplitude: 0.5 }));
}
