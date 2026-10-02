import { useLab } from '../state/LabProvider';

export function StatusBadge() {
  const { derived } = useLab();
  const { status } = derived;
  return (
    <p className={`status-badge status-badge--${status.kind}`} role="status" aria-live="polite" data-testid="status-badge">
      <span className="status-badge__dot" aria-hidden="true" />
      {status.label}
    </p>
  );
}
