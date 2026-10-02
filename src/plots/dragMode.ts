export type PlotDragMode = 'zoom' | 'pan';

let mode: PlotDragMode = 'zoom';
const listeners = new Set<(mode: PlotDragMode) => void>();

export function getDragMode(): PlotDragMode {
  return mode;
}

export function setDragMode(next: PlotDragMode): void {
  if (next === mode) return;
  mode = next;
  for (const listener of listeners) listener(mode);
}

export function subscribeDragMode(listener: (mode: PlotDragMode) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
