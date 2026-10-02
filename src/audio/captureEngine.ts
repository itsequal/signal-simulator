import captureWorkletUrl from './worklets/capture.worklet.ts?worker&url';
import { CAPTURE, LIMITS, TIMING } from '../config/constants';
import { appError, isAppError, type AppError } from '../domain/errors';
import type { AudioProcessingFlags, EffectiveAudioSettings, F32, RecordingEnd } from '../domain/types';
import { updateDebug } from '../debug/e2eHooks';
import { audioEngine } from './audioEngine';
import { checkCaptureSupport, mapGetUserMediaError, readCaptureEnvironment } from './captureSupport';
import type { CaptureMessage } from './worklets/captureCore';

export const REQUESTED_PROCESSING: AudioProcessingFlags = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

export interface CapturedRecording {
  samples: F32;
  sampleRate: number;
  frameCount: number;
  durationS: number;
  channelCountReceived: number;
  requested: AudioProcessingFlags;
  effective: EffectiveAudioSettings;
  deviceLabel: string | null;
  endedBy: RecordingEnd;
  peak: number;
}

export type CaptureStatus = 'requesting' | 'recording' | 'stopping';

export interface CaptureHandlers {
  onStatus(status: CaptureStatus): void;
  onFinished(recording: CapturedRecording): void;
  onError(error: AppError): void;
  onCancelled(): void;
}

export interface LiveCapture {
  buffer: F32;
  frames: number;
  sampleRate: number;
  maxFrames: number;
}

interface Session {
  ctx: AudioContext;
  handlers: CaptureHandlers;
  status: CaptureStatus | 'done';
  cancelled: boolean;
  stream: MediaStream | null;
  source: MediaStreamAudioSourceNode | null;
  node: AudioWorkletNode | null;
  mute: GainNode | null;
  buffer: F32;
  frames: number;
  maxFrames: number;
  sampleRate: number;
  channelCount: number;
  endedBy: RecordingEnd;
  flushTimer: number | null;
  onContextState: (() => void) | null;
}

const workletLoads = new WeakMap<BaseAudioContext, Promise<void>>();

export function loadCaptureWorklet(ctx: AudioContext): Promise<void> {
  let loading = workletLoads.get(ctx);
  if (!loading) {
    updateDebug({ workletUrl: captureWorkletUrl });
    loading = ctx.audioWorklet.addModule(captureWorkletUrl).catch(() => {
      workletLoads.delete(ctx);
      throw appError('E-MODULE-LOAD', captureWorkletUrl);
    });
    workletLoads.set(ctx, loading);
  }
  return loading;
}

export class CaptureEngine {
  private session: Session | null = null;
  private activeTracks = 0;

  isBusy(): boolean {
    return this.session !== null;
  }

  getLive(): LiveCapture | null {
    const s = this.session;
    if (!s || (s.status !== 'recording' && s.status !== 'stopping')) return null;
    return { buffer: s.buffer, frames: s.frames, sampleRate: s.sampleRate, maxFrames: s.maxFrames };
  }

  start(handlers: CaptureHandlers): void {
    if (this.session) return;
    const unsupported = checkCaptureSupport(readCaptureEnvironment());
    if (unsupported) {
      handlers.onError(unsupported);
      return;
    }
    audioEngine.stop();
    let ctx: AudioContext;
    try {
      ctx = audioEngine.ensureContext();
    } catch {
      handlers.onError(appError('E-AUDIO-FAILED'));
      return;
    }
    const resuming = ctx.resume().catch(() => undefined);
    const maxFrames = Math.round(LIMITS.maxRecordSeconds * ctx.sampleRate);
    const session: Session = {
      ctx,
      handlers,
      status: 'requesting',
      cancelled: false,
      stream: null,
      source: null,
      node: null,
      mute: null,
      buffer: new Float32Array(maxFrames),
      frames: 0,
      maxFrames,
      sampleRate: ctx.sampleRate,
      channelCount: 0,
      endedBy: 'user',
      flushTimer: null,
      onContextState: null,
    };
    this.session = session;
    handlers.onStatus('requesting');
    void this.run(session, resuming);
  }

  stop(reason: RecordingEnd = 'user'): void {
    const s = this.session;
    if (!s) return;
    if (s.status === 'requesting') {
      this.cancel();
      return;
    }
    if (s.status !== 'recording') return;
    s.status = 'stopping';
    s.endedBy = reason;
    s.handlers.onStatus('stopping');
    s.node?.port.postMessage({ type: 'stop' });
    s.flushTimer = window.setTimeout(() => this.finalize(s), TIMING.stopFlushTimeoutMs);
  }

  cancel(): void {
    const s = this.session;
    if (!s) return;
    s.cancelled = true;
    s.status = 'done';
    this.release(s);
    s.handlers.onCancelled();
  }

