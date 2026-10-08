/*
 * Ejercicio de lectura (módulo 4). Sin DOM ni canvas: solo estado y eventos.
 * Lo común (fases, cronómetro, pausa, cajas Leitner, historial) está en js/session.js.
 *
 * Se muestra UNA nota escrita en el pentagrama y se responde con la PRIMERA tecla que se
 * toca: tiene que ser esa nota en su octava exacta (F♯4 no se responde con F♯3).
 *
 * Qué notas entran lo decide la configuración:
 *   clave           'treble' (sol), 'bass' (fa) o 'both'
 *   ledger          false: solo el pentagrama (y el espacio justo encima/debajo)
 *                   true: hasta 2 líneas adicionales arriba y abajo
 *   accidentals     true: también notas con ♯ o ♭ (solo las de tecla negra: sin E♯, C♭…)
 *
 * Eventos (además de los comunes de Session):
 *   'exercise:new'   { kind: 'reading', id, clef, pitch }
 *   'note:on'        { midi, source }       ← cada tecla pulsada (para el sonido)
 *   'answer:correct' / 'answer:wrong'  { …, played, playedPitch }
 *   'config:change'  { config }
 */
import { LETTERS, pitchMidi, letterSteps, isBlackKey, notePc } from './theory.js';
import { Session } from './session.js';

/** Un acierto es "rápido" (sube de caja) si tarda como máximo esto. */
export const SLOW_MS = 2000;

export const CLEFS = ['treble', 'bass'];
export const CLEF_NAMES = { treble: 'sol', bass: 'fa' };

/**
 * Notas extremas de cada nivel (naturales). "staff" incluye el espacio justo encima y
 * debajo del pentagrama (no llevan línea adicional); "ledger" llega a 2 líneas adicionales.
 * Todas caben en el teclado (C2–C6): sol en C3–C6 y fa en C2–C4 más un poco.
 */
export const READING_RANGES = {
  treble: { staff: ['D4', 'G5'], ledger: ['A3', 'C6'] },
  bass: { staff: ['F2', 'B3'], ledger: ['C2', 'E4'] },
};

const KEYBOARD_MIN = 36; // C2
const KEYBOARD_MAX = 84; // C6

/** 'F#4' → { name: 'F#', octave: 4, midi: 66 }. */
export function parsePitch(text) {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(text);
  if (!m) throw new Error(`Nota escrita no válida: ${text}`);
  const pitch = { name: m[1], octave: Number(m[2]) };
  return { ...pitch, midi: pitchMidi(pitch) };
}

export const pitchText = ({ name, octave }) => `${name}${octave}`;

/** Notas de un nivel, de grave a agudo: [{ name, octave, midi }]. */
export function readingPitches(clef, { ledger = false, accidentals = false } = {}) {
  const [low, high] = READING_RANGES[clef][ledger ? 'ledger' : 'staff'].map(parsePitch);
  const out = [];
  for (let step = letterSteps(low); step <= letterSteps(high); step++) {
    const letter = LETTERS[step % 7];
    const octave = Math.floor(step / 7);
    const names = accidentals ? [`${letter}b`, letter, `${letter}#`] : [letter];
    for (const name of names) {
      const pitch = { name, octave };
      const midi = pitchMidi(pitch);
      // Solo alteraciones de tecla negra (E♯ = F y C♭ = B confunden sin enseñar a leer).
      if (name.length > 1 && !isBlackKey(midi)) continue;
      if (midi < KEYBOARD_MIN || midi > KEYBOARD_MAX) continue;
      out.push({ ...pitch, midi });
    }
  }
  return out;
}

export const itemId = (clef, pitch) => `${clef}|${pitchText(pitch)}`;

export function parseId(id) {
  const [clef, text] = id.split('|');
  return { id, clef, pitch: parsePitch(text) };
}

