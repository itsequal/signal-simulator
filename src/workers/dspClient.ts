import { updateDebug } from '../debug/e2eHooks';
import { handleRequest, type HandledRequest } from './handleRequest';
import {
  requestTransferList,
  type WorkerRequest,
  type WorkerRequestInput,
  type WorkerResponse,
} from './protocol';

export type WorkerMode = 'starting' | 'worker' | 'inline';

export class StaleJobError extends Error {
  constructor() {
    super('Trabajo sustituido por uno más reciente');
    this.name = 'StaleJobError';
  }
}

export class DspJobError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DspJobError';
    this.code = code;
  }
}

export interface WorkerLike {
  postMessage(message: unknown, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  addEventListener(type: 'error', listener: (event: Event) => void): void;
  terminate(): void;
}

interface Pending {
  channel: string;
  resolve(response: WorkerResponse): void;
  reject(error: unknown): void;
}

const STARTUP_TIMEOUT_MS = 10_000;

export class DspClient {
  private worker: WorkerLike | null = null;
  private mode: WorkerMode = 'starting';
  private readonly ready: Promise<void>;
  private nextJobId = 1;
  private readonly latest = new Map<string, number>();
  private readonly pending = new Map<number, Pending>();
  private readonly inline: (request: WorkerRequest) => HandledRequest;
  private readonly modeListeners = new Set<(mode: WorkerMode) => void>();
  completed = 0;

  constructor(factory: (() => WorkerLike) | null, inline: (request: WorkerRequest) => HandledRequest = handleRequest) {
    this.inline = inline;
    this.ready = new Promise<void>((resolve) => {
      if (!factory) {
        this.setMode('inline');
        resolve();
        return;
      }
      let worker: WorkerLike;
      try {
        worker = factory();
      } catch {
        this.setMode('inline');
        resolve();
        return;
      }
      this.worker = worker;
      const fallback = () => {
        clearTimeout(timer);
        worker.terminate();
        this.worker = null;
        this.setMode('inline');
        resolve();
      };
      const timer = setTimeout(fallback, STARTUP_TIMEOUT_MS);
      worker.addEventListener('error', () => {
        if (this.mode === 'starting') fallback();
        else this.failPending('El worker DSP se detuvo inesperadamente');
      });
      worker.addEventListener('message', (event: MessageEvent) => {
        const response = event.data as WorkerResponse;
        if (this.mode === 'starting' && response.type === 'pong' && response.jobId === 0) {
          clearTimeout(timer);
          this.setMode('worker');
          resolve();
          return;
        }
        this.deliver(response);
      });
      const probe = new Float32Array(4);
      worker.postMessage({ type: 'ping', jobId: 0, payload: probe }, [probe.buffer]);
    });
  }

  get currentMode(): WorkerMode {
    return this.mode;
  }

  onModeChange(listener: (mode: WorkerMode) => void): () => void {
    this.modeListeners.add(listener);
    listener(this.mode);
    return () => {
      this.modeListeners.delete(listener);
    };
  }

  async request(channel: string, input: WorkerRequestInput): Promise<WorkerResponse> {
    const jobId = this.nextJobId++;
    this.latest.set(channel, jobId);
    await this.ready;
    if (this.latest.get(channel) !== jobId) throw new StaleJobError();
    const request = { ...input, jobId } as WorkerRequest;
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(jobId, { channel, resolve, reject });
      if (this.mode === 'worker' && this.worker) {
        this.worker.postMessage(request, requestTransferList(request));
      } else {
        setTimeout(() => this.deliver(this.inline(request).response), 0);
      }
    });
  }

  isLatest(channel: string, jobId: number): boolean {
    return this.latest.get(channel) === jobId;
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.failPending('Cliente DSP terminado');
  }

  private deliver(response: WorkerResponse): void {
    const pending = this.pending.get(response.jobId);
    if (!pending) return;
    this.pending.delete(response.jobId);
    this.completed++;
    updateDebug({ jobsCompleted: this.completed });
    if (this.latest.get(pending.channel) !== response.jobId) {
      pending.reject(new StaleJobError());
      return;
    }
    if (response.type === 'error') pending.reject(new DspJobError(response.code, response.message));
    else pending.resolve(response);
  }

  private failPending(message: string): void {
    for (const [jobId, pending] of this.pending) {
      this.pending.delete(jobId);
      pending.reject(new DspJobError('E-DSP', message));
    }
  }

  private setMode(mode: WorkerMode): void {
    this.mode = mode;
    updateDebug({ workerMode: mode });
    for (const listener of this.modeListeners) listener(mode);
  }
}

let client: DspClient | null = null;

export function getDspClient(): DspClient {
  if (!client) {
    client = new DspClient(
      () => new Worker(new URL('./dsp.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
    );
  }
  return client;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    client?.terminate();
    client = null;
  });
}
