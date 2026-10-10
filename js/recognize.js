/*
 * Reconocer intervalos y escalas (módulo 5). Sin DOM ni canvas: solo estado y eventos.
 * Lo común (fases, cronómetro, pausa, cajas Leitner, historial) está en js/session.js.
 *
 * Construir (nombre → teclas) ya lo entrenan Acordes y Lectura; aquí se entrena el camino
 * que faltaba: ver o OÍR algo y saber qué es. Cada ejercicio es de una familia
 * ('intervals' o 'scales') y de una prueba:
 *   'staff'  se ve escrito en la pizarra → se elige su nombre
 *   'ear'    se oye → se elige su nombre
 *   'play'   se oye → se toca en el piano, en la OCTAVA EXACTA:
 *              intervalo: la primera nota (dorada) está dada; la primera tecla que se toca
 *                         (que no sea la dada) es la respuesta: la otra nota
 *              escala:    la tónica y su octava (doradas) están dadas; se marcan las notas
 *                         de en medio y se confirma con submit()
 *
 * Configuración:
 *   family       'intervals' | 'scales'
 *   source       'staff' (pentagrama), 'ear' (oído) o 'both'
 *   answer       (oído) 'name' (botones con el nombre) o 'play' (tocar)
 *   form         (intervalos) 'asc', 'desc', 'harm' (las dos juntas) o 'mix'
 *   clef         (pentagrama) 'treble', 'bass' o 'both'
 *   accidentals  (intervalos en el pentagrama) true: también notas con ♯ o ♭
 *   intervals    intervalos que entran (los 12 de RECOGNIZE_INTERVALS; 'TT' = tritono)
 *   scales       escalas que entran (ids de SCALE_TYPES)
 *   roots        (escalas) 'naturals' o 'all'
 *
 * Eventos (además de los comunes de Session):
 *   'exercise:new'      { kind: 'recognize', id, family, test, clef, pitches, given, target,
 *                         interval, spelled, form | scale, root }
 *                       interval: la respuesta ('TT' en el tritono); spelled: cómo está
 *                       escrito (id de INTERVALS: 'A4' o 'd5' en el tritono)
 *                       pitches: notas escritas en el orden en que se escriben y suenan
 *                       (en una escala, de la tónica a su octava)
 *   'note:on'           { midi, source }   ← cada tecla pulsada (para el sonido)
 *   'selection:change'  { notes, count }   ← (escala tocada) NUNCA dice si es correcta
 *   'answer:empty'      {}                 ← (escala tocada) se confirmó sin notas
 *   'answer:correct' / 'answer:wrong'
 *       por nombre:          { …, answer }
 *       intervalo tocado:    { …, played, playedPitch }
 *       escala tocada:       { …, notes, result }  (ver compareScalePlay)
 *   'config:change'     { config }
 */
import {
  INTERVALS, SCALE_TYPES, ROOTS, NATURAL_ROOTS, letterSteps, pitchAbove, pitchBelow,
  pitchMidi, spellScaleVoicing, displayNote,
} from './theory.js';
import { ledgerYs, noteY } from './notation.js';
import { READING_RANGES, readingPitches, parsePitch, spellMidi } from './reading.js';
import { Session } from './session.js';

export const FAMILIES = ['intervals', 'scales'];
export const SOURCES = ['staff', 'ear', 'both'];
export const ANSWERS = ['name', 'play'];
export const FORMS = ['asc', 'desc', 'harm'];
export const CLEFS = ['treble', 'bass'];

/**
 * Los 12 intervalos de la octava, uno por cantidad de semitonos (1 a 12). El tritono
 * ('TT') es UNO solo: se escribe como 4A (C–F♯) o como 5d (C–G♭), al azar, y suena igual.
 * Así hay 12 respuestas fijas (2 filas de 6 botones) y nunca dos botones que suenan igual.
 */
