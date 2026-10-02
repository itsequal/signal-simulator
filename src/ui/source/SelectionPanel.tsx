import { useEffect, useId, useState } from 'react';
import { LIMITS } from '../../config/constants';
import { formatCount } from '../../domain/format';
import { nextBlock, previousBlock } from '../../sources/selection';
import { useLab } from '../../state/LabProvider';

export function SelectionPanel() {
  const { derived, actions } = useLab();
  const id = useId();
  const data = derived.source.data;
  const selection = derived.selection;
  const bytes = data?.alignment === 8;
  const unit = bytes ? 'bytes' : 'bits';
  const scale = bytes ? 8 : 1;
  const [startText, setStartText] = useState('0');
  const [lengthText, setLengthText] = useState('0');

  useEffect(() => {
    if (!selection) return;
    setStartText(String(selection.start / scale));
    setLengthText(String(selection.length / scale));
  }, [selection, scale, data?.id]);

  if (!data || !selection) {
    return (
      <section className="panel">
        <h2 className="panel__title">3. Bloque a simular</h2>
      </section>
    );
  }

  const totalUnits = data.totalBits / scale;

  const apply = (startUnits: number, lengthUnits: number, notice?: string | null) => {
    actions.setSelection(startUnits * scale, lengthUnits * scale, notice ?? null);
  };

  const commit = () => {
    const startUnits = Number(startText);
    const lengthUnits = Number(lengthText);
    if (!Number.isInteger(startUnits) || !Number.isInteger(lengthUnits)) {
      actions.setSelection(selection.start, selection.length, `El inicio y la longitud deben ser números enteros de ${unit}.`);
      return;
    }
    apply(startUnits, lengthUnits);
  };

  const selectAll = () => {
    if (!derived.controls.fullSelection) return;
    apply(0, totalUnits, null);
  };

  const selectFirst = () => {
    const units = Math.min(totalUnits, LIMITS.defaultSelectionBits / scale);
    apply(0, units, units < totalUnits ? `Selección inicial: ${formatCount(units * scale)} de ${formatCount(data.totalBits)} bits.` : null);
  };

  const go = (direction: -1 | 1) => {
    if (direction < 0) {
      const previous = previousBlock(selection);
      if (previous) actions.setSelection(previous.start, previous.length, null);
      return;
    }
    const next = nextBlock(selection, data.totalBits);
    if (!next) return;
    actions.setSelection(
      next.selection.start,
      next.selection.length,
      next.shortened ? 'El último bloque es más corto: la entrada no llega para otro bloque completo.' : null,
    );
  };

  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="panel__title">
        3. Bloque a simular
      </h2>
      <div className="field-pair">
        <label className="field-label" htmlFor={`${id}-start`}>
          Inicio ({unit}, desde 0)
          <input id={`${id}-start`} type="number" min={0} value={startText} onChange={(event) => setStartText(event.target.value)} onBlur={commit} />
        </label>
        <label className="field-label" htmlFor={`${id}-length`}>
          Longitud ({unit})
          <input id={`${id}-length`} type="number" min={1} value={lengthText} onChange={(event) => setLengthText(event.target.value)} onBlur={commit} />
        </label>
      </div>
      <div className="toolbar">
        <button type="button" className="button" onClick={selectFirst}>
          Primeros {formatCount(Math.min(data.totalBits, LIMITS.defaultSelectionBits))} bits
        </button>
        <button type="button" className="button" disabled={!derived.controls.fullSelection} onClick={selectAll}>
          Toda la entrada
        </button>
        <button type="button" className="button" disabled={selection.start === 0} onClick={() => go(-1)}>
          Bloque anterior
        </button>
        <button type="button" className="button" disabled={selection.start + selection.length >= data.totalBits} onClick={() => go(1)}>
          Bloque siguiente
        </button>
      </div>
      {derived.selectionIssue && <p className="field-error">{derived.selectionIssue.message}</p>}
    </section>
  );
}
