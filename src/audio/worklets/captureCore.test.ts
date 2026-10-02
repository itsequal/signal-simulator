import { describe, expect, it } from 'vitest';
import { CaptureCore, downmixAverage, type CaptureMessage } from './captureCore';

function collector() {
  const messages: CaptureMessage[] = [];
  const post = (message: CaptureMessage) => {
    messages.push(message);
  };
  return { messages, post };
}

function block(length: number, value = 0.25, channels = 1): Float32Array[] {
  return Array.from({ length: channels }, () => new Float32Array(length).fill(value));
}

describe('downmixAverage (T-CAP-01)', () => {
  it('promedia los canales', () => {
    expect(downmixAverage([Float32Array.of(0.5), Float32Array.of(-0.5)], 0)).toBe(0);
    expect(downmixAverage([Float32Array.of(0.4), Float32Array.of(0.4)], 0)).toBeCloseTo(0.4, 6);
  });

  it('con un canal devuelve la muestra exacta', () => {
    const channel = Float32Array.of(0.123);
    expect(downmixAverage([channel], 0)).toBe(channel[0]);
  });
});

describe('CaptureCore', () => {
  it('agrupa en bloques de chunkFrames y vacía el resto al detener (T-CAP-02)', () => {
    const { messages, post } = collector();
    const core = new CaptureCore({ chunkFrames: 4096, maxFrames: 1_000_000 }, post);
    for (let i = 0; i < 40; i++) core.process(block(128));
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('chunk');
    if (messages[0].type === 'chunk') expect(messages[0].frames.length).toBe(4096);
    core.stop();
    expect(messages).toHaveLength(2);
    const final = messages[1];
    expect(final.type).toBe('final');
    if (final.type === 'final') {
      expect(final.frames.length).toBe(1024);
      expect(final.totalFrames).toBe(5120);
    }
  });

  it('deja de acumular exactamente en maxFrames y avisa una vez (T-CAP-03)', () => {
    const { messages, post } = collector();
    const core = new CaptureCore({ chunkFrames: 256, maxFrames: 1000 }, post);
    for (let i = 0; i < 10; i++) core.process(block(128));
    expect(core.totalFrames).toBe(1000);
    expect(messages.filter((m) => m.type === 'limit')).toHaveLength(1);
  });

  it('no cuenta entradas vacías y tras detener devuelve false (T-CAP-04)', () => {
    const { post } = collector();
    const core = new CaptureCore({ chunkFrames: 128, maxFrames: 1000 }, post);
    expect(core.process([])).toBe(true);
    expect(core.totalFrames).toBe(0);
    core.stop();
    expect(core.process(block(128))).toBe(false);
  });

  it('respeta la longitud real del bloque, no sólo 128 (T-CAP-05)', () => {
    const { post } = collector();
    const core = new CaptureCore({ chunkFrames: 4096, maxFrames: 10_000 }, post);
    core.process(block(256, 0.5, 2));
    expect(core.totalFrames).toBe(256);
  });
});
