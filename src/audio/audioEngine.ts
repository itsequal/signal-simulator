import { TIMING } from '../config/constants';
import { appError, type AppError } from '../domain/errors';
import type { AudioCtxStatus, F32, PlaybackTarget } from '../domain/types';

export interface PlayRequest {
  target: PlaybackTarget;

  cacheKey: string;
  samples: F32;

  sampleRate: number;
  volume: number;
}

export interface EngineSnapshot {
  contextState: AudioCtxStatus;
  playing: PlaybackTarget | null;
  activeSources: number;
  contextSampleRate: number | null;
  lastError: AppError | null;
}

export interface PlayheadFrame {
  target: PlaybackTarget;
  positionS: number;
  durationS: number;
}

export function rampSeconds(duration: number): number {
  return Math.min(TIMING.rampSeconds, duration / 4);
}

export function scheduleEnvelope(param: AudioParam, startAt: number, duration: number, volume: number): void {
  const ramp = rampSeconds(duration);
  param.cancelScheduledValues(0);
  param.setValueAtTime(0, startAt);
  param.linearRampToValueAtTime(volume, startAt + ramp);
  param.setValueAtTime(volume, startAt + duration - ramp);
  param.linearRampToValueAtTime(0, startAt + duration);
}

export interface PlayheadInput {
  startAt: number;
  duration: number;
  currentTime: number;
  outputLatency: number;
  timestamp?: { contextTime?: number; performanceTime?: number };
  nowMs: number;
}

export function computePlayheadSeconds(input: PlayheadInput): number {
  const ts = input.timestamp;
  let contextNow: number;
  if (ts && typeof ts.contextTime === 'number' && typeof ts.performanceTime === 'number' && ts.contextTime > 0 && ts.performanceTime > 0) {
    contextNow = ts.contextTime + (input.nowMs - ts.performanceTime) / 1000;
  } else {
    contextNow = input.currentTime - input.outputLatency;
  }
  return Math.min(Math.max(contextNow - input.startAt, 0), input.duration);
}

interface CurrentPlayback {
  token: number;
  target: PlaybackTarget;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startAt: number;
  duration: number;
  volume: number;
}

type ContextFactory = () => AudioContext;
type Listener = (snapshot: EngineSnapshot) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private readonly createContext: ContextFactory;
  private current: CurrentPlayback | null = null;
  private token = 0;
  private activeSources = 0;
  private lastError: AppError | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly buffers = new Map<string, AudioBuffer>();

  constructor(createContext: ContextFactory = () => new AudioContext({ latencyHint: 'interactive' })) {
    this.createContext = createContext;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = this.createContext();
      this.ctx.addEventListener('statechange', this.handleStateChange);
      this.emit();
    }
    return this.ctx;
  }

  async ensureRunning(): Promise<AudioContext> {
    const ctx = this.ensureContext();
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {

      }
    }
    if ((ctx.state as string) !== 'running') throw appError('E-AUDIO-BLOCKED');
    return ctx;
  }

  async play(request: PlayRequest): Promise<void> {
    this.stop();
    const token = this.token;
    const ctx = await this.ensureRunning();
    if (token !== this.token) return;
    const buffer = this.getBuffer(request);
    const source = new AudioBufferSourceNode(ctx, { buffer });
    const gain = new GainNode(ctx, { gain: 0 });
    source.connect(gain).connect(ctx.destination);
    const startAt = ctx.currentTime + TIMING.startLeadSeconds;
    const duration = buffer.duration;
    scheduleEnvelope(gain.gain, startAt, duration, request.volume);
    source.onended = () => {
      if (this.current?.token === token) this.finish();
    };
    source.start(startAt);
    this.activeSources++;
    this.current = { token, target: request.target, source, gain, startAt, duration, volume: request.volume };
    this.lastError = null;
    this.emit();
  }

  stop(): void {
    this.token++;
    if (this.current) this.finish();
  }

  setVolume(target: PlaybackTarget, volume: number): void {
    const current = this.current;
    if (!current || current.target !== target || !this.ctx) return;
    current.volume = volume;
    const now = this.ctx.currentTime;
    const param = current.gain.gain;
    const endAt = current.startAt + current.duration;
    const ramp = rampSeconds(current.duration);
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.setTargetAtTime(volume, now, 0.01);
    if (endAt - ramp > now) {
      param.setValueAtTime(volume, endAt - ramp);
      param.linearRampToValueAtTime(0, endAt);
    }
  }

  getPlayhead(): PlayheadFrame | null {
    const current = this.current;
    const ctx = this.ctx;
    if (!current || !ctx) return null;
    const withTimestamp = ctx as AudioContext & { getOutputTimestamp?: () => AudioTimestamp };
    const timestamp = typeof withTimestamp.getOutputTimestamp === 'function' ? withTimestamp.getOutputTimestamp() : undefined;
    const latency = typeof ctx.outputLatency === 'number' ? ctx.outputLatency : (ctx.baseLatency ?? 0);
    const positionS = computePlayheadSeconds({
      startAt: current.startAt,
      duration: current.duration,
      currentTime: ctx.currentTime,
      outputLatency: latency,
      timestamp,
      nowMs: performance.now(),
    });
    return { target: current.target, positionS, durationS: current.duration };
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.buffers.clear();
      return;
    }
    for (const key of this.buffers.keys()) {
      if (key.startsWith(prefix)) this.buffers.delete(key);
    }
  }

  snapshot(): EngineSnapshot {
    return {
      contextState: this.ctx ? (this.ctx.state as AudioCtxStatus) : 'uninitialized',
      playing: this.current?.target ?? null,
      activeSources: this.activeSources,
      contextSampleRate: this.ctx?.sampleRate ?? null,
      lastError: this.lastError,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    this.stop();
    this.buffers.clear();
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      ctx.removeEventListener('statechange', this.handleStateChange);
      await ctx.close().catch(() => undefined);
    }
  }

  private getBuffer(request: PlayRequest): AudioBuffer {
    const cached = this.buffers.get(request.cacheKey);
    if (cached && cached.sampleRate === request.sampleRate && cached.length === request.samples.length) return cached;
    const buffer = new AudioBuffer({
      length: Math.max(1, request.samples.length),
      numberOfChannels: 1,
      sampleRate: request.sampleRate,
    });

    buffer.copyToChannel(request.samples, 0);
    this.buffers.set(request.cacheKey, buffer);
    return buffer;
  }

  private finish(): void {
    const current = this.current;
    if (!current) return;
    this.current = null;
    current.source.onended = null;
    try {
      current.source.stop();
    } catch {

    }
    current.source.disconnect();
    current.gain.disconnect();
    this.activeSources = Math.max(0, this.activeSources - 1);
    this.emit();
  }

  private readonly handleStateChange = (): void => {
    const state = this.ctx?.state as AudioCtxStatus | undefined;
    if (this.current && state !== 'running') {
      this.lastError = appError('E-AUDIO-INTERRUPTED');
      this.stop();
    }
    this.emit();
  };

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const audioEngine = new AudioEngine();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void audioEngine.dispose();
  });
}
