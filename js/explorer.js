/*
 * Lógica del Explorador (módulo 3). Sin DOM: qué notas mostrar y cómo se comparan.
 *
 * Un "ítem" es un acorde o una escala sobre una tónica:
 *   { kind: 'chord' | 'scale', root: 'D', type: 'lydian' }
 * Se toca, se marca en el teclado y se escribe en el pentagrama con las MISMAS notas
 * (mismas octavas): así las tres representaciones coinciden.
 *
 * Octava según la clave: en sol la tónica va en la octava 4 (C4–B4) y en fa en la 3.
 * Todo cabe en una ventana del teclado (C4–C6 en sol, C3–C5 en fa); si algo se sale
 * (p. ej. la 9.ª de B9), baja una octava.
 */
import {
  CHORD_TYPES, SCALE_TYPES, chordName, displayNote, spellVoicing, spellScaleVoicing,
  fitToRange,
} from './theory.js';

export const KINDS = ['chord', 'scale'];

/** Ventana del teclado (nota inicial) que corresponde a cada clave. */
export const CLEF_RANGE = { treble: 60, bass: 48 };
const SPAN = 24;

export function typesOf(kind) {
  return kind === 'scale' ? SCALE_TYPES : CHORD_TYPES;
}

/** Nombre para mostrar: 'Fmaj7' o 'D Lidio'. */
export function itemName({ kind, root, type }) {
  return kind === 'scale' ? `${displayNote(root)} ${SCALE_TYPES[type].name}` : chordName(root, type);
}

/**
 * Notas escritas del ítem en la clave dada: [{ name, octave, midi, degree }].
 * Los acordes van en posición fundamental; las escalas suben una octava (con la tónica arriba).
 */
export function itemNotes({ kind, root, type }, clef = 'treble') {
  const from = CLEF_RANGE[clef]; // la tónica cae en la primera octava de la ventana
  const notes = kind === 'scale' ? spellScaleVoicing(root, type, from) : spellVoicing(root, type, from);
  return fitToRange(notes, from, from + SPAN);
}

/** Estado de cada nota al comparar A con B. */
export const STATUS = { ROOT: 'root', COMMON: 'common', ONLY_A: 'onlyA', ONLY_B: 'onlyB' };

const pc = (midi) => ((midi % 12) + 12) % 12;

/**
 * Compara dos listas de notas (normalmente el mismo tipo de ítem sobre la misma tónica)
 * por CLASE de altura: D4 y D5 cuentan como la misma nota.
 * Devuelve el estado de cada nota de A y de B (mismo orden que las listas):
 *   root   la tónica (degree '1' u '8')
 *   common está en las dos
 *   onlyA  solo en A (lo característico de A frente a B; p. ej. el ♯4 del lidio)
 *   onlyB  solo en B
 */
export function compareNotes(a, b) {
  const pcsA = new Set(a.map((n) => pc(n.midi)));
  const pcsB = new Set(b.map((n) => pc(n.midi)));
  const status = (n, other, only) => {
    if (n.degree === '1' || n.degree === '8') return STATUS.ROOT;
    return other.has(pc(n.midi)) ? STATUS.COMMON : only;
  };
  return {
    a: a.map((n) => status(n, pcsB, STATUS.ONLY_A)),
    b: b.map((n) => status(n, pcsA, STATUS.ONLY_B)),
  };
}

/** Estados sin comparar: la tónica se distingue, el resto es nota del ítem. */
export function plainStatus(notes) {
  return notes.map((n) => (n.degree === '1' || n.degree === '8' ? STATUS.ROOT : STATUS.COMMON));
}

/** Siguiente/anterior tipo en el orden de la teoría (con vuelta). */
export function stepType(kind, type, dir) {
  const ids = Object.keys(typesOf(kind));
  const i = ids.indexOf(type);
  return ids[(i + dir + ids.length) % ids.length];
}

/**
 * Comparación sugerida para cada tipo (la que más enseña): cada modo frente a la escala
 * mayor o menor de la que se diferencia en una sola nota, y cada acorde frente a su
 * pariente más cercano. El usuario puede elegir cualquier otra.
 */
export const SUGGESTED_COMPARE = {
  scale: {
    major: 'lydian', minor: 'dorian', harmonic: 'minor', melodic: 'harmonic',
    dorian: 'minor', phrygian: 'minor', lydian: 'major', mixolydian: 'major',
    locrian: 'phrygian', pentaMajor: 'major', pentaMinor: 'minor', blues: 'pentaMinor',
  },
  chord: {
    maj: 'm', m: 'maj', dim: 'm', aug: 'maj', sus2: 'maj', sus4: 'maj',
    maj7: 'dom7', dom7: 'maj7', m7: 'dom7', m7b5: 'm7', dom9: 'dom7', m69: 'm7',
  },
};

/** Número de grado sin alteración y dentro de la octava: '#4' → 4, 'b7' → 7, '9' → 2. */
function degreeNumber(degree) {
  return ((Number(degree.replace(/[b#]/g, '')) - 1) % 7) + 1;
}

/**
 * Diferencias legibles entre A y B (resultado de compareNotes):
 *   swaps   el mismo grado alterado distinto: [{ a, b }] (lidio ♯4 ↔ mayor 4)
 *   onlyA   notas que solo tiene A, sin pareja en B (la 9 de C9 frente a C7)
 *   onlyB   notas que solo tiene B, sin pareja en A (4 y 7 de la mayor frente a la pentatónica)
 * Cada nota aparece una vez (la tónica de arriba no se repite).
 */
export function describeDifferences(a, b, cmp = compareNotes(a, b)) {
  const pick = (notes, statuses, want) => {
    const seen = new Set();
    return notes.filter((n, i) => {
      if (statuses[i] !== want || seen.has(pc(n.midi))) return false;
      seen.add(pc(n.midi));
      return true;
    });
  };
  const onlyA = pick(a, cmp.a, STATUS.ONLY_A);
  const onlyB = pick(b, cmp.b, STATUS.ONLY_B);
  const swaps = [];
  for (const na of [...onlyA]) {
    const j = onlyB.findIndex((nb) => degreeNumber(nb.degree) === degreeNumber(na.degree));
    if (j === -1) continue;
    swaps.push({ a: na, b: onlyB[j] });
    onlyA.splice(onlyA.indexOf(na), 1);
    onlyB.splice(j, 1);
  }
  return { swaps, onlyA, onlyB };
}