export const RECOGNIZE_INTERVALS = ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
export const INTERVAL_GROUPS = {
  'Segundas y terceras': ['m2', 'M2', 'm3', 'M3'],
  'Cuartas, tritono y quintas': ['P4', 'TT', 'P5'],
  'Sextas, séptimas y octava': ['m6', 'M6', 'm7', 'M7', 'P8'],
};
/** Cómo se escribe cada respuesta (ids de INTERVALS). */
const SPELLINGS = { TT: ['A4', 'd5'] };
const spellingsOf = (interval) => SPELLINGS[interval] ?? [interval];

/** Nombre corto ('3m', '4A/5d') y largo de una respuesta. */
export const intervalShort = (id) => (id === 'TT' ? '4A/5d' : INTERVALS[id].short);
export const intervalName = (id) => (id === 'TT' ? 'Tritono (cuarta aumentada o quinta disminuida)' : INTERVALS[id].name);
/** De inicio entran los 12 (se pueden quitar en "Intervalos que entran"). */
export const DEFAULT_INTERVALS = [...RECOGNIZE_INTERVALS];

/**
 * Versión de la configuración guardada. La 1 empezaba con solo 3m, 3M, 5J y 8J; al pasar
 * a la 2 los intervalos guardados se reemplazan una vez por los 12 (lo demás se conserva).
 */
const CONFIG_VERSION = 2;

export const RECOGNIZE_SCALES = Object.keys(SCALE_TYPES);
export const DEFAULT_SCALES = ['major', 'minor', 'harmonic', 'melodic'];

/** Nombres cortos de las escalas (botones y burbuja del canvas, donde no cabe "Menor natural (eólico)"). */
export const SCALE_SHORT = {
  major: 'mayor', minor: 'menor natural', harmonic: 'menor armónica', melodic: 'menor melódica',
  dorian: 'dórico', phrygian: 'frigio', lydian: 'lidio', mixolydian: 'mixolidio', locrian: 'locrio',
  pentaMajor: 'penta mayor', pentaMinor: 'penta menor', blues: 'blues',
};

/** 'D lidio', 'B♭ menor armónica'. */
export const scaleLabel = (root, scale) => `${displayNote(root)} ${SCALE_SHORT[scale]}`;

/**
 * Hasta cuántos ms un acierto cuenta como "rápido" (sube de caja). Por oído se suma lo
 * que dura escuchar; una escala tocada da 2 s por cada nota que hay que marcar.
 */
export const SLOW_MS = {
  intervals: { staff: 2000, ear: 3000, play: 3000 },
  scales: { staff: 4000, ear: 6000 },
  scalePlayPerNote: 2000,
};

/**
 * Por oído todo suena en C4–C6 (una ventana del teclado: así, al tocar, las dos notas o
 * la escala entera se ven a la vez) y se escribe en clave de sol al mostrar la respuesta.
 */
export const EAR_FROM = 60;
export const EAR_TO = 84;

/* ---------------- Ids ---------------- */

/** Intervalo: 'int|ear|m3|asc'. Escala: 'esc|staff|lydian|D' (en el pentagrama, por tónica) o 'esc|ear|lydian'. */
export const intervalId = (test, interval, form) => `int|${test}|${interval}|${form}`;
export const scaleId = (test, scale, root) => (test === 'staff' ? `esc|staff|${scale}|${root}` : `esc|${test}|${scale}`);

export function parseId(id) {
  const [fam, test, a, b] = id.split('|');
  if (fam === 'int') return { id, family: 'intervals', test, interval: a, form: b };
  return { id, family: 'scales', test, scale: a, root: b ?? null };
}

/* ---------------- Configuración ---------------- */

export function sanitizeConfig(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const pick = (list, all, fallback) => {
    const out = Array.isArray(list) ? all.filter((x) => list.includes(x)) : [];
    return out.length ? out : [...fallback];
  };
  const current = s.v === CONFIG_VERSION;
  return {
    v: CONFIG_VERSION,
    family: FAMILIES.includes(s.family) ? s.family : 'intervals',
    source: SOURCES.includes(s.source) ? s.source : 'both',
    answer: ANSWERS.includes(s.answer) ? s.answer : 'name',
    form: [...FORMS, 'mix'].includes(s.form) ? s.form : 'asc',
    clef: ['treble', 'bass', 'both'].includes(s.clef) ? s.clef : 'treble',
    accidentals: s.accidentals === true,
    // Guardados de antes: 4A y 5d separados → el tritono; las novenas ya no están.
    intervals: current ? pick(s.intervals, RECOGNIZE_INTERVALS, DEFAULT_INTERVALS) : [...DEFAULT_INTERVALS],
    scales: pick(s.scales, RECOGNIZE_SCALES, DEFAULT_SCALES),
    roots: s.roots === 'all' ? 'all' : 'naturals',
  };
}

