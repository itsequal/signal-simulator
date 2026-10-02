import { useId, useState } from 'react';
import { TEXT_EXAMPLES } from '../../config/constants';
import { formatCodePoint, formatCount } from '../../domain/format';
import { byteToBinary, byteToHex } from '../../sources/bytes';
import { describeUtf8Bytes } from '../../sources/text';
import { useLab } from '../../state/LabProvider';

const PAGE_SIZE = 16;

export function TextInput() {
  const { state, derived, actions } = useLab();
  const id = useId();
  const source = derived.source;
  const bytes = source.data?.kind === 'text' ? source.data.bytes : null;
  const [page, setPage] = useState(0);
  const pageCount = bytes ? Math.max(1, Math.ceil(bytes.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const origins = bytes ? describeUtf8Bytes(state.textRaw) : [];
  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="panel__title">
        2. Texto plano
      </h2>
      <label htmlFor={`${id}-input`} className="field-label">
        Texto
      </label>
      <textarea
        id={`${id}-input`}
        rows={4}
        value={state.textRaw}
        aria-invalid={source.status === 'error'}
        onChange={(event) => {
          setPage(0);
          actions.setTextRaw(event.target.value);
        }}
      />
      {source.status === 'error' && source.issue && <p className="field-error">{source.issue.message}</p>}
      {source.status === 'empty' && <p className="field-error">Escribe algún texto para simular.</p>}
      <label htmlFor={`${id}-examples`} className="field-label">
        Ejemplos
      </label>
      <select
        id={`${id}-examples`}
        value=""
        onChange={(event) => {
          const example = TEXT_EXAMPLES.find((item) => item.id === event.target.value);
          if (example) {
            setPage(0);
            actions.setTextRaw(example.text);
          }
        }}
      >
        <option value="">Cargar un ejemplo…</option>
        {TEXT_EXAMPLES.map((example) => (
          <option key={example.id} value={example.id}>
            {example.label}
          </option>
        ))}
      </select>
      {bytes && (
        <div className="byte-table">
          <table>
            <caption className="sr-only">Bytes del texto</caption>
            <thead>
              <tr>
                <th>Byte</th>
                <th>Hex</th>
                <th>Binario</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(bytes.subarray(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE), (byte, offset) => {
                const index = safePage * PAGE_SIZE + offset;
                const origin = origins[index];
                return (
                  <tr key={index}>
                    <td>{formatCount(index)}</td>
                    <td className="mono">{byteToHex(byte)}</td>
                    <td className="mono">{byteToBinary(byte)}</td>
                    <td>
                      {origin
                        ? `${origin.char === '\n' ? 'salto de línea' : origin.char} ${formatCodePoint(origin.codePoint)} (${origin.part}/${origin.parts})`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="toolbar">
            <button type="button" className="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              Anterior
            </button>
            <span className="hint">
              Página {safePage + 1} de {pageCount}
            </span>
            <button type="button" className="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
