import { beforeEach, describe, expect, it } from 'vitest';
import type { SimulationMeta } from '../domain/types';
import { bufferStore } from './bufferStore';
import { derive } from './derive';
import { labReducer, type LabAction } from './labReducer';
import { createInitialState, type LabState } from './labState';

function apply(state: LabState, ...actions: LabAction[]): LabState {
  return actions.reduce(labReducer, state);
}

function fakeResult(state: LabState): LabState {
  const d = derive(state);
  if (!d.configKey || !d.config || !d.selection || !d.source.data) throw new Error('config no válida');
  const resultId = `res-test-${Math.random()}`;
  bufferStore.results.set(resultId, {
    buffers: {
      bits: new Uint8Array(d.selection.length),
      nrz: new Float32Array(1),
      carrier: new Float32Array(1),
      modulated: new Float32Array(1),
    },
    spectra: null,
  });
  const meta: SimulationMeta = {
    resultId,
    configKey: d.configKey,
    jobId: 1,
    sourceId: d.source.data.id,
    sourceKind: d.source.kind,
    selection: d.selection,
    totalBits: d.source.data.totalBits,
    config: d.config,
    samplesPerBit: 480,
    sampleCount: d.selection.length * 480,
    durationS: d.selection.length / 100,
    tones: { carrierHz: 1000 },
  };
  return apply(state, { type: 'sim/done', meta });
}

beforeEach(() => bufferStore.clear());

describe('estado derivado (T-STATE-01…06)', () => {
  it('el estado inicial permite simular el ejemplo de 16 bits completo', () => {
    const d = derive(createInitialState());
    expect(d.source.status).toBe('ok');
    expect(d.selection).toEqual({ start: 0, length: 16 });
    expect(d.canSimulate).toBe(true);
    expect(d.configKey).not.toBeNull();
    expect(d.status.kind).toBe('ready');
  });

  it('un cambio de parámetros deja el resultado desactualizado y desactiva la reproducción', () => {
    const withResult = fakeResult(createInitialState());
    expect(derive(withResult).status.kind).toBe('valid');
    expect(derive(withResult).controls.play.modulated).toBe(true);
    const changed = apply(withResult, { type: 'params/set', field: 'carrierHz', value: '1500' });
    const d = derive(changed);
    expect(d.resultMatches).toBe(false);
    expect(d.status.kind).toBe('stale');
    expect(d.controls.play.modulated).toBe(false);
    expect(d.signature).not.toBe(derive(withResult).signature);
  });

  it('un error en un trabajo que ya no es el pedido se ignora', () => {
    const pending = apply(createInitialState(), { type: 'sim/pending', key: 'k2' });
    const failed = labReducer(pending, { type: 'sim/failed', key: 'k1', error: { code: 'E-DSP', message: 'x', action: 'retry' } });
    expect(failed.result.status).toBe('pending');
  });

  it('mientras se graba no se puede cambiar de fuente ni reproducir', () => {
    const recording = apply(fakeResult(createInitialState()), { type: 'mic/status', status: 'recording' });
    const d = derive(recording);
    expect(d.controls.sourceSwitch).toBe(false);
    expect(d.controls.play.carrier).toBe(false);
    expect(d.status.kind).toBe('recording');
  });

  it('el estado de React no contiene arrays tipados (serializable)', () => {
    const state = fakeResult(createInitialState());
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('entrada vacía y configuración inválida sin resultado', () => {
    expect(derive(apply(createInitialState(), { type: 'input/binary', raw: '   ' })).status.kind).toBe('empty');
    expect(derive(apply(createInitialState(), { type: 'params/set', field: 'carrierHz', value: '' })).status.kind).toBe('error');
  });

  it('cambiar de modulación mantiene los mismos bits y la misma selección', () => {
    const base = createInitialState();
    const fsk = apply(base, { type: 'modulation/set', modulation: 'fsk' });
    expect(derive(fsk).source.data?.id).toBe(derive(base).source.data?.id);
    expect(derive(fsk).selection).toEqual(derive(base).selection);
    expect(derive(fsk).configKey).not.toBe(derive(base).configKey);
  });
});

describe('selección por fuente (T-SEL-08)', () => {
  it('se conserva al cambiar de fuente y se reinicia si cambia el contenido', () => {
    const base = createInitialState();
    const sourceId = derive(base).source.data?.id ?? '';
    const selected = apply(base, { type: 'selection/set', kind: 'binary', selection: { sourceId, start: 8, length: 8 } });
    expect(derive(selected).selection).toEqual({ start: 8, length: 8 });
    const back = apply(selected, { type: 'source/kind', kind: 'text' }, { type: 'source/kind', kind: 'binary' });
    expect(derive(back).selection).toEqual({ start: 8, length: 8 });
    const edited = apply(back, { type: 'input/binary', raw: '1011001011100001111' });
    const d = derive(edited);
    expect(d.selection).toEqual({ start: 0, length: 19 });
    expect(d.selectionWasReset).toBe(true);
  });

  it('una selección que excede 30 s produce un error de duración sin recortar', () => {
    const state = apply(createInitialState(), { type: 'input/binary', raw: '1'.repeat(4096) });
    const sourceId = derive(state).source.data?.id ?? '';
    const all = apply(state, { type: 'selection/set', kind: 'binary', selection: { sourceId, start: 0, length: 4096 } });
    const d = derive(all);
    expect(d.selection?.length).toBe(4096);
    expect(d.durationIssue?.code).toBe('E-DURATION');
    expect(d.canSimulate).toBe(false);
    expect(d.controls.fullSelection).toBe(false);
    const faster = apply(all, { type: 'params/bitRate', value: 200 });
    expect(derive(faster).canSimulate).toBe(true);
  });
});
