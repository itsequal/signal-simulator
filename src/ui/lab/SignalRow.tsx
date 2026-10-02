import { useId, type ReactNode } from 'react';
import type { SignalKind } from '../../domain/types';

interface SignalRowProps {
  kind: SignalKind;
  title: string;
  caption?: ReactNode;
  player?: ReactNode;
  time?: ReactNode;
  spectrum?: ReactNode;
  extra?: ReactNode;
}

export function SignalRow({ kind, title, caption, player, time, spectrum, extra }: SignalRowProps) {
  const id = useId();
  return (
    <article className="signal-row" aria-labelledby={`${id}-title`} data-signal={kind}>
      <header className="signal-row__header">
        <h3 id={`${id}-title`} className="signal-row__title">
          <span className={`swatch swatch--${kind}`} aria-hidden="true" />
          {title}
        </h3>
        {caption && <p className="signal-row__caption">{caption}</p>}
        {player}
      </header>
      <div className={`signal-row__plots${time && spectrum ? '' : ' signal-row__plots--single'}`}>
        {time}
        {spectrum}
      </div>
      {extra}
    </article>
  );
}