  private async run(session: Session, resuming: Promise<unknown>): Promise<void> {
    try {
      await resuming;
      await loadCaptureWorklet(session.ctx);
      if (session.cancelled) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 }, ...REQUESTED_PROCESSING },
        video: false,
      });
      session.stream = stream;
      this.activeTracks += stream.getTracks().length;
      updateDebug({ activeTracks: this.activeTracks });

      if (session.cancelled) {
        this.release(session);
        return;
      }
      if (session.ctx.state !== 'running') await session.ctx.resume().catch(() => undefined);
      if ((session.ctx.state as string) !== 'running') throw appError('E-AUDIO-BLOCKED');

      const source = new MediaStreamAudioSourceNode(session.ctx, { mediaStream: stream });
      const node = new AudioWorkletNode(session.ctx, CAPTURE.processorName, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCountMode: 'max',
        processorOptions: { chunkFrames: CAPTURE.chunkFrames, maxFrames: session.maxFrames },
      });

      const mute = new GainNode(session.ctx, { gain: 0 });
      node.port.onmessage = (event: MessageEvent<CaptureMessage>) => this.handleMessage(session, event.data);
      node.onprocessorerror = () => this.interrupt(session);
      source.connect(node).connect(mute).connect(session.ctx.destination);
      session.source = source;
      session.node = node;
      session.mute = mute;
      for (const track of stream.getAudioTracks()) {
        track.addEventListener('ended', () => this.interrupt(session));
      }
      session.onContextState = () => {
        if (session.ctx.state !== 'running') this.interrupt(session);
      };
      session.ctx.addEventListener('statechange', session.onContextState);
      session.status = 'recording';
      updateDebug({ captureSampleRate: session.sampleRate });
      session.handlers.onStatus('recording');
    } catch (error) {
      const failure = isAppError(error) ? error : mapGetUserMediaError(error);
      const wasCancelled = session.cancelled;
      session.status = 'done';
      this.release(session);
      if (!wasCancelled) session.handlers.onError(failure);
    }
  }

  private handleMessage(session: Session, message: CaptureMessage): void {
    if (this.session !== session) return;
    if (message.type === 'limit') {
      this.stop('limit');
      return;
    }
    const room = session.buffer.length - session.frames;
    const count = Math.min(room, message.frames.length);
    session.buffer.set(message.frames.subarray(0, count), session.frames);
    session.frames += count;
    if (message.channelCount > 0) session.channelCount = message.channelCount;
    if (message.type === 'final') this.finalize(session);
  }

  private interrupt(session: Session): void {
    if (this.session !== session || session.status !== 'recording') return;
    this.stop('interrupted');
  }

  private finalize(session: Session): void {
    if (this.session !== session || session.status === 'done') return;
    session.status = 'done';
    const track = session.stream?.getAudioTracks()[0];
    const settings = track?.getSettings() ?? {};
    const deviceLabel = track?.label ? track.label : null;
    this.release(session);

    const durationS = session.frames / session.sampleRate;
    if (durationS < LIMITS.minRecordSeconds) {
      session.handlers.onError(appError(session.endedBy === 'interrupted' ? 'E-MIC-INTERRUPTED' : 'E-MIC-SHORT'));
      return;
    }
    const samples = session.buffer.slice(0, session.frames);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    session.handlers.onFinished({
      samples,
      sampleRate: session.sampleRate,
      frameCount: session.frames,
      durationS,
      channelCountReceived: session.channelCount || settings.channelCount || 1,
      requested: REQUESTED_PROCESSING,
      effective: {
        echoCancellation: typeof settings.echoCancellation === 'boolean' ? settings.echoCancellation : undefined,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl,
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
      },
      deviceLabel,
      endedBy: session.endedBy,
      peak,
    });
  }

  private release(session: Session): void {
    if (session.flushTimer !== null) {
      window.clearTimeout(session.flushTimer);
      session.flushTimer = null;
    }
    if (session.stream) {
      const tracks = session.stream.getTracks();
      for (const track of tracks) track.stop();
      this.activeTracks = Math.max(0, this.activeTracks - tracks.length);
      updateDebug({ activeTracks: this.activeTracks });
      session.stream = null;
    }
    if (session.node) {
      session.node.port.onmessage = null;
      session.node.onprocessorerror = null;
      session.node.port.close();
    }
    for (const node of [session.source, session.node, session.mute]) {
      try {
        node?.disconnect();
      } catch {

      }
    }
    session.source = null;
    session.node = null;
    session.mute = null;
    if (session.onContextState) {
      session.ctx.removeEventListener('statechange', session.onContextState);
      session.onContextState = null;
    }
    if (this.session === session) this.session = null;
  }
}

export const captureEngine = new CaptureEngine();
