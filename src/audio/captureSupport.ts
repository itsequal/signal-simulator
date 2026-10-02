import { appError, type AppError } from '../domain/errors';

export interface CaptureEnvironment {
  isSecureContext: boolean;
  protocol: string;
  hasGetUserMedia: boolean;
  hasAudioWorklet: boolean;
}

export function readCaptureEnvironment(): CaptureEnvironment {
  const hasAudioContext = typeof AudioContext === 'function';
  return {
    isSecureContext: window.isSecureContext === true,
    protocol: window.location.protocol,
    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
    hasAudioWorklet:
      typeof AudioWorkletNode === 'function' && hasAudioContext && 'audioWorklet' in AudioContext.prototype,
  };
}

export function checkCaptureSupport(env: CaptureEnvironment): AppError | null {
  if (env.protocol === 'file:' || !env.isSecureContext) return appError('E-MIC-INSECURE');
  if (!env.hasGetUserMedia) return appError('E-MIC-UNSUPPORTED');
  if (!env.hasAudioWorklet) return appError('E-MIC-NOWORKLET');
  return null;
}

export function mapGetUserMediaError(error: unknown): AppError {
  const name =
    typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return appError('E-MIC-DENIED');
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'DevicesNotFoundError':
      return appError('E-MIC-NODEVICE');
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return appError('E-MIC-BUSY');
    case 'TypeError':
      return appError('E-MIC-INSECURE');
    default:
      return appError('E-MIC-UNKNOWN', name || undefined);
  }
}
