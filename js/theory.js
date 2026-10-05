/*
 * Lógica de teoría musical. Sin DOM: se puede usar en cualquier módulo y probar aislada.
 *
 * Convenciones:
 * - Una nota concreta es un número MIDI (C4 = 60, "Do central").
 * - Una clase de altura (pitch class, pc) es la nota sin octava: 0 = C, 1 = C#/Db … 11 = B.
 *   Se obtiene con midi % 12.
 * - Los nombres internos usan ASCII: "Bb", "F#", "Ebb". Para mostrarlos en pantalla
 *   se pasan por displayNote(), que pone ♭ ♯ 𝄫 𝄪.
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Semitonos de cada grado de la escala mayor (grado 1 → índice 0). */
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

/**
 * Las 12 tónicas con la ortografía más habitual en cifrado.
 * F# en vez de Gb (Gb mayor necesita Cb); Db, Eb, Ab, Bb en vez de sus sostenidos.
 */
export const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const NATURAL_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Tipos de acorde como fórmulas de GRADOS (no solo semitonos).
 * El grado dice dos cosas: qué semitono es y qué LETRA le corresponde,
 * y eso permite deletrear bien (la 3.ª de Bb es D-algo, nunca C#).
 */
export const CHORD_TYPES = {
  maj:  { symbol: '',     name: 'Mayor',             group: 'triadas',    degrees: ['1', '3', '5'] },
  m:    { symbol: 'm',    name: 'Menor',             group: 'triadas',    degrees: ['1', 'b3', '5'] },
  dim:  { symbol: 'dim',  name: 'Disminuido',        group: 'triadas',    degrees: ['1', 'b3', 'b5'] },
  aug:  { symbol: 'aug',  name: 'Aumentado',         group: 'triadas',    degrees: ['1', '3', '#5'] },
  sus2: { symbol: 'sus2', name: 'Suspendido 2',      group: 'suspendidos', degrees: ['1', '2', '5'] },
  sus4: { symbol: 'sus4', name: 'Suspendido 4',      group: 'suspendidos', degrees: ['1', '4', '5'] },
  m6:   { symbol: 'm6',   name: 'Menor sexta',       group: 'cuatriadas', degrees: ['1', 'b3', '5', '6'] },
  maj7: { symbol: 'maj7', name: 'Mayor séptima',     group: 'cuatriadas', degrees: ['1', '3', '5', '7'] },
  dom7: { symbol: '7',    name: 'Dominante',         group: 'cuatriadas', degrees: ['1', '3', '5', 'b7'] },
  m7:   { symbol: 'm7',   name: 'Menor séptima',     group: 'cuatriadas', degrees: ['1', 'b3', '5', 'b7'] },
  m7b5: { symbol: 'm7b5', name: 'Semidisminuido',    group: 'cuatriadas', degrees: ['1', 'b3', 'b5', 'b7'] },
  dom9: { symbol: '9',    name: 'Dominante novena',  group: 'extensiones', degrees: ['1', '3', '5', 'b7', '9'] },
};

export const CHORD_GROUPS = {
  triadas: 'Tríadas',
  suspendidos: 'Suspendidos',
  cuatriadas: 'Cuatríadas',
  extensiones: 'Extensiones',
};

const mod12 = (n) => ((n % 12) + 12) % 12;

/* ---------------- Notas ---------------- */

/** "Bb" → { letter: 'B', acc: -1 }. Lanza error si el nombre no es válido. */
export function parseNote(name) {
  const m = /^([A-G])(#{1,2}|b{1,2})?$/.exec(name);
  if (!m) throw new Error(`Nota no válida: ${name}`);
  const accStr = m[2] || '';
  const acc = accStr.startsWith('#') ? accStr.length : -accStr.length;
  return { letter: m[1], acc };
}

/** Clase de altura de un nombre: "Bb" → 10, "Cb" → 11. */
export function notePc(name) {
  const { letter, acc } = parseNote(name);
  return mod12(LETTER_PC[letter] + acc);
}

/** Texto de alteración a partir de un número: -2 → "bb", 1 → "#". */
function accidentalText(acc) {
  return acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc);
}

/** Nombre ASCII → nombre para mostrar: "Bbb" → "B𝄫", "F#" → "F♯". */
export function displayNote(name) {
  return name[0] + name.slice(1)
    .replace('##', '𝄪').replace('bb', '𝄫')
    .replace('#', '♯').replace('b', '♭');
}

/** Nombre genérico de una nota MIDI (con sostenidos), útil para etiquetas: 61 → "C#4". */
export function midiToName(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[mod12(midi)] + (Math.floor(midi / 12) - 1);
}

export function isBlackKey(midi) {
  return [1, 3, 6, 8, 10].includes(mod12(midi));
}

/* ---------------- Grados e intervalos ---------------- */

/** "b7" → { num: 7, acc: -1, semitones: 10 }; "9" → { num: 9, acc: 0, semitones: 14 }. */
export function parseDegree(degree) {
  const m = /^([b#]*)(\d+)$/.exec(degree);
  if (!m) throw new Error(`Grado no válido: ${degree}`);
  const acc = [...m[1]].reduce((sum, c) => sum + (c === '#' ? 1 : -1), 0);
  const num = Number(m[2]);
  const octaves = Math.floor((num - 1) / 7);
  const semitones = MAJOR_SCALE[(num - 1) % 7] + 12 * octaves + acc;
  return { num, acc, semitones };
}

/** Texto de grado para mostrar: "b7" → "♭7". */
export function displayDegree(degree) {
  return degree.replace('b', '♭').replace('#', '♯');
}

/**
 * Deletrea la nota que está a cierto grado de una tónica.
 * spellDegree('Bb', 'b3') → 'Db'
 *
 * Método: la letra sale de contar letras (grado 3 = dos letras más arriba),
 * y la alteración es lo que falta para llegar a los semitonos correctos.
 */
export function spellDegree(root, degree) {
  const { letter } = parseNote(root);
  const { num, semitones } = parseDegree(degree);
  const targetLetter = LETTERS[(LETTERS.indexOf(letter) + num - 1) % 7];
  const targetPc = mod12(notePc(root) + semitones);
  let acc = mod12(targetPc - LETTER_PC[targetLetter]);
  if (acc > 6) acc -= 12; // 11 semitones "arriba" es en realidad 1 abajo
  return targetLetter + accidentalText(acc);
}

/* ---------------- Acordes ---------------- */

function getType(typeId) {
  const type = CHORD_TYPES[typeId];
  if (!type) throw new Error(`Tipo de acorde desconocido: ${typeId}`);
  return type;
}

/** Nombre del acorde para mostrar: ('Bb', 'm7b5') → "B♭m7♭5". */
export function chordName(root, typeId) {
  return displayNote(root) + getType(typeId).symbol.replace('b', '♭');
}

/** Notas deletreadas del acorde, en orden de la fórmula: ('F', 'maj7') → ['F','A','C','E']. */
export function spellChord(root, typeId) {
  return getType(typeId).degrees.map((d) => spellDegree(root, d));
}

/** Clases de altura del acorde, en orden de la fórmula: ('C', 'dom7') → [0, 4, 7, 10]. */
export function chordPitchClasses(root, typeId) {
  const rootPc = notePc(root);
  return getType(typeId).degrees.map((d) => mod12(rootPc + parseDegree(d).semitones));
}

/**
 * Voicing en posición fundamental a partir de una nota MIDI mínima.
 * La tónica queda en la primera nota >= fromMidi.
 */
export function rootPositionVoicing(root, typeId, fromMidi = 48) {
  const start = fromMidi + mod12(notePc(root) - fromMidi);
  return getType(typeId).degrees.map((d) => start + parseDegree(d).semitones);
}

/** Nombre de una inversión según qué elemento del acorde está en el bajo. */
export function inversionName(index) {
  if (index === 0) return 'posición fundamental';
  return `${index}.ª inversión`;
}

/**
 * Compara lo que tocó el usuario con el acorde pedido.
 *
 * Se aceptan cualquier octava, duplicaciones e inversiones: lo que importa es
 * el CONJUNTO de clases de altura. Además se informa qué nota quedó en el bajo.
 *
 * Devuelve:
 *  - correct: el conjunto de notas coincide exactamente
 *  - missing: clases de altura del acorde que no se tocaron
 *  - extra: notas MIDI tocadas que no pertenecen al acorde
 *  - degreeOf: función pc → grado ('b3', …) o null
 *  - bass: { midi, degree, index } de la nota más grave (null si no hay notas)
 *  - inversion: índice del elemento en el bajo (0 = fundamental), solo si correct
 *  - slashName: "Fmaj7/A" si está invertido y es correcto, si no null
 */
export function analyzeAnswer(midiNotes, root, typeId) {
  const type = getType(typeId);
  const pcs = chordPitchClasses(root, typeId);
  const played = [...new Set(midiNotes)].sort((a, b) => a - b);
  const playedPcs = new Set(played.map(mod12));

  const missing = pcs.filter((pc) => !playedPcs.has(pc));
  const extra = played.filter((midi) => !pcs.includes(mod12(midi)));
  const correct = played.length > 0 && missing.length === 0 && extra.length === 0;

  const degreeOf = (pc) => {
    const i = pcs.indexOf(mod12(pc));
    return i === -1 ? null : type.degrees[i];
  };

  let bass = null;
  if (played.length) {
    const midi = played[0];
    const index = pcs.indexOf(mod12(midi));
    bass = { midi, degree: index === -1 ? null : type.degrees[index], index };
  }

  const inversion = correct ? bass.index : null;
  const slashName = correct && inversion > 0
    ? `${chordName(root, typeId)}/${displayNote(spellChord(root, typeId)[inversion])}`
    : null;

  return { correct, missing, extra, degreeOf, bass, inversion, slashName };
}
