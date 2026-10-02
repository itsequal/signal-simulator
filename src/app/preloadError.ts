type Listener = () => void;

const listeners = new Set<Listener>();
let occurred = false;

export function installPreloadErrorListener(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    occurred = true;
    for (const listener of listeners) listener();
  });
}

export function subscribePreloadError(listener: Listener): () => void {
  listeners.add(listener);
  if (occurred) listener();
  return () => {
    listeners.delete(listener);
  };
}
