import { describe, expect, it } from 'vitest';
import { DspClient, StaleJobError, type WorkerLike } from './dspClient';
import { handleRequest } from './handleRequest';
import type { WorkerRequest } from './protocol';

class ManualWorker implements WorkerLike {
  readonly received: WorkerRequest[] = [];
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private errorListener: ((event: Event) => void) | null = null;
  autoPong = true;

  postMessage(message: unknown): void {
    const request = message as WorkerRequest;
    if (request.type === 'ping' && request.jobId === 0) {
      if (this.autoPong) queueMicrotask(() => this.respond(request));
      return;
    }
    this.received.push(request);
  }

  addEventListener(type: 'message' | 'error', listener: (event: never) => void): void {
    if (type === 'message') this.messageListener = listener as (event: MessageEvent) => void;
    else this.errorListener = listener as (event: Event) => void;
  }

  terminate(): void {}

  respond(request: WorkerRequest): void {
    this.messageListener?.({ data: handleRequest(request).response } as MessageEvent);
  }

  fail(): void {
    this.errorListener?.(new Event('error'));
  }
}

const ping = () => ({ type: 'ping' as const, payload: new Float32Array(2) });

describe('DspClient (T-WRK-02, T-WRK-03)', () => {
  it('descarta un resultado tardío de un canal ya sustituido', async () => {
    const worker = new ManualWorker();
    const client = new DspClient(() => worker);
    const first = client.request('simulate', ping());
    const second = client.request('simulate', ping());
    await expect(first).rejects.toBeInstanceOf(StaleJobError);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(worker.received).toHaveLength(1);
    worker.respond(worker.received[0]);
    await expect(second).resolves.toMatchObject({ type: 'pong' });
  });

  it('si la respuesta antigua llega después de pedir otra, se rechaza como obsoleta', async () => {
    const worker = new ManualWorker();
    const client = new DspClient(() => worker);
    const first = client.request('simulate', ping());
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = client.request('simulate', ping());
    await new Promise((resolve) => setTimeout(resolve, 0));
    const [a, b] = worker.received;
    worker.respond(b);
    worker.respond(a);
    await expect(second).resolves.toMatchObject({ jobId: b.jobId });
    await expect(first).rejects.toBeInstanceOf(StaleJobError);
  });

  it('canales distintos no se anulan entre sí', async () => {
    const client = new DspClient(null);
    const [a, b] = await Promise.all([client.request('pcm', ping()), client.request('simulate', ping())]);
    expect(a.type).toBe('pong');
    expect(b.type).toBe('pong');
  });

  it('usa el hilo principal si el worker no puede crearse', async () => {
    const client = new DspClient(() => {
      throw new Error('sin worker');
    });
    await expect(client.request('ping', ping())).resolves.toMatchObject({ type: 'pong' });
    expect(client.currentMode).toBe('inline');
  });

  it('usa el hilo principal si el worker falla al cargar', async () => {
    const worker = new ManualWorker();
    worker.autoPong = false;
    const client = new DspClient(() => worker);
    worker.fail();
    await expect(client.request('ping', ping())).resolves.toMatchObject({ type: 'pong' });
    expect(client.currentMode).toBe('inline');
  });
});
