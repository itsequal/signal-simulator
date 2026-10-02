import { useEffect, useId, useRef } from 'react';
import { captureEngine } from '../../audio/captureEngine';
import { LIMITS } from '../../config/constants';
import { formatDecimal } from '../../domain/format';
import { useLab } from '../../state/LabProvider';
import { PlayerControls } from '../player/PlayerControls';

export function MicPanel() {
  const { state, derived, actions } = useLab();
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const recording = state.mic.status === 'recording' || state.mic.status === 'stopping';

  useEffect(() => {
    if (!recording) return;
    let frame = 0;
    const draw = () => {
      const live = captureEngine.getLive();
      const canvas = canvasRef.current;
      if (live && elapsedRef.current) elapsedRef.current.textContent = formatDecimal(live.frames / live.sampleRate, 1);
      if (live && canvas) drawWave(canvas, live.buffer, live.frames);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [recording]);

  const { mic } = state;
  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="panel__title">
        2. Grabación
      </h2>
      <div className="toolbar">
        <button type="button" className="button button--primary" disabled={!derived.controls.record} onClick={() => actions.startRecording()}>
          Grabar
        </button>
        <button type="button" className="button" disabled={!derived.controls.stopRecording} onClick={() => actions.stopRecording()}>
          Detener
        </button>
        <button type="button" className="button" disabled={!derived.controls.cancelRecording} onClick={() => actions.cancelRecording()}>
          Cancelar
        </button>
      </div>
      <p data-testid="mic-status">
        Estado: {mic.status === 'recording' ? 'grabando' : mic.status === 'requesting' ? 'solicitando permiso' : mic.status === 'processing' ? 'convirtiendo a PCM' : mic.status === 'ready' ? 'lista' : mic.status === 'error' ? 'error' : 'en espera'}
        {recording && (
          <>
            {' '}
            · <span ref={elapsedRef}>0,0</span> / {LIMITS.maxRecordSeconds} s
          </>
        )}
      </p>
      <canvas ref={canvasRef} className="mic-wave" width={320} height={64} aria-hidden="true" />
      {mic.error && (
        <p className="field-error" role="alert">
          {mic.error.message}
        </p>
      )}
      {mic.recording && <PlayerControls target="original" />}
    </section>
  );
}

function drawWave(canvas: HTMLCanvasElement, samples: Float32Array, frames: number): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#009e73';
  context.beginPath();
  const count = Math.min(frames, samples.length);
  for (let x = 0; x < width; x++) {
    const a = Math.floor((x * count) / width);
    const b = Math.max(a + 1, Math.floor(((x + 1) * count) / width));
    let min = 1;
    let max = -1;
    for (let i = a; i < b && i < count; i++) {
      min = Math.min(min, samples[i]);
      max = Math.max(max, samples[i]);
    }
    context.moveTo(x, ((1 - max) * height) / 2);
    context.lineTo(x, ((1 - min) * height) / 2);
  }
  context.stroke();
}