export function sanitizeConfig(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    clef: ['treble', 'bass', 'both'].includes(s.clef) ? s.clef : 'treble',
    ledger: s.ledger === true,
    accidentals: s.accidentals === true,
  };
}

/** Claves que entran con esta configuración. */
export const clefsOf = (config) => (config.clef === 'both' ? CLEFS : [config.clef]);

/**
 * Cómo escribir la tecla que se tocó, para mostrarla junto a la nota pedida: blanca →
 * natural; negra → con la misma alteración que la nota pedida (♭ si la pedida lleva ♭,
 * si no ♯). Así E♭4 pedida y E4 tocada se ven como E♭ y E con becuadro.
 */
export function spellPlayed(midi, target) {
  const flats = target.name.includes('b');
  const pc = ((midi % 12) + 12) % 12;
  const names = flats
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { name: names[pc], octave: Math.floor(midi / 12) - 1, midi };
}

const display = (name) => name[0] + name.slice(1).replace('#', '♯').replace('b', '♭');
const displayPitch = (p) => display(p.name) + p.octave;
const OCTAVES = ['', 'una octava', 'dos octavas', 'tres octavas', 'cuatro octavas'];

/**
 * Explica un error de lectura en una frase (para el panel HTML):
 *   - misma nota, otra octava: "la nota correcta, pero una octava más abajo"
 *   - misma letra, otra alteración: "la misma letra, pero sin el ♯"
 *   - otra letra: la distancia como intervalo ("una 3.ª más abajo")
 */
export function describeMiss(target, played) {
  const head = `Tocaste ${displayPitch(played)}`;
  const dir = played.midi > target.midi ? 'más arriba' : 'más abajo';
  if (notePc(played.name) === notePc(target.name)) {
    const octaves = Math.round(Math.abs(played.midi - target.midi) / 12);
    return `${head}: la nota correcta, pero ${OCTAVES[octaves] ?? `${octaves} octavas`} ${dir}.`;
  }
  const steps = letterSteps(played) - letterSteps(target);
  if (steps === 0) {
    const acc = target.name.slice(1);
    return acc
      ? `${head}: la misma línea o espacio, pero sin el ${acc === '#' ? '♯' : '♭'}.`
      : `${head}: la misma línea o espacio, pero esa nota no lleva alteración.`;
  }
  return `${head}: está una ${Math.abs(steps) + 1}.ª ${dir}.`;
}

export class Reader extends Session {
  /** Mismas opciones que Session (bus, persist, now, random). */
  constructor(options) {
    super({ ...options, kind: 'reading', storageKey: 'lectura' });
    this.config = sanitizeConfig(this.loadConfig(null));
  }

  activeIds() {
    const { ledger, accidentals } = this.config;
    return clefsOf(this.config).flatMap((clef) =>
      readingPitches(clef, { ledger, accidentals }).map((p) => itemId(clef, p)));
  }

  /** Plantea la siguiente nota (elegida por repetición espaciada). */
  next() {
    this.begin(parseId(this.pickId(this.activeIds())));
  }

  /**
   * Única puerta de entrada de notas (pantalla y, en el módulo 2, MIDI). Siempre avisa
   * 'note:on' para que suene; mientras se pregunta, la primera tecla ES la respuesta.
   */
  noteOn(midi, source = 'screen') {
    if (this.paused) return null;
    this.bus.emit('note:on', { midi, source });
    if (!this.canAnswer()) return null;
    const { pitch } = this.current;
    const playedPitch = spellPlayed(midi, pitch);
    return this.finish({
      correct: midi === pitch.midi,
      slowThresholdMs: SLOW_MS,
      detail: { played: midi, playedPitch },
      historyExtra: { played: pitchText(playedPitch) },
    });
  }

  setConfig(next) {
    this.config = sanitizeConfig(next);
    this.saveConfig(this.config);
    this.bus.emit('config:change', { config: this.config });
    if (!this.activeIds().includes(this.current?.id)) this.next();
  }
}
