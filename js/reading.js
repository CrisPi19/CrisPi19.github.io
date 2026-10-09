/*
 * Ejercicio de lectura (módulo 4). Sin DOM ni canvas: solo estado y eventos.
 * Lo común (fases, cronómetro, pausa, cajas Leitner, historial) está en js/session.js.
 *
 * Dos modos (config.mode), en la misma pizarra y con las mismas claves:
 *   'notes'   UNA nota escrita; se responde con la PRIMERA tecla que se toca: tiene que ser
 *             esa nota en su octava exacta (F♯4 no se responde con F♯3).
 *   'chords'  un acorde escrito en bloque (sin su nombre: se LEE, no se reconoce el
 *             símbolo); se marcan las teclas y se confirma con submit(). Correcto =
 *             exactamente esas notas en esas octavas (no valen inversiones ni duplicaciones).
 *
 * Configuración:
 *   clef         'treble' (sol), 'bass' (fa) o 'both'
 *   ledger       false: solo el pentagrama (y el espacio justo encima/debajo)
 *                true: hasta 2 líneas adicionales arriba y abajo
 *   accidentals  (notas) true: también notas con ♯ o ♭ (solo de tecla negra: sin E♯, C♭…)
 *   chordTypes   (acordes) tipos que entran: tríadas, suspendidos y cuatríadas
 *   chordRoots   (acordes) 'naturals' o 'all' (las 12 tónicas)
 *   inversions   (acordes) true: también inversiones (en posición cerrada)
 * Un acorde se escribe en una octava donde todas sus notas quepan en la pizarra y en UNA
 * ventana del teclado (C2–C4, C3–C5 o C4–C6); si no cabe en ninguna, no entra.
 *
 * Eventos (además de los comunes de Session):
 *   'exercise:new'      notas:   { kind: 'reading', mode: 'notes', id, clef, pitch }
 *                       acordes: { kind: 'reading', mode: 'chords', id, clef, root, type,
 *                                  inversion, pitches }
 *   'note:on'           { midi, source }   ← cada tecla pulsada (para el sonido)
 *   'selection:change'  { notes, count }   ← (acordes) NUNCA dice si la selección es correcta
 *   'answer:empty'      {}                 ← (acordes) se confirmó sin notas
 *   'answer:correct' / 'answer:wrong'
 *                       notas:   { …, played, playedPitch }
 *                       acordes: { …, notes, result }   (ver compareChordReading)
 *   'config:change'     { config }
 */
import {
  LETTERS, NATURAL_ROOTS, ROOTS, CHORD_TYPES, pitchMidi, letterSteps, isBlackKey, notePc,
  spellVoicing,
} from './theory.js';
import { Session } from './session.js';

/** Un acierto es "rápido" (sube de caja) si tarda como máximo esto (por nota, en acordes). */
export const SLOW_MS = 2000;

export const MODES = ['notes', 'chords'];
export const CLEFS = ['treble', 'bass'];
export const CLEF_NAMES = { treble: 'sol', bass: 'fa' };

/** Tipos de acorde de Lectura (sin 9 ni m6/9) y los que entran de inicio: las tríadas. */
export const READING_CHORD_TYPES = ['maj', 'm', 'dim', 'aug', 'sus2', 'sus4', 'maj7', 'dom7', 'm7', 'm7b5'];
export const DEFAULT_CHORD_TYPES = ['maj', 'm', 'dim', 'aug'];

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
/** Ventanas del teclado (nota inicial; cada una abarca 2 octavas). Igual que en js/layers/piano.js. */
const WINDOWS = [36, 48, 60];
const WINDOW_SPAN = 24;

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
export const chordItemId = (clef, root, type, inversion) => `acorde|${clef}|${root}|${type}|${inversion}`;

/** Notas: 'treble|F#4'. Acordes: 'acorde|treble|C|maj|0' (clave, tónica, tipo, inversión). */
export function parseId(id) {
  const parts = id.split('|');
  if (parts[0] === 'acorde') {
    const [, clef, root, type, inversion] = parts;
    return { id, mode: 'chords', clef, root, type, inversion: Number(inversion) };
  }
  const [clef, text] = parts;
  return { id, mode: 'notes', clef, pitch: parsePitch(text) };
}