export const clefsOf = (config) => (config.clef === 'both' ? CLEFS : [config.clef]);
export const formsOf = (config) => (config.form === 'mix' ? FORMS : [config.form]);
export const rootsOf = (config) => (config.roots === 'all' ? ROOTS : NATURAL_ROOTS);

/** Pruebas que entran: el pentagrama se nombra; lo que se oye se nombra o se toca. */
export function testsOf(config) {
  const tests = [];
  if (config.source !== 'ear') tests.push('staff');
  if (config.source !== 'staff') tests.push(config.answer === 'play' ? 'play' : 'ear');
  return tests;
}

/* ---------------- Intervalos ---------------- */

/** Una nota se escribe bien si lleva a lo más una alteración y no es E♯, B♯, C♭ ni F♭ (confunden). */
function plainSpelling({ name }) {
  return name.length <= 2 && !['E#', 'B#', 'Cb', 'Fb'].includes(name);
}

/** Notas de partida para el oído: C4–C6, con ♯ y con ♭ en las negras. */
function earPitches() {
  return readingPitches('treble', { ledger: true, accidentals: true })
    .filter((p) => p.midi >= EAR_FROM && p.midi <= EAR_TO);
}

const withMidi = (p) => ({ ...p, midi: pitchMidi(p) });

/**
 * Todas las parejas [dada, otra, escrito] posibles para una respuesta (el tritono, con sus
 * dos escrituras), en el pentagrama de una clave (sin líneas adicionales) o, con
 * clef = null, para el oído (C4–C6). `escrito` es el id de INTERVALS ('A4' o 'd5' en el
 * tritono). La dada es la de abajo en 'asc' y 'harm', y la de arriba en 'desc'.
 */
export function intervalCandidates(interval, form, clef = null, options = {}) {
  return spellingsOf(interval).flatMap((spelled) => spelledCandidates(spelled, form, clef, options));
}

function spelledCandidates(spelled, form, clef, { accidentals = true }) {
  const { degree } = INTERVALS[spelled];
  let starts;
  let inRange;
  if (clef) {
    starts = readingPitches(clef, { ledger: false, accidentals });
    const [low, high] = READING_RANGES[clef].staff.map((t) => letterSteps(parsePitch(t)));
    inRange = (p) => letterSteps(p) >= low && letterSteps(p) <= high;
  } else {
    starts = earPitches();
    inRange = (p) => p.midi >= EAR_FROM && p.midi <= EAR_TO;
  }
  const out = [];
  for (const start of starts) {
    if (!plainSpelling(start)) continue;
    const other = withMidi(form === 'desc' ? pitchBelow(start, degree) : pitchAbove(start, degree));
    if (!inRange(other) || !plainSpelling(other)) continue;
    if (clef && !accidentals && other.name.length > 1) continue;
    out.push([start, other, spelled]);
  }
  return out;
}

/* ---------------- Escalas ---------------- */

/** ¿Se escribe la escala sin dobles alteraciones? (D♭ menor tendría B𝄫: no entra). */
export function scaleSpellable(root, scale) {
  return spellScaleVoicing(root, scale, 60).every((p) => p.name.length <= 2);
}

/** Cuántas líneas adicionales necesita una lista de notas en una clave. */
const ledgerCount = (pitches, clef) => pitches.reduce((n, p) => n + ledgerYs(noteY(p, clef)).length, 0);

/**
 * Cómo escribir la escala (tónica → octava) en la pizarra de una clave: de las octavas
 * donde todas sus notas caben (hasta 2 líneas adicionales), la que usa menos líneas
 * adicionales. null si no cabe.
 */
