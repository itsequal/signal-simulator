import { useEffect, useRef } from 'react';
import { subscribePlayhead } from '../audio/playheadClock';
import type { PlaybackTarget, TimeRange } from '../domain/types';
import { MARGINS } from './theme';

interface PlayheadProps {
  targets: PlaybackTarget[];
  view: TimeRange;
  widthPx: number;
  onPosition?: (seconds: number) => void;
}

export function Playhead({ targets, view, widthPx, onPosition }: PlayheadProps) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ targets, view, widthPx, onPosition });

  useEffect(() => {
    latest.current = { targets, view, widthPx, onPosition };
  }, [targets, view, widthPx, onPosition]);

  useEffect(
    () =>
      subscribePlayhead((frame) => {
        const element = ref.current;
        if (!element) return;
        const { targets: wanted, view: range, widthPx: width, onPosition: report } = latest.current;
        if (!frame || !wanted.includes(frame.target)) {
          element.hidden = true;
          element.dataset.playheadMs = '';
          return;
        }
        report?.(frame.positionS);
        element.dataset.playheadMs = String(Math.round(frame.positionS * 1000));
        const span = range.t1 - range.t0;
        const fraction = span > 0 ? (frame.positionS - range.t0) / span : -1;
        if (fraction < 0 || fraction > 1) {
          element.hidden = true;
          return;
        }
        element.hidden = false;
        element.style.transform = `translateX(${MARGINS.l + fraction * width}px)`;
      }),
    [],
  );

  return <div ref={ref} className="playhead" hidden aria-hidden="true" data-testid="playhead" />;
}
