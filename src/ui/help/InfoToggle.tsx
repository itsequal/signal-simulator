import { useId, useState } from 'react';
import type { GlossaryEntry } from './texts';

export function InfoToggle({ entry }: { entry: GlossaryEntry }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="info-toggle">
      <button
        type="button"
        className="info-toggle__button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Qué es: ${entry.term}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        i
      </button>
      <span id={id} className="info-toggle__text" hidden={!open}>
        <strong>{entry.term}:</strong> {entry.text}
      </span>
    </span>
  );
}
