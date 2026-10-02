import { CaptureCore, type CaptureCoreOptions } from './captureCore';

interface ProcessorConstructionOptions {
  processorOptions?: Partial<CaptureCoreOptions>;
}

class CaptureProcessor extends AudioWorkletProcessor {
  private readonly core: CaptureCore;

  constructor(options?: ProcessorConstructionOptions) {
    super();
    const opts = options?.processorOptions ?? {};
    this.core = new CaptureCore(
      {
        chunkFrames: opts.chunkFrames ?? 4096,
        maxFrames: opts.maxFrames ?? Math.round(sampleRate * 5),
      },
      (message, transfer) => this.port.postMessage(message, transfer),
    );
    this.port.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'stop') this.core.stop();
    };
  }

  process(inputs: Float32Array[][]): boolean {

    return this.core.process(inputs[0] ?? []);
  }
}

registerProcessor('capture-processor', CaptureProcessor);