export function sanitizeConfig(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const types = Array.isArray(s.chordTypes) ? READING_CHORD_TYPES.filter((t) => s.chordTypes.includes(t)) : [];
  return {
    mode: MODES.includes(s.mode) ? s.mode : 'notes',
    clef: ['treble', 'bass', 'both'].includes(s.clef) ? s.clef : 'treble',
    ledger: s.ledger === true,
    accidentals: s.accidentals === true,
    chordTypes: types.length ? types : [...DEFAULT_CHORD_TYPES],
    chordRoots: s.chordRoots === 'all' ? 'all' : 'naturals',
    inversions: s.inversions === true,
  };
}

/** Claves que entran con esta configuración. */
export const clefsOf = (config) => (config.clef === 'both' ? CLEFS : [config.clef]);

/** Una tecla escrita con ♭ (flats) o con ♯: 63 → E♭4 o D♯4. Las blancas, naturales. */
export function spellMidi(midi, flats = false) {
  const pc = ((midi % 12) + 12) % 12;
  const names = flats
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { name: names[pc], octave: Math.floor(midi / 12) - 1, midi };
}

/**
 * Cómo escribir la tecla que se tocó, para mostrarla junto a la nota pedida: blanca →
 * natural; negra → con la misma alteración que la nota pedida (♭ si la pedida lleva ♭,
 * si no ♯). Así E♭4 pedida y E4 tocada se ven como E♭ y E con becuadro.
 */
