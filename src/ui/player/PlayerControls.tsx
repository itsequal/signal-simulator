import { useId } from 'react';
import type { PlaybackTarget } from '../../domain/types';
import { useLab } from '../../state/LabProvider';

const LABELS: Record<PlaybackTarget, string> = {
  original: 'audio original',
  carrier: 'portadora',
  modulated: 'señal modulada',
};

export function PlayerControls({ target }: { target: PlaybackTarget }) {
  const { state, derived, actions } = useLab();
  const id = useId();
  const playing = state.playback.playing === target;
  const available = derived.controls.play[target];
  const volume = Math.round(state.playback.volumes[target] * 100);
  const label = LABELS[target];
  return (
    <div className="player" role="group" aria-label={`Reproducción de ${label}`}>
      <button
        type="button"
        className={`button${playing ? ' button--active' : ' button--primary'}`}
        aria-label={playing ? `Detener ${label}` : `Reproducir ${label}`}
        disabled={!playing && !available}
        onClick={() => (playing ? actions.stopPlayback() : actions.play(target))}
      >
        {playing ? '■ Detener' : '▶ Reproducir'}
      </button>
      <label htmlFor={`${id}-volume`} className="player__volume">
        <span>Volumen</span>
        <input
          id={`${id}-volume`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          aria-valuetext={`${volume} %`}
          onChange={(event) => actions.setVolume(target, Number(event.target.value) / 100)}
        />
        <output htmlFor={`${id}-volume`}>{volume} %</output>
      </label>
    </div>
  );
}
