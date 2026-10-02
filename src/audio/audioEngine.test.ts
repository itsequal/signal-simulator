import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, computePlayheadSeconds, rampSeconds } from './audioEngine';

class FakeParam {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime() {}
  setTargetAtTime() {}
}

class FakeNode {
  disconnected = false;
  connect<T>(node: T): T {
    return node;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeBuffer {
  readonly length: number;
  readonly sampleRate: number;
  data: Float32Array | null = null;
  constructor(options: { length: number; sampleRate: number }) {
    this.length = options.length;
    this.sampleRate = options.sampleRate;
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  copyToChannel(source: Float32Array) {
    this.data = new Float32Array(source);
  }
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor(_ctx: unknown, options: { buffer: FakeBuffer }) {
    super();
    this.buffer = options.buffer;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeContext {
  state = 'running';
  currentTime = 2;
  sampleRate = 44_100;
  outputLatency = 0.01;
  destination = new FakeNode();
  private listeners: Array<() => void> = [];
  addEventListener(_type: string, listener: () => void) {
    this.listeners.push(listener);
  }
  removeEventListener() {}
  async resume() {
    this.state = 'running';
  }
  async close() {
    this.state = 'closed';
  }
  fire(state: string) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

const sources: FakeSource[] = [];

beforeEach(() => {
  sources.length = 0;
  vi.stubGlobal('AudioBuffer', FakeBuffer);
  vi.stubGlobal(
    'AudioBufferSourceNode',
    class extends FakeSource {
      constructor(ctx: unknown, options: { buffer: FakeBuffer }) {
        super(ctx, options);
        sources.push(this);
      }
    },
  );
  vi.stubGlobal('GainNode', FakeGain);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rampSeconds (T-AUD-02)', () => {
  it('usa 5 ms salvo en señales muy cortas', () => {
    expect(rampSeconds(0.16)).toBe(0.005);
    expect(rampSeconds(0.01)).toBe(0.0025);
  });
});

describe('computePlayheadSeconds (T-AUD-04)', () => {
  it('usa getOutputTimestamp cuando está disponible', () => {
    const position = computePlayheadSeconds({
      startAt: 10.2,
      duration: 5,
      currentTime: 11,
      outputLatency: 0.05,
      timestamp: { contextTime: 10.5, performanceTime: 1000 },
      nowMs: 1100,
    });
    expect(position).toBeCloseTo(0.4, 9);
  });

  it('sin marca de tiempo resta la latencia de salida y acota a [0, T]', () => {
    expect(computePlayheadSeconds({ startAt: 1, duration: 2, currentTime: 1.5, outputLatency: 0.1, nowMs: 0 })).toBeCloseTo(0.4, 9);
    expect(computePlayheadSeconds({ startAt: 1, duration: 2, currentTime: 0.5, outputLatency: 0, nowMs: 0 })).toBe(0);
    expect(computePlayheadSeconds({ startAt: 1, duration: 2, currentTime: 9, outputLatency: 0, nowMs: 0 })).toBe(2);
  });
});

describe('AudioEngine (T-AUD-01, T-AUD-03)', () => {
  function makeEngine() {
    const ctx = new FakeContext();
    const engine = new AudioEngine(() => ctx as unknown as AudioContext);
    return { ctx, engine };
  }

  it('sólo una fuente suena: iniciar otra detiene y desconecta la anterior', async () => {
    const { engine } = makeEngine();
    engine.ensureContext();
    const samples = new Float32Array(4800).fill(0.5);
    await engine.play({ target: 'carrier', cacheKey: 'a', samples, sampleRate: 48_000, volume: 0.3 });
    expect(engine.snapshot().playing).toBe('carrier');
    await engine.play({ target: 'modulated', cacheKey: 'b', samples, sampleRate: 48_000, volume: 0.3 });
    expect(sources[0].stopped).toBe(true);
    expect(sources[0].disconnected).toBe(true);
    expect(engine.snapshot()).toMatchObject({ playing: 'modulated', activeSources: 1 });
    engine.stop();
    expect(engine.snapshot()).toMatchObject({ playing: null, activeSources: 0 });
  });

  it('el AudioBuffer usa la frecuencia real de las muestras y copia sin modificarlas', async () => {
    const { engine } = makeEngine();
    engine.ensureContext();
    const samples = Float32Array.of(0.1, -0.2, 0.3);
    await engine.play({ target: 'original', cacheKey: 'rec', samples, sampleRate: 44_100, volume: 0.3 });
    const buffer = sources[0].buffer;
    expect(buffer.sampleRate).toBe(44_100);
    expect(Array.from(buffer.data ?? [])).toEqual(Array.from(samples));
    expect(samples[1]).toBeCloseTo(-0.2, 6);
  });

  it('una interrupción del contexto detiene la reproducción e informa', async () => {
    const { ctx, engine } = makeEngine();
    engine.ensureContext();
    await engine.play({ target: 'carrier', cacheKey: 'a', samples: new Float32Array(480), sampleRate: 48_000, volume: 0.3 });
    ctx.fire('interrupted');
    expect(engine.snapshot().playing).toBeNull();
    expect(engine.snapshot().lastError?.code).toBe('E-AUDIO-INTERRUPTED');
  });

  it('el fin natural de una fuente antigua no afecta a la actual', async () => {
    const { engine } = makeEngine();
    engine.ensureContext();
    const samples = new Float32Array(480);
    await engine.play({ target: 'carrier', cacheKey: 'a', samples, sampleRate: 48_000, volume: 0.3 });
    const first = sources[0];
    await engine.play({ target: 'modulated', cacheKey: 'b', samples, sampleRate: 48_000, volume: 0.3 });
    first.onended?.();
    expect(engine.snapshot().playing).toBe('modulated');
  });
});
