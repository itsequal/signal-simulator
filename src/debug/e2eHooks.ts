
export interface SignalSimDebug {
  activeSources: number;
  activeTracks: number;
  jobsCompleted: number;
  workerMode: string;
  contextSampleRate: number | null;
  captureSampleRate: number | null;
  playheadMs: number | null;
  workletUrl: string | null;
}

const state: SignalSimDebug = {
  activeSources: 0,
  activeTracks: 0,
  jobsCompleted: 0,
  workerMode: 'starting',
  contextSampleRate: null,
  captureSampleRate: null,
  playheadMs: null,
  workletUrl: null,
};

if (typeof window !== 'undefined') {
  (window as unknown as { __signalSimDebug: SignalSimDebug }).__signalSimDebug = state;
}

export function updateDebug(partial: Partial<SignalSimDebug>): void {
  Object.assign(state, partial);
}
