import type { ModulationKind, SourceKind } from '../../config/constants';

export const MODULATION_LABELS: Record<ModulationKind, string> = {
  ask: 'ASK',
  ook: 'OOK',
  fsk: 'FSK',
  bpsk: 'BPSK',
};

export const MODULATION_NAMES: Record<ModulationKind, string> = {
  ask: 'ASK binaria (modulación por desplazamiento de amplitud)',
  ook: 'OOK (encendido y apagado)',
  fsk: 'FSK binaria de fase continua',
  bpsk: 'BPSK (PSK binaria absoluta)',
};

export const MODULATION_DETAIL: Record<ModulationKind, string> = {
  ask: 's(t) = A_b · cos(2π f_c t), con 0 < A₀ < A₁ ≤ 1. Aquí ASK usa dos amplitudes no nulas para que ambos bits se vean y se oigan; OOK es el caso A₀ = 0.',
  ook: 's(t) = b_k · cos(2π f_c t). Una racha de ceros es silencio; una racha de unos es la portadora pura.',
  fsk: 'La fase se integra muestra a muestra (φ[n+1] = φ[n] + 2π f_b / F_sim), así que no hay saltos aunque un bit no contenga un número entero de ciclos. La separación total entre tonos es 2Δf.',
  bpsk: 's(t) = cos(2π f_c t + π b_k) = (1 − 2b_k) · cos(2π f_c t). Repetir un bit mantiene la misma fase. La inversión puede no oírse como un cambio de tono o volumen: su demostración principal es visual.',
};

export const SOURCE_LABELS: Record<SourceKind, string> = {
  binary: 'Binario',
  text: 'Texto',
  microphone: 'Micrófono',
};

export const AUDIO_NOTICES = {
  modem: 'La señal modulada suena como tonos o un módem, no como la voz original: esta app no incluye receptor ni demodulación.',
  bpsk: 'La inversión de fase de BPSK no siempre se percibe al oído; obsérvala en la gráfica (0° y 180°).',
  ramp: 'Al reproducir se aplica una rampa de 5 ms al inicio y al final para evitar chasquidos del altavoz; las gráficas y la FFT usan las muestras sin rampa.',
  slower: 'Para escuchar los cambios más despacio, reduce R_b y regenera: cambiar la velocidad de reproducción alteraría también la frecuencia de la portadora.',
} as const;

export interface GlossaryEntry {
  term: string;
  text: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  bitRate: { term: 'Tasa de bits R_b', text: 'Bits transmitidos por segundo (bit/s). T_b = 1/R_b es la duración de cada bit.' },
  baudRate: {
    term: 'Tasa de símbolos R_s (baudios)',
    text: 'Símbolos por segundo: R_b = R_s · log₂ M. Con M = 2 cada símbolo lleva 1 bit y R_s = R_b. Cuenta símbolos, no transiciones entre bits: con todos los bits iguales sigue siendo R_b.',
  },
  m: { term: 'M', text: 'Número de símbolos distintos. Las cuatro modulaciones de esta app son binarias: M = 2.' },
  carrier: { term: 'Portadora f_c', text: 'Frecuencia del coseno de referencia c(t) = cos(2π f_c t), con fase inicial cero y amplitud 1.' },
  deltaF: { term: 'Desviación Δf', text: 'Desplazamiento de cada tono FSK respecto al centro: f₀ = f_c − Δf y f₁ = f_c + Δf. La separación total es 2Δf.' },
  fsim: {
    term: 'Frecuencia de muestreo de simulación F_sim',
    text: '48 000 muestras/s. Todas las tasas disponibles dan un número entero de muestras por bit. No es la tasa de bits ni la frecuencia de portadora.',
  },
  sampleRates: {
    term: 'Frecuencias de muestreo',
    text: 'Hay varias y no deben confundirse: la del dispositivo (informada por el navegador), la de captura (la del AudioContext, con la que llegan las muestras), la del PCM educativo (8 000 muestras/s), la de simulación (48 000) y la de salida (la del AudioContext).',
  },
  nyquist: {
    term: 'Nyquist',
    text: 'La mitad de la frecuencia de muestreo. Los pulsos NRZ rectangulares no están limitados en banda: parte de su energía queda por encima de Nyquist y se pliega; la app estima esa fracción.',
  },
  nrz: { term: 'NRZ unipolar', text: 'Cada bit se representa con un nivel constante durante T_b: 0 para el bit 0 y 1 para el bit 1.' },
  hann: {
    term: 'Ventana de Hann',
    text: 'Suaviza los extremos del intervalo analizado para reducir la fuga espectral. Se normaliza por la suma de la ventana para que un tono de amplitud A se lea como A.',
  },
  resolution: {
    term: 'Resolución frente a espaciado de bins',
    text: 'El espaciado entre bins es F_s / N_FFT. La capacidad de separar frecuencias depende de la duración observada L (≈ 1,44·F_s/L con Hann). Rellenar con ceros interpola la curva pero no mejora la resolución.',
  },
  dc: {
    term: 'Componente continua (DC)',
    text: 'El valor medio de la señal. En la NRZ unipolar es la proporción de unos; no se resta. Cerca de 0 Hz el lóbulo de la ventana de esa componente ocupa unos 2·F_s/L Hz.',
  },
  pcm: {
    term: 'PCM educativo',
    text: 'Grabación remuestreada a 8 000 muestras/s (filtro antialias: paso hasta 3 400 Hz, rechazo desde 4 000 Hz) y cuantizada a 8 bits sin signo: q = min(255, max(0, ⌊128·(x + 1)⌋)). 1 s de voz son 64 000 bits.',
  },
};
