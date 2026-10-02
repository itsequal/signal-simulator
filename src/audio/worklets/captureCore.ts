

export interface CaptureCoreOptions {
  chunkFrames: number;
  maxFrames: number;
}

export type CaptureMessage =
  | { type: 'chunk'; frames: Float32Array<ArrayBuffer>; channelCount: number }
  | { type: 'limit'; totalFrames: number }
  | { type: 'final'; frames: Float32Array<ArrayBuffer>; totalFrames: number; channelCount: number };

export type CapturePost = (message: CaptureMessage, transfer: ArrayBuffer[]) => void;

export function downmixAverage(channels: ReadonlyArray<Float32Array>, index: number): number {
  let sum = 0;
  for (let c = 0; c < channels.length; c++) sum += channels[c][index];
  return sum / channels.length;
}

export class CaptureCore {
  private readonly chunkFrames: number;
  private readonly maxFrames: number;
  private readonly post: CapturePost;
  private chunk: Float32Array<ArrayBuffer>;
  private filled = 0;
  private total = 0;
  private channelCount = 0;
  private active = true;
  private limitSent = false;

  constructor(options: CaptureCoreOptions, post: CapturePost) {
    this.chunkFrames = Math.max(1, Math.floor(options.chunkFrames));
    this.maxFrames = Math.max(1, Math.floor(options.maxFrames));
    this.post = post;
    this.chunk = new Float32Array(this.chunkFrames);
  }

  get totalFrames(): number {
    return this.total;
  }

  get isActive(): boolean {
    return this.active;
  }

  process(input: ReadonlyArray<Float32Array>): boolean {
    if (!this.active) return false;
    if (input.length === 0) return true;
    const frameCount = input[0].length;
    this.channelCount = input.length;
    for (let i = 0; i < frameCount && this.total < this.maxFrames; i++) {
      this.chunk[this.filled++] = downmixAverage(input, i);
      this.total++;
      if (this.filled === this.chunkFrames) this.flushChunk();
    }
    if (this.total >= this.maxFrames && !this.limitSent) {
      this.limitSent = true;
      this.post({ type: 'limit', totalFrames: this.total }, []);
    }
    return true;
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    const frames = this.chunk.slice(0, this.filled);
    this.filled = 0;
    this.post(
      { type: 'final', frames, totalFrames: this.total, channelCount: this.channelCount },
      [frames.buffer],
    );
  }

  private flushChunk(): void {
    const frames = this.chunk;
    this.chunk = new Float32Array(this.chunkFrames);
    this.filled = 0;
    this.post({ type: 'chunk', frames, channelCount: this.channelCount }, [frames.buffer]);
  }
}
