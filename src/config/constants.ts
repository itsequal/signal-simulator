
export const SIM_SAMPLE_RATE = 48_000;

export const BIT_RATES = [10, 20, 50, 100, 200, 500, 1000] as const;
export type BitRate = (typeof BIT_RATES)[number];

export const MODULATIONS = ['ask', 'ook', 'fsk', 'bpsk'] as const;
export type ModulationKind = (typeof MODULATIONS)[number];

export const SOURCE_KINDS = ['binary', 'text', 'microphone'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface DefaultValues {
  carrierHz: number;
  bitRate: BitRate;
  deltaHz: number;
  a0: number;
  a1: number;
  volume: number;
  modulation: ModulationKind;
  binaryInput: string;
  textInput: string;
}

export const DEFAULTS: DefaultValues = {
  carrierHz: 1000,
  bitRate: 100,
  deltaHz: 250,
  a0: 0.25,
  a1: 1,
  volume: 0.3,
  modulation: 'ask',
  binaryInput: '1011001011100001',
  textInput: 'Hola',
};

export const RANGES = {
  carrierHz: { min: 100, max: 5000 },
  deltaHz: { min: 25, max: 2000 },
} as const;

export const LIMITS = {
  maxBinaryBits: 4096,
  maxTextBytes: 1024,
  maxRecordSeconds: 5,
  minRecordSeconds: 0.1,
  defaultSelectionBits: 256,
  maxSimSeconds: 30,
} as const;

export const FFT_POLICY = {

  maxLength: 65_536,

  minLength: 32,
  minSize: 4096,
  maxSize: 65_536,

  dbFloorAmplitude: 1e-6,

  originalHop: 1024,
} as const;

export const VIEW = {
  bitLabelMaxBits: 64,
  bitLabelMinPx: 12,
  defaultViewBits: 32,

  rawSamplesPerPx: 2,

  markersMinPxPerSample: 4,
} as const;

export const TIMING = {
  debounceMs: 250,
  rampSeconds: 0.005,
  startLeadSeconds: 0.03,
  stopFlushTimeoutMs: 500,
} as const;

export const CAPTURE = {
  chunkFrames: 4096,
  processorName: 'capture-processor',
} as const;

export const PCM = {
  sampleRate: 8000,
  bitsPerSample: 8,
} as const;

export const RESAMPLER = {
  passbandHz: 3400,
  stopbandHz: 4000,
  cutoffHz: 3700,
  attenuationDb: 70,
  tableOversampling: 64,
} as const;

export const WARN = {
  samplesPerCycleMin: 8,
  nyquistLobesMin: 20,
  samplesPerBitMin: 16,
  f0LowHz: 100,
  askMinGap: 0.1,
} as const;

export const BINARY_EXAMPLES = [
  { id: 'initial', label: 'Ejemplo inicial', bits: '1011001011100001' },
  { id: 'zeros', label: 'Todo ceros (16 bits)', bits: '0000000000000000' },
  { id: 'ones', label: 'Todo unos (16 bits)', bits: '1111111111111111' },
  { id: 'alternating', label: 'Alternancia 01 (16 bits)', bits: '0101010101010101' },
  { id: 'mixed', label: 'Mixta con ceros iniciales (16 bits)', bits: '0000111100110101' },
] as const;

export const TEXT_EXAMPLES = [
  { id: 'a', label: 'Letra A', text: 'A' },
  { id: 'enie', label: 'Letra ñ', text: 'ñ' },
  { id: 'hola', label: 'Hola ñ y un emoji', text: 'Hola ñ \u{1F600}' },
  { id: 'lines', label: 'Dos líneas', text: 'Línea 1\nLínea 2' },
] as const;

export const PALETTE = {
  nrz: '#000000',
  carrier: '#0072B2',
  modulated: '#D55E00',
  original: '#009E73',
  tone: '#CC79A7',
  text: '#1A1A1A',
  fftBand: 'rgba(0, 0, 0, 0.07)',
  detailBand: 'rgba(213, 94, 0, 0.12)',
} as const;