export function scalePlacement(root, scale, clef) {
  const [low, high] = READING_RANGES[clef].ledger.map((t) => letterSteps(parsePitch(t)));
  let best = null;
  let bestLedgers = Infinity;
  for (let from = 24; from <= 84; from += 12) {
    const pitches = spellScaleVoicing(root, scale, from);
    if (!pitches.every((p) => letterSteps(p) >= low && letterSteps(p) <= high)) continue;
    const n = ledgerCount(pitches, clef);
    if (n < bestLedgers) {
      best = pitches;
      bestLedgers = n;
    }
  }
  return best;
}

/**
 * Compara las teclas marcadas con la escala (sin contar la tónica ni su octava, que están
 * dadas), nota por nota y octava por octava. Igual que compareChordReading:
 *   correct, hit (MIDI), missing (notas escritas), extra (MIDI)
 */
export function compareScalePlay(pitches, notes) {
  const inner = pitches.slice(1, -1);
  const given = new Set([pitches[0].midi, pitches[pitches.length - 1].midi]);
  const written = new Set(inner.map((p) => p.midi));
  const played = new Set(notes.filter((m) => !given.has(m)));
  const hit = [...played].filter((m) => written.has(m)).sort((a, b) => a - b);
  const extra = [...played].filter((m) => !written.has(m)).sort((a, b) => a - b);
  const missing = inner.filter((p) => !played.has(p.midi));
  return { correct: !missing.length && !extra.length, hit, missing, extra };
}

/* ---------------- Qué entra en rotación ---------------- */

export function intervalIds(config) {
  const ids = [];
  for (const test of testsOf(config)) {
    for (const interval of config.intervals) {
      for (const form of formsOf(config)) {
        const ok = test === 'staff'
          ? clefsOf(config).some((clef) => intervalCandidates(interval, form, clef, config).length)
          : intervalCandidates(interval, form).length;
        if (ok) ids.push(intervalId(test, interval, form));
      }
    }
  }
  return ids;
}

export function scaleIds(config) {
  const ids = [];
  const roots = rootsOf(config);
  for (const test of testsOf(config)) {
    for (const scale of config.scales) {
      if (test !== 'staff') {
        if (roots.some((r) => scaleSpellable(r, scale))) ids.push(scaleId(test, scale));
        continue;
      }
      for (const root of roots) {
        if (!scaleSpellable(root, scale)) continue;
        if (clefsOf(config).some((clef) => scalePlacement(root, scale, clef))) ids.push(scaleId(test, scale, root));
      }
    }
  }
  return ids;
}

/** Nombre corto de una distancia en semitonos (para explicar una nota mal tocada). */
const SEMITONE_NAMES = ['unísono', '2m', '2M', '3m', '3M', '4J', 'tritono', '5J', '6m', '6M', '7m', '7M', '8J', '9m', '9M'];
export function semitoneName(semitones) {
  const n = Math.abs(semitones);
  return SEMITONE_NAMES[n] ?? `${n} semitonos`;
}

export class Recognizer extends Session {
  /** Mismas opciones que Session (bus, persist, now, random). */
  constructor(options) {
    super({ ...options, kind: 'recognize', storageKey: 'reconocer' });
    this.config = sanitizeConfig(this.loadConfig(null));
    this.selected = new Set();
  }

  activeIds() {
    return this.config.family === 'scales' ? scaleIds(this.config) : intervalIds(this.config);
  }

  choice(list) {
    return list[Math.floor(this.random() * list.length)];
  }

  next() {
    this.selected.clear();
    const item = parseId(this.pickId(this.activeIds()));
    if (item.family === 'intervals') this.buildInterval(item);
    else this.buildScale(item);
    this.begin(item);
    if (item.test === 'play' && item.family === 'scales') this.emitSelection();
  }

