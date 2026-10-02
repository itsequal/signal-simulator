export type ErrorCode =
  | 'E-MIC-INSECURE'
  | 'E-MIC-UNSUPPORTED'
  | 'E-MIC-NOWORKLET'
  | 'E-MIC-DENIED'
  | 'E-MIC-NODEVICE'
  | 'E-MIC-BUSY'
  | 'E-MIC-SHORT'
  | 'E-MIC-INTERRUPTED'
  | 'E-MIC-UNKNOWN'
  | 'E-MODULE-LOAD'
  | 'E-AUDIO-BLOCKED'
  | 'E-AUDIO-INTERRUPTED'
  | 'E-AUDIO-FAILED'
  | 'E-WORKER'
  | 'E-DSP'
  | 'E-PLOTLY'
  | 'E-PRELOAD';

export type ErrorAction = 'retry' | 'reload' | 'switch-source' | 'none';

export interface AppError {
  code: ErrorCode;
  message: string;
  action: ErrorAction;
}

const OTHER_SOURCES = 'Los modos Binario y Texto siguen disponibles.';

const CATALOG: Record<ErrorCode, { message: string; action: ErrorAction }> = {
  'E-MIC-INSECURE': {
    message: `La grabación necesita una conexión segura (HTTPS) o localhost; no funciona abriendo el archivo ni desde una IP local por HTTP. Usa la versión publicada o «npm run dev». ${OTHER_SOURCES}`,
    action: 'switch-source',
  },
  'E-MIC-UNSUPPORTED': {
    message: `Este navegador no ofrece acceso al micrófono (getUserMedia). ${OTHER_SOURCES}`,
    action: 'switch-source',
  },
  'E-MIC-NOWORKLET': {
    message: `Este navegador no permite AudioWorklet, necesario para obtener las muestras del micrófono. La grabación no está disponible. ${OTHER_SOURCES}`,
    action: 'switch-source',
  },
  'E-MIC-DENIED': {
    message: `Permiso de micrófono denegado. Para grabar, permite el micrófono desde el icono de la barra de direcciones y pulsa «Grabar» de nuevo. ${OTHER_SOURCES}`,
    action: 'retry',
  },
  'E-MIC-NODEVICE': {
    message: `No se encontró ningún micrófono. Conecta uno y pulsa «Grabar» de nuevo. ${OTHER_SOURCES}`,
    action: 'retry',
  },
  'E-MIC-BUSY': {
    message: `El micrófono está en uso por otra aplicación o no se pudo iniciar. Ciérrala y pulsa «Grabar» de nuevo. ${OTHER_SOURCES}`,
    action: 'retry',
  },
  'E-MIC-SHORT': {
    message: 'La grabación es demasiado corta (mínimo 0,1 s). Pulsa «Grabar» y habla un poco más.',
    action: 'retry',
  },
  'E-MIC-INTERRUPTED': {
    message:
      'La captura se interrumpió (micrófono desconectado, permiso retirado o audio del sistema interrumpido) antes de reunir 0,1 s de audio. No se generó ninguna señal sustituta.',
    action: 'retry',
  },
  'E-MIC-UNKNOWN': {
    message: `No se pudo iniciar la grabación. ${OTHER_SOURCES}`,
    action: 'retry',
  },
  'E-MODULE-LOAD': {
    message: 'No se pudo cargar el módulo de captura de audio. Recarga la página; si el problema persiste, revisa la conexión.',
    action: 'reload',
  },
  'E-AUDIO-BLOCKED': {
    message: 'El navegador no permitió iniciar el audio. Pulsa de nuevo el botón.',
    action: 'retry',
  },
  'E-AUDIO-INTERRUPTED': {
    message:
      'El sistema interrumpió el audio (otra aplicación tomó el dispositivo o se suspendió el equipo). Pulsa «Reproducir» para intentarlo de nuevo.',
    action: 'retry',
  },
  'E-AUDIO-FAILED': {
    message: 'No se pudo reproducir la señal.',
    action: 'retry',
  },
  'E-WORKER': {
    message:
      'El motor de cálculo en segundo plano no se pudo cargar: los cálculos se hacen en el hilo principal y la interfaz puede detenerse brevemente.',
    action: 'none',
  },
  'E-DSP': {
    message: 'Se produjo un error al calcular las señales.',
    action: 'retry',
  },
  'E-PLOTLY': {
    message: 'No se pudieron cargar las gráficas. Los indicadores y la reproducción siguen disponibles.',
    action: 'retry',
  },
  'E-PRELOAD': {
    message: 'Hay una versión nueva publicada y faltan archivos de la anterior. Recarga la página para continuar.',
    action: 'reload',
  },
};

export function appError(code: ErrorCode, detail?: string): AppError {
  const entry = CATALOG[code];
  return {
    code,
    message: detail ? `${entry.message} (${detail})` : entry.message,
    action: entry.action,
  };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as { code: unknown }).code === 'string' &&
    (value as { code: string }).code.startsWith('E-')
  );
}
