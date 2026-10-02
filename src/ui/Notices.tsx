import { useLab } from '../state/LabProvider';

export function Notices() {
  const { state, actions } = useLab();
  const playbackError = state.playback.error;
  if (state.notices.length === 0 && !playbackError) return null;
  return (
    <div className="notices" aria-live="polite">
      {playbackError && (
        <div className="notice notice--error" role="alert">
          {playbackError.message}
        </div>
      )}
      {state.notices.map((notice) => (
        <div key={notice.id} className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : undefined}>
          <span>{notice.text}</span>
          {notice.text.includes('Recarga la página') && (
            <button type="button" onClick={() => window.location.reload()}>
              Recargar
            </button>
          )}
          <button type="button" className="notice__close" onClick={() => actions.dismissNotice(notice.id)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