  buildInterval(item) {
    const { interval, form, test } = item;
    let pair;
    if (test === 'staff') {
      const clefs = clefsOf(this.config).filter((c) => intervalCandidates(interval, form, c, this.config).length);
      item.clef = this.choice(clefs);
      pair = this.choice(intervalCandidates(interval, form, item.clef, this.config));
    } else {
      item.clef = 'treble';
      pair = this.choice(intervalCandidates(interval, form));
    }
    const [given, target, spelled] = pair;
    item.spelled = spelled;
    item.given = given;
    item.target = target;
    // Armónico: se escribe en bloque (de grave a agudo); melódico: en el orden en que suena.
    item.pitches = [given, target];
  }

  buildScale(item) {
    const { scale, test } = item;
    if (test === 'staff') {
      const clefs = clefsOf(this.config).filter((c) => scalePlacement(item.root, scale, c));
      item.clef = this.choice(clefs);
      item.pitches = scalePlacement(item.root, scale, item.clef);
    } else {
      // Por oído la tónica no es lo que se pregunta: una al azar de las que entran.
      item.root = this.choice(rootsOf(this.config).filter((r) => scaleSpellable(r, scale)));
      item.clef = 'treble';
      item.pitches = spellScaleVoicing(item.root, scale, EAR_FROM);
    }
    item.given = item.pitches[0];
    item.target = item.pitches[item.pitches.length - 1];
  }

  /** ¿El ejercicio actual se responde eligiendo un nombre? */
  answersByName() {
    return this.current && this.current.test !== 'play';
  }

  /** Elige un nombre (id de intervalo o de escala). Devuelve el detalle publicado, o null. */
  choose(answer) {
    if (!this.canAnswer() || !this.answersByName()) return null;
    const c = this.current;
    let correct;
    if (c.family === 'intervals') {
      correct = answer === c.interval;
    } else {
      correct = answer === c.scale;
    }
    return this.finish({
      correct,
      slowThresholdMs: SLOW_MS[c.family][c.test],
      detail: { answer },
      historyExtra: { answer },
    });
  }

  /**
   * Única puerta de entrada de notas (pantalla y, más adelante, MIDI). Siempre avisa
   * 'note:on' para que suene. Solo cuenta como respuesta en la prueba 'play'.
   */
  noteOn(midi, source = 'screen') {
    if (this.paused) return null;
    this.bus.emit('note:on', { midi, source });
    if (!this.canAnswer() || this.current.test !== 'play') return null;
    const c = this.current;
    if (c.family === 'scales') {
      // La tónica y su octava están dadas: tocarlas solo suena (sirve de referencia).
      if (midi === c.given.midi || midi === c.target.midi) return null;
      if (this.selected.has(midi)) this.selected.delete(midi);
      else this.selected.add(midi);
      this.emitSelection();
      return null;
    }
    if (midi === c.given.midi) return null; // la dada suena de referencia, no es respuesta
    const playedPitch = spellMidi(midi, c.target.name.includes('b'));
    return this.finish({
      correct: midi === c.target.midi,
      slowThresholdMs: SLOW_MS.intervals.play,
      detail: { played: midi, playedPitch },
      historyExtra: { played: `${playedPitch.name}${playedPitch.octave}` },
    });
  }

  /* ----- Escala tocada: selección y confirmación ----- */

  isScalePlay() {
    return this.current?.family === 'scales' && this.current.test === 'play';
  }

  clear() {
    if (!this.canAnswer() || !this.isScalePlay() || !this.selected.size) return;
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

  submit() {
    if (!this.canAnswer() || !this.isScalePlay()) return null;
    const notes = this.getSelected();
    if (!notes.length) {
      this.bus.emit('answer:empty', {});
      return null;
    }
    const { pitches } = this.current;
    const result = compareScalePlay(pitches, notes);
    return this.finish({
      correct: result.correct,
      slowThresholdMs: SLOW_MS.scalePlayPerNote * (pitches.length - 2) + SLOW_MS.scales.ear,
      detail: { notes, result },
      historyExtra: { missing: result.missing.map((p) => `${p.name}${p.octave}`), extra: result.extra },
    });
  }

  setConfig(next) {
    this.config = sanitizeConfig(next);
    this.saveConfig(this.config);
    this.bus.emit('config:change', { config: this.config });
    if (!this.activeIds().includes(this.current?.id)) this.next();
  }
}
