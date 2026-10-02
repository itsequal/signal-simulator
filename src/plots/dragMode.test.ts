import { afterEach, describe, expect, it } from 'vitest';
import { getDragMode, setDragMode, subscribeDragMode } from './dragMode';

afterEach(() => {
  setDragMode('zoom');
});

describe('modo de arrastre de las gráficas', () => {
  it('conserva panorámica hasta que se vuelve a ampliar', () => {
    const seen: string[] = [];
    const stop = subscribeDragMode((mode) => seen.push(mode));
    setDragMode('pan');
    setDragMode('pan');
    expect(getDragMode()).toBe('pan');
    expect(seen).toEqual(['pan']);
    setDragMode('zoom');
    expect(getDragMode()).toBe('zoom');
    expect(seen).toEqual(['pan', 'zoom']);
    stop();
  });
});
