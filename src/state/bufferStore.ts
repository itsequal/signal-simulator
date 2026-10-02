import type { F32, SimulationBuffers, Spectrum, TxSpectra, U8 } from '../domain/types';

export interface ResultBuffers {
  buffers: SimulationBuffers;
  spectra: TxSpectra | null;
}

export interface MicBuffers {
  pcmFloat: F32;
  pcmBytes: U8;
  bits: U8;
  originalSpectrum: Spectrum | null;
}

class BoundedMap<V> {
  private readonly map = new Map<string, V>();
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: string): V | undefined {
    return this.map.get(key);
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}

class BufferStore {
  readonly results = new BoundedMap<ResultBuffers>(2);
  readonly recordings = new BoundedMap<F32>(2);
  readonly mic = new BoundedMap<MicBuffers>(2);
  readonly txSpectra = new BoundedMap<TxSpectra>(4);
  readonly originalSpectra = new BoundedMap<Spectrum>(4);

  clear(): void {
    this.results.clear();
    this.recordings.clear();
    this.mic.clear();
    this.txSpectra.clear();
    this.originalSpectra.clear();
  }
}

export const bufferStore = new BufferStore();