export function spellPlayed(midi, target) {
  return spellMidi(midi, target.name.includes('b'));
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

/* ---------------- Acordes escritos ---------------- */

/**
 * Acorde escrito en posición cerrada con la tónica en `octave`, en la inversión pedida
 * (las `inversion` notas de abajo suben una octava). De grave a agudo:
 * [{ name, octave, midi, degree }].
 */
export function chordReadingVoicing(root, type, inversion, octave) {
  const notes = spellVoicing(root, type, pitchMidi({ name: root, octave }));
  return notes
    .map((p, i) => (i < inversion ? { ...p, octave: p.octave + 1, midi: p.midi + 12 } : p))
    .sort((a, b) => a.midi - b.midi);
}

/** ¿Caben todas las notas en una misma ventana del teclado? */
const fitsOneWindow = (pitches) => WINDOWS.some((from) =>
  pitches.every((p) => p.midi >= from && p.midi <= from + WINDOW_SPAN));

/**
 * Todas las maneras de escribir el acorde en la pizarra de esa clave (una por octava):
 * cada nota dentro del rango del nivel (sin líneas adicionales, o hasta 2) y todas en una
 * ventana del teclado. Vacío si no cabe en ninguna octava.
 */
export function chordPlacements(clef, root, type, inversion, { ledger = false } = {}) {
  const [low, high] = READING_RANGES[clef][ledger ? 'ledger' : 'staff'].map((t) => letterSteps(parsePitch(t)));
  const out = [];
  for (let octave = 1; octave <= 6; octave++) {
    const pitches = chordReadingVoicing(root, type, inversion, octave);
    const onStaff = pitches.every((p) => letterSteps(p) >= low && letterSteps(p) <= high);
    if (onStaff && fitsOneWindow(pitches)) out.push(pitches);
  }
  return out;
}

/**
 * Compara las teclas marcadas con el acorde escrito, nota por nota y octava por octava.
 *   correct  exactamente las mismas teclas
 *   hit      teclas marcadas que están escritas (MIDI)
 *   missing  notas escritas que no se marcaron ({ name, octave, midi, degree })
 *   extra    teclas marcadas que no están escritas (MIDI)
 */
export function compareChordReading(pitches, notes) {
  const written = new Set(pitches.map((p) => p.midi));
  const played = new Set(notes);
  const hit = [...played].filter((m) => written.has(m)).sort((a, b) => a - b);
  const extra = [...played].filter((m) => !written.has(m)).sort((a, b) => a - b);
  const missing = pitches.filter((p) => !played.has(p.midi));
  return { correct: !missing.length && !extra.length, hit, missing, extra };
}

/** Cómo escribir las teclas que sobraron: con ♭ si el acorde lleva ♭, si no con ♯. */
export function spellExtras(extra, pitches) {
  const flats = pitches.some((p) => p.name.includes('b'));
  return extra.map((midi) => spellMidi(midi, flats));
}

/* ---------------- Qué entra en rotación ---------------- */

/** Ids de las notas que entran con esta configuración. */
export function noteIds(config) {
  const { ledger, accidentals } = config;
  return clefsOf(config).flatMap((clef) =>
    readingPitches(clef, { ledger, accidentals }).map((p) => itemId(clef, p)));
}

/** Ids de los acordes que entran con esta configuración (solo los que caben en la pizarra). */
export function chordIds(config) {
  const { ledger, chordTypes, chordRoots, inversions } = config;
  const roots = chordRoots === 'all' ? ROOTS : NATURAL_ROOTS;
  const ids = [];
  for (const clef of clefsOf(config)) {
    for (const type of chordTypes) {
      const count = inversions ? CHORD_TYPES[type].degrees.length : 1;
      for (const root of roots) {
        for (let inv = 0; inv < count; inv++) {
          if (chordPlacements(clef, root, type, inv, { ledger }).length) ids.push(chordItemId(clef, root, type, inv));
        }
      }
    }
  }
  return ids;
}

export class Reader extends Session {
  /** Mismas opciones que Session (bus, persist, now, random). */
  constructor(options) {
    super({ ...options, kind: 'reading', storageKey: 'lectura' });
    this.config = sanitizeConfig(this.loadConfig(null));
    this.selected = new Set();
  }

  activeIds() {
    return this.config.mode === 'chords' ? chordIds(this.config) : noteIds(this.config);
  }

  /** Plantea el siguiente ejercicio (elegido por repetición espaciada). */
  next() {
    this.selected.clear();
    const item = parseId(this.pickId(this.activeIds()));
    if (item.mode === 'chords') {
      // Si cabe en varias octavas, una al azar: así se lee en distintas zonas de la pizarra.
      const options = chordPlacements(item.clef, item.root, item.type, item.inversion, { ledger: this.config.ledger });
      item.pitches = options[Math.floor(this.random() * options.length)];
    }
    this.begin(item);
    if (item.mode === 'chords') this.emitSelection();
  }

  /**
   * Única puerta de entrada de notas (pantalla y, en el módulo 2, MIDI). Siempre avisa
   * 'note:on' para que suene. Mientras se pregunta: en notas, la primera tecla ES la
   * respuesta; en acordes, cada tecla se marca o se desmarca.
   */
  noteOn(midi, source = 'screen') {
    if (this.paused) return null;
    this.bus.emit('note:on', { midi, source });
    if (!this.canAnswer()) return null;
    if (this.current.mode === 'chords') {
      if (this.selected.has(midi)) this.selected.delete(midi);
      else this.selected.add(midi);
      this.emitSelection();
      return null;
    }
    const { pitch } = this.current;
    const playedPitch = spellPlayed(midi, pitch);
    return this.finish({
      correct: midi === pitch.midi,
      slowThresholdMs: SLOW_MS,
      detail: { played: midi, playedPitch },
      historyExtra: { played: pitchText(playedPitch) },
    });
  }

  /* ----- Acordes: selección y confirmación (como en js/trainer.js) ----- */

  clear() {
    if (!this.canAnswer() || this.current.mode !== 'chords' || !this.selected.size) return;
    this.selected.clear();
    this.emitSelection();
  }

  getSelected() {
    return [...this.selected].sort((a, b) => a - b);
  }

  emitSelection() {
    const notes = this.getSelected();
    this.bus.emit('selection:change', { notes, count: notes.length });
  }

  /** Confirma el acorde marcado. Devuelve el detalle publicado, o null si no correspondía. */
  submit() {
    if (!this.canAnswer() || this.current.mode !== 'chords') return null;
    const notes = this.getSelected();
    if (!notes.length) {
      this.bus.emit('answer:empty', {});
      return null;
    }
    const { pitches } = this.current;
    const result = compareChordReading(pitches, notes);
    return this.finish({
      correct: result.correct,
      slowThresholdMs: SLOW_MS * pitches.length,
      detail: { notes, result },
      historyExtra: {
        written: pitches.map(pitchText),
        missing: result.missing.map(pitchText),
        extra: spellExtras(result.extra, pitches).map(pitchText),
      },
    });
  }

  setConfig(next) {
    const before = this.config;
    this.config = sanitizeConfig(next);
    this.saveConfig(this.config);
    this.bus.emit('config:change', { config: this.config });
    // Un acorde puede seguir activo con otra octava: si cambian las líneas adicionales, se
    // cambia igual (el que está escrito podría tener líneas que ya no se piden).
    const relocate = this.current?.mode === 'chords' && before.ledger !== this.config.ledger;
    if (relocate || !this.activeIds().includes(this.current?.id)) this.next();
  }
}
