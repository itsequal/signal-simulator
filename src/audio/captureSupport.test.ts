import { describe, expect, it } from 'vitest';
import { checkCaptureSupport, mapGetUserMediaError, type CaptureEnvironment } from './captureSupport';

const ok: CaptureEnvironment = { isSecureContext: true, protocol: 'https:', hasGetUserMedia: true, hasAudioWorklet: true };

describe('checkCaptureSupport (T-ERR-02)', () => {
  it('admite contextos seguros con getUserMedia y AudioWorklet', () => {
    expect(checkCaptureSupport(ok)).toBeNull();
  });

  it('rechaza contextos inseguros y file://', () => {
    expect(checkCaptureSupport({ ...ok, isSecureContext: false })?.code).toBe('E-MIC-INSECURE');
    expect(checkCaptureSupport({ ...ok, protocol: 'file:' })?.code).toBe('E-MIC-INSECURE');
  });

  it('informa si falta getUserMedia o AudioWorklet', () => {
    expect(checkCaptureSupport({ ...ok, hasGetUserMedia: false })?.code).toBe('E-MIC-UNSUPPORTED');
    expect(checkCaptureSupport({ ...ok, hasAudioWorklet: false })?.code).toBe('E-MIC-NOWORKLET');
  });
});

describe('mapGetUserMediaError (T-ERR-01)', () => {
  const cases: Array<[string, string]> = [
    ['NotAllowedError', 'E-MIC-DENIED'],
    ['SecurityError', 'E-MIC-DENIED'],
    ['NotFoundError', 'E-MIC-NODEVICE'],
    ['OverconstrainedError', 'E-MIC-NODEVICE'],
    ['NotReadableError', 'E-MIC-BUSY'],
    ['AbortError', 'E-MIC-BUSY'],
    ['TypeError', 'E-MIC-INSECURE'],
  ];
  for (const [name, code] of cases) {
    it(`${name} → ${code}`, () => {
      expect(mapGetUserMediaError(new DOMException('x', name)).code).toBe(code);
    });
  }

  it('otros errores conservan su nombre en el mensaje', () => {
    const error = mapGetUserMediaError(new DOMException('x', 'InvalidStateError'));
    expect(error.code).toBe('E-MIC-UNKNOWN');
    expect(error.message).toContain('InvalidStateError');
  });
});
