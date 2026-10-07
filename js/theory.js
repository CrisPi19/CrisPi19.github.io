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
  maj7: { symbol: 'maj7', name: 'Mayor séptima',     group: 'cuatriadas', degrees: ['1', '3', '5', '7'] },
  dom7: { symbol: '7',    name: 'Dominante',         group: 'cuatriadas', degrees: ['1', '3', '5', 'b7'] },
  m7:   { symbol: 'm7',   name: 'Menor séptima',     group: 'cuatriadas', degrees: ['1', 'b3', '5', 'b7'] },
  m7b5: { symbol: 'm7b5', name: 'Semidisminuido',    group: 'cuatriadas', degrees: ['1', 'b3', 'b5', 'b7'] },
  dom9: { symbol: '9',    name: 'Dominante novena',  group: 'extensiones', degrees: ['1', '3', '5', 'b7', '9'] },
  m69:  { symbol: 'm6/9', name: 'Menor seis nueve',  group: 'extensiones', degrees: ['1', 'b3', '5', '6', '9'] },
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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Grado de escala en números romanos, para el pentagrama: 'b3' → '♭III', '#4' → '♯IV'.
 * La octava vuelve a ser la tónica: '8' → 'I' (igual que 9 → II).
 */
export function romanDegree(degree) {
  const m = /^([b#]*)(\d+)$/.exec(degree);
  if (!m) throw new Error(`Grado no válido: ${degree}`);
  return m[1].replace(/b/g, '♭').replace(/#/g, '♯') + ROMAN[(Number(m[2]) - 1) % 7];
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
  let slashName = null;
  if (correct && inversion > 0) {
    // Si el símbolo ya lleva "/" (m6/9), se agrupa con paréntesis: (Am6/9)/C.
    const name = chordName(root, typeId);
    const head = type.symbol.includes('/') ? `(${name})` : name;
    slashName = `${head}/${displayNote(spellChord(root, typeId)[inversion])}`;
  }

  return { correct, missing, extra, degreeOf, bass, inversion, slashName };
}

/* ---------------- Escalas ---------------- */

/**
 * Escalas como fórmulas de grados, igual que los acordes: así se deletrean con una letra
 * por grado (D lidio = D E F♯ G♯ A B C♯, nunca A♭ en vez de G♯).
 * El modo jónico es la escala mayor y el eólico la menor natural: no se repiten en "modos".
 */
export const SCALE_TYPES = {
  major:      { name: 'Mayor (jónico)',         group: 'mayor-menor',  degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  minor:      { name: 'Menor natural (eólico)', group: 'mayor-menor',  degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'] },
  harmonic:   { name: 'Menor armónica',         group: 'mayor-menor',  degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'] },
  melodic:    { name: 'Menor melódica',         group: 'mayor-menor',  degrees: ['1', '2', 'b3', '4', '5', '6', '7'] },
  dorian:     { name: 'Dórico',                 group: 'modos',        degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'] },
  phrygian:   { name: 'Frigio',                 group: 'modos',        degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'] },
  lydian:     { name: 'Lidio',                  group: 'modos',        degrees: ['1', '2', '3', '#4', '5', '6', '7'] },
  mixolydian: { name: 'Mixolidio',              group: 'modos',        degrees: ['1', '2', '3', '4', '5', '6', 'b7'] },
  locrian:    { name: 'Locrio',                 group: 'modos',        degrees: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'] },
  pentaMajor: { name: 'Pentatónica mayor',      group: 'pentatonicas', degrees: ['1', '2', '3', '5', '6'] },
  pentaMinor: { name: 'Pentatónica menor',      group: 'pentatonicas', degrees: ['1', 'b3', '4', '5', 'b7'] },
  blues:      { name: 'Blues',                  group: 'pentatonicas', degrees: ['1', 'b3', '4', 'b5', '5', 'b7'] },
};

export const SCALE_GROUPS = {
  'mayor-menor': 'Mayor y menores',
  modos: 'Modos',
  pentatonicas: 'Pentatónicas y blues',
};

function getScale(scaleId) {
  const scale = SCALE_TYPES[scaleId];
  if (!scale) throw new Error(`Escala desconocida: ${scaleId}`);
  return scale;
}

/** Notas deletreadas de la escala: ('D', 'lydian') → ['D','E','F#','G#','A','B','C#']. */
export function spellScale(root, scaleId) {
  return getScale(scaleId).degrees.map((d) => spellDegree(root, d));
}

export function scalePitchClasses(root, scaleId) {
  const rootPc = notePc(root);
  return getScale(scaleId).degrees.map((d) => mod12(rootPc + parseDegree(d).semitones));
}

/* ---------------- Intervalos ---------------- */

/**
 * Intervalos con nombre en español. `degree` es el grado que alcanza desde la nota de
 * partida (3m = 'b3'), así se deletrea igual que los acordes: la 3m sobre B es D, no C𝄪.
 * El tritono aparece dos veces porque se escribe distinto: 4A (C–F♯) y 5d (C–G♭).
 */
export const INTERVALS = {
  m2: { short: '2m', name: 'Segunda menor',     degree: 'b2' },
  M2: { short: '2M', name: 'Segunda mayor',     degree: '2' },
  m3: { short: '3m', name: 'Tercera menor',     degree: 'b3' },
  M3: { short: '3M', name: 'Tercera mayor',     degree: '3' },
  P4: { short: '4J', name: 'Cuarta justa',      degree: '4' },
  A4: { short: '4A', name: 'Cuarta aumentada',  degree: '#4' },
  d5: { short: '5d', name: 'Quinta disminuida', degree: 'b5' },
  P5: { short: '5J', name: 'Quinta justa',      degree: '5' },
  m6: { short: '6m', name: 'Sexta menor',       degree: 'b6' },
  M6: { short: '6M', name: 'Sexta mayor',       degree: '6' },
  m7: { short: '7m', name: 'Séptima menor',     degree: 'b7' },
  M7: { short: '7M', name: 'Séptima mayor',     degree: '7' },
  P8: { short: '8J', name: 'Octava justa',      degree: '8' },
  m9: { short: '9m', name: 'Novena menor',      degree: 'b9' },
  M9: { short: '9M', name: 'Novena mayor',      degree: '9' },
};

export function intervalSemitones(intervalId) {
  return parseDegree(INTERVALS[intervalId].degree).semitones;
}

/* ---------------- Notas escritas (con octava, para el pentagrama) ---------------- */

/*
 * Una nota ESCRITA es { name: 'Bb', octave: 3 }: letra + alteración + octava, con la
 * convención científica (C4 = Do central). La octava va con la LETRA, no con el sonido:
 * C♭4 suena igual que B3 (MIDI 59) pero se escribe en el espacio de C4. Por eso no basta
 * con el número MIDI para dibujar una partitura.
 */

/** Pasos de letra desde C0 (C0 = 0, D0 = 1 … C1 = 7): sirve para medir distancias escritas. */
export function letterSteps({ name, octave }) {
  return octave * 7 + LETTERS.indexOf(name[0]);
}

/** Número MIDI de una nota escrita: { name: 'Cb', octave: 4 } → 59. */
export function pitchMidi({ name, octave }) {
  const { letter, acc } = parseNote(name);
  return 12 * (octave + 1) + LETTER_PC[letter] + acc;
}

/** Nota escrita a partir de su nombre y su MIDI: ('Cb', 59) → { name: 'Cb', octave: 4 }. */
export function pitchFromMidi(name, midi) {
  const { letter, acc } = parseNote(name);
  const octave = (midi - LETTER_PC[letter] - acc) / 12 - 1;
  if (!Number.isInteger(octave)) throw new Error(`${name} no suena como MIDI ${midi}`);
  return { name, octave };
}

/** Nota escrita en cierto paso de letra que suena como `midi` (la alteración es lo que falta). */
function pitchAt(steps, midi) {
  const letter = LETTERS[((steps % 7) + 7) % 7];
  const octave = Math.floor(steps / 7);
  const acc = midi - (12 * (octave + 1) + LETTER_PC[letter]);
  return { name: letter + accidentalText(acc), octave };
}

/** Nota escrita a cierto grado por ENCIMA: ({ B, 3 }, 'b3') → { name: 'D', octave: 4 }. */
export function pitchAbove(pitch, degree) {
  const { num, semitones } = parseDegree(degree);
  return pitchAt(letterSteps(pitch) + num - 1, pitchMidi(pitch) + semitones);
}

/** Nota escrita a cierto grado por DEBAJO: ({ C, 4 }, '3') → { name: 'Ab', octave: 3 }. */
export function pitchBelow(pitch, degree) {
  const { num, semitones } = parseDegree(degree);
  return pitchAt(letterSteps(pitch) - (num - 1), pitchMidi(pitch) - semitones);
}

/**
 * Intervalo entre dos notas escritas (en cualquier orden), o null si no está en INTERVALS
 * (por ejemplo una 2.ª aumentada). Cuenta letras Y semitonos: C–E es 3M; C–F♭ no es 3M.
 */
export function intervalBetween(a, b) {
  const [low, high] = pitchMidi(a) <= pitchMidi(b) ? [a, b] : [b, a];
  const num = letterSteps(high) - letterSteps(low) + 1;
  const semitones = pitchMidi(high) - pitchMidi(low);
  for (const [id, interval] of Object.entries(INTERVALS)) {
    const d = parseDegree(interval.degree);
    if (d.num === num && d.semitones === semitones) return id;
  }
  return null;
}

/**
 * Notas escritas de una fórmula de grados; la tónica es la primera nota >= fromMidi.
 * Devuelve [{ name, octave, midi, degree }] en el orden de la fórmula.
 */
function formulaVoicing(root, degrees, fromMidi) {
  const rootMidi = fromMidi + mod12(notePc(root) - fromMidi);
  const rootPitch = pitchFromMidi(root, rootMidi);
  return degrees.map((degree) => {
    const pitch = pitchAbove(rootPitch, degree);
    return { ...pitch, midi: pitchMidi(pitch), degree };
  });
}

/** Acorde escrito en posición fundamental: ('Bb', 'm7', 48) → B♭3 D♭4 F4 A♭4. */
export function spellVoicing(root, typeId, fromMidi = 48) {
  return formulaVoicing(root, getType(typeId).degrees, fromMidi);
}

/** Escala escrita subiendo una octava; con withOctave repite la tónica arriba (grado '8'). */
export function spellScaleVoicing(root, scaleId, fromMidi = 48, { withOctave = true } = {}) {
  const degrees = getScale(scaleId).degrees;
  return formulaVoicing(root, withOctave ? [...degrees, '8'] : degrees, fromMidi);
}

/**
 * Acomoda notas escritas dentro de [from, to] moviendo por octavas las que se salen
 * (conservan nombre y grado). Así la 9.ª de B9 cabe en el teclado: se baja una octava
 * y sigue siendo la "9". Devuelve una copia ordenada de grave a agudo.
 */
export function fitToRange(pitches, from, to) {
  return pitches.map((p) => {
    let { octave, midi } = p;
    while (midi > to && midi - 12 >= from) { midi -= 12; octave -= 1; }
    while (midi < from && midi + 12 <= to) { midi += 12; octave += 1; }
    return { ...p, octave, midi };
  }).sort((a, b) => a.midi - b.midi);
}
