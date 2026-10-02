import { updateDebug } from '../debug/e2eHooks';
import { audioEngine, type PlayheadFrame } from './audioEngine';

type Subscriber = (frame: PlayheadFrame | null) => void;

const subscribers = new Set<Subscriber>();
let rafId = 0;

function tick(): void {
  const frame = audioEngine.getPlayhead();
  for (const subscriber of subscribers) subscriber(frame);
  updateDebug({ playheadMs: frame ? frame.positionS * 1000 : null });
  rafId = frame ? requestAnimationFrame(tick) : 0;
}

audioEngine.subscribe((snapshot) => {
  updateDebug({ activeSources: snapshot.activeSources, contextSampleRate: snapshot.contextSampleRate });
  if (snapshot.playing && rafId === 0) {
    rafId = requestAnimationFrame(tick);
  } else if (!snapshot.playing) {
    if (rafId !== 0) cancelAnimationFrame(rafId);
    rafId = 0;
    for (const subscriber of subscribers) subscriber(null);
    updateDebug({ playheadMs: null });
  }
});

export function subscribePlayhead(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}
