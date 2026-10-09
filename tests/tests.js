/*
 * Pruebas de la lógica (teoría, repetición espaciada, ejercicios). Abrir tests/index.html con el servidor local.
 * Mini "framework": test(nombre, fn) y eq(real, esperado).
 */
import {
  spellChord, spellDegree, chordPitchClasses, chordName, analyzeAnswer,
  rootPositionVoicing, notePc, displayNote, parseDegree, CHORD_TYPES, ROOTS,
  SCALE_TYPES, INTERVALS, spellScale, scalePitchClasses, pitchMidi, pitchFromMidi, pitchAbove,
  pitchBelow, intervalBetween, intervalSemitones, spellVoicing, spellScaleVoicing, fitToRange,
  romanDegree, slashChordName, NATURAL_ROOTS,
} from '../js/theory.js';
import {
  clefFor, noteY, ledgerYs, layoutStaff, STAFF_TOP, STAFF_BOTTOM,
} from '../js/notation.js';
import { GLYPHS } from '../js/engine/music-glyphs.js';
import {
  itemNotes, itemName, compareNotes, describeDifferences, stepType, STATUS, SUGGESTED_COMPARE,
  CLEF_RANGE,
} from '../js/explorer.js';
import { grade, pickNext, createItem, MAX_BOX } from '../js/srs.js';
import { COLORS, C } from '../js/engine/palette.js';
import { missingChars, measure } from '../js/engine/font.js';
import { screenToLogical } from '../js/engine/input.js';
import {
  buildKeys, hitTest, computeMarks, MARK, arrowAt, rangeFor, PianoLayer, RANGES,
} from '../js/layers/piano.js';
import { getHistory, clearHistory, record, MAX_RECORDS } from '../js/history.js';
import { EventBus } from '../js/events.js';
import { Trainer } from '../js/trainer.js';
import {
  Reader, readingPitches, parsePitch, spellPlayed, describeMiss, sanitizeConfig as readingConfig,
  chordReadingVoicing, chordPlacements, compareChordReading, spellExtras, chordIds, parseId,
  READING_CHORD_TYPES, pitchText,
} from '../js/reading.js';
import {
  Recognizer, sanitizeConfig as recConfig, parseId as recParseId, testsOf, intervalCandidates,
  scalePlacement, scaleSpellable, scaleIds, intervalIds, compareScalePlay, RECOGNIZE_INTERVALS,
  RECOGNIZE_SCALES,
} from '../js/recognize.js';

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, msg: err.message });
  }
}

function eq(actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`esperado ${e}\n     obtenido ${a}`);
}

/* ---------- Notas y grados ---------- */

test('notePc: Bb = 10, Cb = 11, E# = 5', () => {
  eq([notePc('Bb'), notePc('Cb'), notePc('E#')], [10, 11, 5]);
});

test('parseDegree: b7 = 10 semitonos, 9 = 14, #5 = 8', () => {
  eq([parseDegree('b7').semitones, parseDegree('9').semitones, parseDegree('#5').semitones], [10, 14, 8]);
});

test('spellDegree: la 3.ª menor de Bb es Db (no C#)', () => {
  eq(spellDegree('Bb', 'b3'), 'Db');
});

test('displayNote usa símbolos musicales', () => {
  eq([displayNote('Bb'), displayNote('F#'), displayNote('Bbb'), displayNote('C##')], ['B♭', 'F♯', 'B𝄫', 'C𝄪']);
});

/* ---------- Deletreo de acordes ---------- */

const spellings = [
  ['F', 'maj7', ['F', 'A', 'C', 'E']],
  ['Bb', 'm7', ['Bb', 'Db', 'F', 'Ab']],
  ['F#', 'dom7', ['F#', 'A#', 'C#', 'E']],
  ['Eb', 'dim', ['Eb', 'Gb', 'Bbb']],
  ['Ab', 'aug', ['Ab', 'C', 'E']],
  ['C', 'dom9', ['C', 'E', 'G', 'Bb', 'D']],
  ['D', 'sus4', ['D', 'G', 'A']],
  ['E', 'sus2', ['E', 'F#', 'B']],
  ['A', 'm69', ['A', 'C', 'E', 'F#', 'B']],
  ['Eb', 'm69', ['Eb', 'Gb', 'Bb', 'C', 'F']],
  ['B', 'm7b5', ['B', 'D', 'F', 'A']],
  ['Db', 'maj', ['Db', 'F', 'Ab']],
];
for (const [root, type, expected] of spellings) {
  test(`spellChord ${root} ${type} = ${expected.join(' ')}`, () => eq(spellChord(root, type), expected));
}

test('cada acorde de cada tónica usa letras distintas para grados distintos (dentro de la octava)', () => {
  for (const root of ROOTS) {
    for (const type of Object.keys(CHORD_TYPES)) {
      const letters = spellChord(root, type).map((n) => n[0]);
      if (new Set(letters).size !== letters.length) throw new Error(`${root}${type}: ${letters}`);
    }
  }
});

test('chordPitchClasses C7 = [0, 4, 7, 10]', () => eq(chordPitchClasses('C', 'dom7'), [0, 4, 7, 10]));

test('chordName con símbolos', () => {
  eq([chordName('Bb', 'm7b5'), chordName('F#', 'dom9'), chordName('C', 'maj')], ['B♭m7♭5', 'F♯9', 'C']);
});

test('rootPositionVoicing F maj7 desde C3 (48)', () => eq(rootPositionVoicing('F', 'maj7', 48), [53, 57, 60, 64]));

/* ---------- Validación de respuestas ---------- */

test('Fmaj7 en posición fundamental', () => {
  const r = analyzeAnswer([53, 57, 60, 64], 'F', 'maj7');
  eq([r.correct, r.inversion, r.slashName], [true, 0, null]);
});

test('Fmaj7 en 1.ª inversión (A en el bajo) es correcto y se informa', () => {
  const r = analyzeAnswer([57, 60, 64, 65], 'F', 'maj7');
  eq([r.correct, r.inversion, r.bass.degree, r.slashName], [true, 1, '3', 'Fmaj7/A']);
});

test('Fmaj7 en 3.ª inversión (E en el bajo)', () => {
  const r = analyzeAnswer([52, 53, 57, 60], 'F', 'maj7');
  eq([r.correct, r.inversion, r.slashName], [true, 3, 'Fmaj7/E']);
});

test('Am6/9 invertido se nombra con paréntesis: (Am6/9)/C', () => {
  const r = analyzeAnswer([48, 52, 54, 57, 59], 'A', 'm69'); // C E F# A B
  eq([r.correct, r.inversion, r.slashName], [true, 1, '(Am6/9)/C']);
});

test('octavas duplicadas siguen siendo correctas', () => {
  eq(analyzeAnswer([48, 52, 55, 60, 64], 'C', 'maj').correct, true);
});

test('nota que falta y nota que sobra', () => {
  const r = analyzeAnswer([53, 57, 60, 63], 'F', 'maj7'); // Eb en vez de E
  eq([r.correct, r.missing, r.extra], [false, [4], [63]]);
});

test('sin notas no es correcto', () => {
  eq(analyzeAnswer([], 'C', 'maj').correct, false);
});

/* ---------- Escalas ---------- */

const scaleSpellings = [
  ['C', 'major', 'C D E F G A B'],
  ['A', 'minor', 'A B C D E F G'],
  ['F#', 'harmonic', 'F# G# A B C# D E#'],
  ['D', 'melodic', 'D E F G A B C#'],
  ['D', 'dorian', 'D E F G A B C'],
  ['E', 'phrygian', 'E F G A B C D'],
  ['D', 'lydian', 'D E F# G# A B C#'],
  ['F', 'lydian', 'F G A B C D E'],
  ['G', 'mixolydian', 'G A B C D E F'],
  ['Db', 'locrian', 'Db Ebb Fb Gb Abb Bbb Cb'],
  ['Bb', 'pentaMajor', 'Bb C D F G'],
  ['E', 'pentaMinor', 'E G A B D'],
  ['A', 'blues', 'A C D Eb E G'],
];
for (const [root, scale, expected] of scaleSpellings) {
  test(`spellScale ${root} ${scale} = ${expected}`, () => eq(spellScale(root, scale).join(' '), expected));
}

test('escalas de 7 notas: una letra distinta por grado, en todas las tónicas', () => {
  for (const root of ROOTS) {
    for (const [id, scale] of Object.entries(SCALE_TYPES)) {
      if (scale.degrees.length !== 7) continue;
      const letters = spellScale(root, id).map((n) => n[0]);
      if (new Set(letters).size !== 7) throw new Error(`${root} ${id}: ${letters}`);
    }
  }
});

test('scalePitchClasses D lidio', () => eq(scalePitchClasses('D', 'lydian'), [2, 4, 6, 8, 9, 11, 1]));

/* ---------- Intervalos y notas escritas ---------- */

test('pitchMidi: C4 = 60, Cb4 = 59 (se escribe en C4, suena como B3), B#3 = 60', () => {
  eq([pitchMidi({ name: 'C', octave: 4 }), pitchMidi({ name: 'Cb', octave: 4 }), pitchMidi({ name: 'B#', octave: 3 })], [60, 59, 60]);
});

test('pitchFromMidi recupera la octava escrita', () => {
  eq([pitchFromMidi('Cb', 59), pitchFromMidi('B#', 60), pitchFromMidi('Eb', 51)],
    [{ name: 'Cb', octave: 4 }, { name: 'B#', octave: 3 }, { name: 'Eb', octave: 3 }]);
});

test('pitchAbove: 3m sobre B3 = D4; 3M sobre G#4 = B#4; 9 sobre C4 = D5', () => {
  eq(pitchAbove({ name: 'B', octave: 3 }, 'b3'), { name: 'D', octave: 4 });
  eq(pitchAbove({ name: 'G#', octave: 4 }, '3'), { name: 'B#', octave: 4 });
  eq(pitchAbove({ name: 'C', octave: 4 }, '9'), { name: 'D', octave: 5 });
});

test('pitchBelow: 3M bajo C4 = Ab3; 5J bajo F4 = Bb3', () => {
  eq(pitchBelow({ name: 'C', octave: 4 }, '3'), { name: 'Ab', octave: 3 });
  eq(pitchBelow({ name: 'F', octave: 4 }, '5'), { name: 'Bb', octave: 3 });
});

test('intervalBetween: cuenta letras y semitonos (4A ≠ 5d)', () => {
  const p = (name, octave) => ({ name, octave });
  eq(intervalBetween(p('C', 4), p('E', 4)), 'M3');
  eq(intervalBetween(p('C', 4), p('F#', 4)), 'A4');
  eq(intervalBetween(p('C', 4), p('Gb', 4)), 'd5');
  eq(intervalBetween(p('E', 4), p('C', 4)), 'M3'); // en cualquier orden
  eq(intervalBetween(p('C', 4), p('D', 5)), 'M9');
  eq(intervalBetween(p('C', 4), p('D#', 4)), null); // 2.ª aumentada: no está en la lista
});

test('cada intervalo de la lista se reconoce a sí mismo desde cualquier tónica', () => {
  for (const root of ROOTS) {
    const low = { name: root, octave: 4 };
    for (const [id, { degree }] of Object.entries(INTERVALS)) {
      const got = intervalBetween(low, pitchAbove(low, degree));
      if (got !== id) throw new Error(`${root} + ${id} → ${got}`);
    }
  }
  eq(intervalSemitones('m6'), 8);
});

test('spellVoicing: B♭m7 desde C3 = B♭3 D♭4 F4 A♭4 con sus MIDI y grados', () => {
  const v = spellVoicing('Bb', 'm7', 48);
  eq(v.map((n) => `${n.name}${n.octave}`), ['Bb3', 'Db4', 'F4', 'Ab4']);
  eq(v.map((n) => n.midi), [58, 61, 65, 68]);
  eq(v.map((n) => n.degree), ['1', 'b3', '5', 'b7']);
});

test('spellVoicing coincide en sonido con rootPositionVoicing para todos los acordes', () => {
  for (const root of ROOTS) {
    for (const type of Object.keys(CHORD_TYPES)) {
      eq(spellVoicing(root, type, 48).map((n) => n.midi), rootPositionVoicing(root, type, 48));
    }
  }
});

test('spellScaleVoicing: D lidio desde C4 sube una octava hasta D5', () => {
  const v = spellScaleVoicing('D', 'lydian', 60);
  eq(v.map((n) => `${n.name}${n.octave}`), ['D4', 'E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D5']);
  eq(v[7].degree, '8');
});

test('fitToRange: la 9.ª de B9 baja una octava para caber en C3–C5 y sigue siendo la 9', () => {
  const v = fitToRange(spellVoicing('B', 'dom9', 48), 48, 72);
  eq(v.map((n) => `${n.name}${n.octave}`), ['B3', 'C#4', 'D#4', 'F#4', 'A4']);
  eq(v[1].degree, '9');
  eq(Math.max(...v.map((n) => n.midi)) <= 72, true);
});

/* ---------- Pentagrama pixel art: diagramación ---------- */

const n = (name, octave) => ({ name, octave, midi: pitchMidi({ name, octave }) });

test('noteY: E4 en la 5.ª línea de sol, F5 en la 1.ª; G2 y A3 en las de fa', () => {
  eq([noteY(n('E', 4), 'treble'), noteY(n('F', 5), 'treble')], [STAFF_BOTTOM, STAFF_TOP]);
  eq([noteY(n('G', 2), 'bass'), noteY(n('A', 3), 'bass')], [STAFF_BOTTOM, STAFF_TOP]);
});

test('noteY: la altura depende de la letra escrita (C♭4 en el lugar de C4, no de B3)', () => {
  eq(noteY(n('Cb', 4), 'treble'), noteY(n('C', 4), 'treble'));
  eq(noteY(n('B#', 3), 'treble') !== noteY(n('C', 4), 'treble'), true);
});

test('ledgerYs: C4 en sol lleva 1 línea adicional; A5 1; C6 2; G4 ninguna', () => {
  eq(ledgerYs(noteY(n('C', 4), 'treble')).length, 1);
  eq(ledgerYs(noteY(n('B', 3), 'treble')).length, 1); // B3 cuelga bajo la línea de C4
  eq(ledgerYs(noteY(n('A', 5), 'treble')).length, 1);
  eq(ledgerYs(noteY(n('C', 6), 'treble')).length, 2);
  eq(ledgerYs(noteY(n('G', 4), 'treble')).length, 0);
});

test('acorde: en una segunda la nota de arriba va a la derecha (B3 C♯4 en B9)', () => {
  const L = layoutStaff({ notes: fitToRange(spellVoicing('B', 'dom9', 48), 48, 72), clef: 'treble' });
  const disp = L.heads.filter((h) => h.displaced);
  eq(disp.length, 1);
  eq(disp[0].y, noteY(n('C#', 4), 'treble'));
  eq(disp[0].x - L.heads[0].x, GLYPHS.head.w);
});

test('acorde: racimo C D E → C izq., D der., E izq.', () => {
  const L = layoutStaff({ notes: [n('C', 4), n('D', 4), n('E', 4)], clef: 'treble' });
  eq(L.heads.map((h) => h.displaced), [false, true, false]);
});

test('acorde: alteraciones que chocan van en columnas distintas; las lejanas comparten', () => {
  // E♭ G♭ B♭♭ (a tercera): los bemoles se tocan → más de una columna.
  const close = layoutStaff({ notes: spellVoicing('Eb', 'dim', 60), clef: 'treble' });
  eq(new Set(close.accidentals.map((a) => a.x)).size > 1, true);
  // C♯4 y C♯5 (a octava): caben en la misma columna.
  const far = layoutStaff({ notes: [n('C#', 4), n('C#', 5)], clef: 'treble' });
  eq(new Set(far.accidentals.map((a) => a.x)).size, 1);
  // Ninguna alteración se mete en la columna de las cabezas.
  for (const a of close.accidentals) eq(a.x + a.glyph.w <= close.heads[0].x - 2, true);
});

test('acorde: el índice de cada cabeza apunta a la nota recibida (para su color)', () => {
  const notes = [n('G', 4), n('C', 4), n('E', 4)];
  const L = layoutStaff({ notes, clef: 'treble' });
  eq(L.heads.map((h) => h.index), [1, 2, 0]); // ordenadas de grave a agudo
});

test('secuencia: becuadro cuando vuelve la letra natural (A blues: E♭3 … E3)', () => {
  const L = layoutStaff({ notes: spellScaleVoicing('A', 'blues', 45), mode: 'sequence', clef: 'bass' });
  eq(L.accidentals.some((a) => a.glyph === GLYPHS.natural), true);
});

test('romanDegree: grados de escala en romanos; la octava vuelve a ser I', () => {
  eq(['1', 'b3', '#4', 'b7', '8', 'bb7'].map(romanDegree), ['I', '♭III', '♯IV', '♭VII', 'I', '♭♭VII']);
});

test('secuencia: un grado en romanos por nota, en la fila de etiquetas', () => {
  const notes = spellScaleVoicing('D', 'lydian', 60);
  const L = layoutStaff({ notes, mode: 'sequence', labels: true });
  eq(L.labels.length, notes.length);
  eq(L.labels.map((l) => l.text), ['I', 'II', 'III', '♯IV', 'V', 'VI', 'VII', 'I']);
  eq(new Set(L.labels.map((l) => l.y)).size, 1);
});

test('clefFor: fa si el promedio está bajo el Do central', () => {
  eq([clefFor(spellVoicing('C', 'maj', 36)), clefFor(spellVoicing('C', 'maj', 60))], ['bass', 'treble']);
});

test('secuencia: ningún grado se monta sobre el de la nota vecina', () => {
  for (const id of Object.keys(SCALE_TYPES)) {
    const L = layoutStaff({ notes: spellScaleVoicing('C', id, 60), mode: 'sequence', labels: true });
    for (let i = 1; i < L.labels.length; i++) {
      const a = L.labels[i - 1];
      const b = L.labels[i];
      eq([id, a.cx + (measure(a.text) >> 1) < b.cx - (measure(b.text) >> 1)], [id, true]);
    }
  }
});

test('glifos: el ancla cae dentro de cada glifo', () => {
  for (const [name, g] of Object.entries(GLYPHS)) {
    eq([name, g.ay >= 0 && g.ay < g.h, g.runs.length > 0], [name, true, true]);
  }
});

/* ---------- Explorador ---------- */

const names = (notes) => notes.map((x) => `${x.name}${x.octave}`);

test('explorador: en sol la tónica va en la octava 4; en fa, en la 3', () => {
  eq(names(itemNotes({ kind: 'chord', root: 'F', type: 'maj7' }, 'treble')), ['F4', 'A4', 'C5', 'E5']);
  eq(names(itemNotes({ kind: 'chord', root: 'F', type: 'maj7' }, 'bass')), ['F3', 'A3', 'C4', 'E4']);
});

test('explorador: todo cabe en la ventana de su clave (también B9 y la escala de B)', () => {
  for (const clef of ['treble', 'bass']) {
    const from = CLEF_RANGE[clef];
    for (const item of [{ kind: 'chord', root: 'B', type: 'dom9' }, { kind: 'scale', root: 'B', type: 'major' }]) {
      const ms = itemNotes(item, clef).map((x) => x.midi);
      eq([clef, item.type, Math.min(...ms) >= from && Math.max(...ms) <= from + 24], [clef, item.type, true]);
    }
  }
});

test('explorador: nombres de ítems', () => {
  eq([itemName({ kind: 'chord', root: 'Bb', type: 'm7' }), itemName({ kind: 'scale', root: 'D', type: 'lydian' })],
    ['B♭m7', 'D Lidio']);
});

test('comparar D lidio con D mayor: solo cambia el 4.º grado (G♯ ↔ G)', () => {
  const a = itemNotes({ kind: 'scale', root: 'D', type: 'lydian' });
  const b = itemNotes({ kind: 'scale', root: 'D', type: 'major' });
  const cmp = compareNotes(a, b);
  eq(a.filter((x, i) => cmp.a[i] === STATUS.ONLY_A).map((x) => x.name), ['G#']);
  eq(b.filter((x, i) => cmp.b[i] === STATUS.ONLY_B).map((x) => x.name), ['G']);
  eq([cmp.a[0], cmp.a[7]], [STATUS.ROOT, STATUS.ROOT]);
  const d = describeDifferences(a, b, cmp);
  eq([d.swaps.length, d.swaps[0].a.degree, d.swaps[0].b.degree, d.onlyA.length, d.onlyB.length], [1, '#4', '4', 0, 0]);
});

test('comparar pentatónica mayor con mayor: a la pentatónica le faltan 4 y 7', () => {
  const a = itemNotes({ kind: 'scale', root: 'C', type: 'pentaMajor' });
  const b = itemNotes({ kind: 'scale', root: 'C', type: 'major' });
  const d = describeDifferences(a, b);
  eq([d.swaps.length, d.onlyA.length, d.onlyB.map((x) => x.degree)], [0, 0, ['4', '7']]);
});

test('comparar C9 con C7: solo C9 tiene la 9 (D)', () => {
  const d = describeDifferences(itemNotes({ kind: 'chord', root: 'C', type: 'dom9' }), itemNotes({ kind: 'chord', root: 'C', type: 'dom7' }));
  eq([d.swaps.length, d.onlyA.map((x) => x.name), d.onlyB.length], [0, ['D'], 0]);
});

test('comparación sugerida: existe para cada tipo y nunca es el mismo tipo', () => {
  for (const [kind, map] of Object.entries(SUGGESTED_COMPARE)) {
    for (const id of Object.keys(kind === 'scale' ? SCALE_TYPES : CHORD_TYPES)) {
      eq([kind, id, Boolean(map[id]) && map[id] !== id], [kind, id, true]);
    }
  }
});

test('stepType recorre los tipos en orden y da la vuelta', () => {
  eq([stepType('scale', 'major', -1), stepType('scale', 'blues', 1), stepType('chord', 'maj', 1)], ['blues', 'major', 'm']);
});

/* ---------- Repetición espaciada ---------- */

const fast = { correct: true, timeMs: 1000, slowThresholdMs: 5000, now: 1 };
const slow = { correct: true, timeMs: 9000, slowThresholdMs: 5000, now: 1 };
const wrong = { correct: false, timeMs: 1000, slowThresholdMs: 5000, now: 1 };

test('acierto rápido sube de caja', () => eq(grade(createItem(), fast).box, 2));
test('acierto lento se queda en su caja', () => eq(grade({ ...createItem(), box: 3 }, slow).box, 3));
test('fallo vuelve a la caja 1', () => eq(grade({ ...createItem(), box: 4 }, wrong).box, 1));
test('la caja no pasa del máximo', () => eq(grade({ ...createItem(), box: MAX_BOX }, fast).box, MAX_BOX));
test('grade cuenta intentos y aciertos', () => {
  const item = grade(grade(createItem(), fast), wrong);
  eq([item.attempts, item.correct], [2, 1]);
});

test('pickNext no repite el anterior si hay alternativas', () => {
  for (let i = 0; i < 50; i++) {
    if (pickNext(['a', 'b'], {}, { avoid: 'a' }) !== 'b') throw new Error('repitió');
  }
});

test('pickNext favorece cajas bajas', () => {
  const items = { a: { box: 1 }, b: { box: 5 } }; // pesos 16 y 1
  eq(pickNext(['a', 'b'], items, { random: () => 0.9 }), 'a'); // 0.9 * 17 = 15.3 < 16
  eq(pickNext(['a', 'b'], items, { random: () => 0.99 }), 'b'); // 16.83 > 16
});

/* ---------- Paleta ---------- */

test('la paleta tiene 30 colores hex válidos y distintos (2 reservados)', () => {
  eq(COLORS.length, 30);
  if (!COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c.hex))) throw new Error('hex inválido');
  eq(new Set(COLORS.map((c) => c.hex.toLowerCase())).size, 30);
  eq(new Set(COLORS.map((c) => c.name)).size, 30);
});

test('índices con nombre: C.INK apunta a "ink"', () => eq(COLORS[C.INK].name, 'ink'));

/* ---------- Fuente bitmap ---------- */

test('la fuente cubre español y música', () => {
  eq(missingChars('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ abcdefghijklmnñopqrstuvwxyz 0123456789'), []);
  eq(missingChars('ÁÉÍÓÚÜ áéíóúü ¿? ¡! .,:;-+=/()\'·%ª º ♭♯𝄫𝄪'), []);
});

test('la fuente cubre todos los nombres de acordes, notas y textos del canvas', () => {
  for (const root of ROOTS) {
    for (const type of Object.keys(CHORD_TYPES)) {
      const texts = [chordName(root, type), CHORD_TYPES[type].name, ...spellChord(root, type).map(displayNote)];
      for (const t of texts) {
        const missing = missingChars(t);
        if (missing.length) throw new Error(`"${t}" usa ${missing.join(' ')}`);
      }
    }
  }
  eq(missingChars('¡Correcto! No es correcto · 1.ª inversión: (Am6/9)/C · Marca al menos una tecla.'), []);
});

test('la fuente cubre nombres de escalas, intervalos y sus notas', () => {
  const texts = [
    ...Object.values(SCALE_TYPES).map((s) => s.name),
    ...Object.values(INTERVALS).flatMap((i) => [i.name, i.short]),
    ...ROOTS.flatMap((r) => Object.keys(SCALE_TYPES).flatMap((s) => spellScale(r, s).map(displayNote))),
  ];
  for (const t of texts) {
    const missing = missingChars(t);
    if (missing.length) throw new Error(`"${t}" usa ${missing.join(' ')}`);
  }
});

test('measure: ancho proporcional con 1 px entre letras', () => {
  eq(measure('A'), 5);
  eq(measure('AI'), 5 + 1 + 3);
  eq(measure('A', 3), 15);
});

/* ---------- Teclado: geometría y clics ---------- */

const keys = buildKeys();
const keyOf = (midi) => keys.find((k) => k.midi === midi);

test('buildKeys: 25 teclas, 15 blancas de 20 px desde x = 10', () => {
  eq(keys.length, 25);
  const whites = keys.filter((k) => !k.black);
  eq([whites.length, whites[0].x, whites[14].x + whites[14].w], [15, 10, 310]);
});

test('las negras van sobre la unión correcta (C♯ entre C y D)', () => {
  const cs = keyOf(49);
  if (!(cs.x < 30 && cs.x + cs.w > 30)) throw new Error(`C#3 en x=${cs.x}`);
});

test('hitTest: arriba en la zona de una negra gana la negra', () => {
  const cs = keyOf(49);
  eq(hitTest(keys, cs.x + 2, cs.y + 5), 49);
});

test('hitTest: abajo, a la misma altura x, se toca la blanca', () => {
  const cs = keyOf(49);
  eq(hitTest(keys, cs.x + 2, cs.y + cs.h + 5), 48); // C3 (la negra no llega tan abajo)
});

test('hitTest: fuera del teclado devuelve -1', () => {
  eq([hitTest(keys, 5, 150), hitTest(keys, 100, 50)], [-1, -1]);
});

test('screenToLogical: canvas a ×4 desplazado en la página', () => {
  const out = { x: 0, y: 0 };
  const rect = { left: 100, top: 50, width: 1280, height: 720 };
  eq([screenToLogical(100 + 4 * 37 + 3, 50 + 4 * 150 + 1, rect, out), out.x, out.y], [true, 37, 150]);
  eq(screenToLogical(90, 60, rect, out), false);
});

test('computeMarks: correctas con grado, sobrantes con nombre, faltantes en naranja', () => {
  const notes = [53, 57, 63]; // F A Eb, para Fmaj7 (faltan C y E)
  const { marks, labels } = computeMarks(notes, analyzeAnswer(notes, 'F', 'maj7'), 'F', 'maj7');
  eq([marks.get(53), marks.get(57), marks.get(63)], [MARK.CORRECT, MARK.CORRECT, MARK.WRONG]);
  eq([labels.get(53), labels.get(57), labels.get(63)], ['1', '3', 'D♯']);
  eq([marks.get(60), marks.get(64), labels.get(64)], [MARK.MISSING, MARK.MISSING, '7']);
});

/* ---------- Teclado: ventanas y flechas ---------- */

test('buildKeys en otra ventana: misma geometría, otras notas (C4–C6)', () => {
  const k4 = buildKeys(60, 84);
  eq([k4.length, k4[0].midi, k4[0].x, k4[24].midi], [25, 60, 10, 84]);
  eq(k4.map((k) => k.x), keys.map((k) => k.x));
});

test('arrowAt: mejillas izquierda y derecha a la altura del teclado', () => {
  eq([arrowAt(4, 168), arrowAt(315, 168), arrowAt(150, 168), arrowAt(4, 50)], [-1, 1, 0, 0]);
});

test('rangeFor: prefiere la ventana actual y luego la más cercana', () => {
  eq(rangeFor(64, 48), 48); // E4 se ve en C3–C5
  eq(rangeFor(64, 60), 60); // …y también en C4–C6: no cambia
  eq(rangeFor(79, 48), 60); // G5 solo en C4–C6
  eq(rangeFor(40, 60), 36); // E2 solo en C2–C4
  eq(rangeFor(30, 48), -1); // fuera de todas
});

test('PianoLayer: cambia de ventana de una en una y no pasa de los extremos', () => {
  const p = new PianoLayer();
  eq([p.from, p.to], [48, 72]);
  eq([p.shiftRange(1), p.from, p.keys[0].midi], [true, 60, 60]);
  eq([p.shiftRange(1), p.from], [false, 60]);
  eq([p.arrowAt(315, 168), p.arrowAt(4, 168)], [0, -1]);
  p.shiftRange(-1);
  p.shiftRange(-1);
  eq([p.from, p.shiftRange(-1), RANGES.includes(p.from)], [36, false, true]);
});

test('PianoLayer: la selección sobrevive al cambio de ventana y avisa qué hay fuera', () => {
  const p = new PianoLayer();
  p.setSelected([50, 76]); // D3 y E5 (E5 está fuera de C3–C5)
  eq([p.offscreen[-1], p.offscreen[1]], [false, true]);
  p.shiftRange(1); // C4–C6: ahora D3 queda fuera a la izquierda
  eq([p.offscreen[-1], p.offscreen[1], p.selected[50 - 36], p.selected[76 - 36]], [true, false, 1, 1]);
});

test('PianoLayer: setMarks reemplaza las marcas anteriores', () => {
  const p = new PianoLayer();
  p.setMarks(new Map([[60, MARK.CORRECT]]), new Map([[60, '1']]));
  p.setMarks(new Map([[62, MARK.WRONG]]));
  eq([p.marks[60 - 36], p.marks[62 - 36], p.degreeSprites[60 - 36]], [0, MARK.WRONG, null]);
});

/* ---------- Entrenador (lógica + eventos) ---------- */

function makeTrainer() {
  const bus = new EventBus();
  const log = [];
  for (const type of ['exercise:new', 'note:on', 'selection:change', 'answer:empty', 'answer:correct', 'answer:wrong']) {
    bus.on(type, (d) => log.push([type, d]));
  }
  let clock = 0;
  const trainer = new Trainer({ bus, persist: false, now: () => clock, random: () => 0 });
  trainer.setConfig({ types: ['maj7'], roots: ['F'] });
  return { trainer, log, tick: (ms) => { clock += ms; } };
}

test('trainer: next() publica el ejercicio', () => {
  const { trainer, log } = makeTrainer();
  trainer.next();
  eq([trainer.phase, trainer.current.id, log.some(([t]) => t === 'exercise:new')], ['asking', 'F|maj7', true]);
});

test('trainer: noteOn alterna la selección y selection:change no revela si es correcta', () => {
  const { trainer, log } = makeTrainer();
  trainer.next();
  trainer.noteOn(53);
  trainer.noteOn(57);
  trainer.noteOn(57);
  eq(trainer.getSelected(), [53]);
  const last = log.filter(([t]) => t === 'selection:change').pop()[1];
  eq(Object.keys(last).sort(), ['count', 'notes']);
});

test('trainer: submit correcto en inversión publica answer:correct con el tiempo', () => {
  const { trainer, log, tick } = makeTrainer();
  trainer.next();
  [57, 60, 64, 65].forEach((m) => trainer.noteOn(m));
  tick(3000);
  const d = trainer.submit();
  eq([d.result.correct, d.result.slashName, d.timeMs, trainer.phase], [true, 'Fmaj7/A', 3000, 'answered']);
  eq(log[log.length - 1][0], 'answer:correct');
});

test('trainer: sin notas publica answer:empty y sigue preguntando', () => {
  const { trainer, log } = makeTrainer();
  trainer.next();
  eq([trainer.submit(), trainer.phase, log[log.length - 1][0]], [null, 'asking', 'answer:empty']);
});

test('trainer: después de responder, noteOn suena pero no cambia la selección', () => {
  const { trainer, log } = makeTrainer();
  trainer.next();
  trainer.noteOn(53);
  trainer.submit();
  const before = log.length;
  trainer.noteOn(60);
  eq([trainer.getSelected(), log.slice(before).map(([t]) => t)], [[53], ['note:on']]);
});

test('trainer: la pausa congela el cronómetro y el tiempo en pausa no cuenta', () => {
  const { trainer, tick } = makeTrainer();
  trainer.next();
  trainer.noteOn(53);
  tick(1000);
  trainer.setPaused(true);
  tick(60000);
  eq(trainer.elapsedMs(), 1000);
  trainer.setPaused(false);
  tick(500);
  eq(trainer.submit().timeMs, 1500);
});

test('trainer: en pausa no entran notas, borrados ni respuestas', () => {
  const { trainer, log } = makeTrainer();
  trainer.next();
  trainer.noteOn(53);
  trainer.togglePause();
  const before = log.length;
  trainer.noteOn(57);
  trainer.clear();
  eq([trainer.submit(), trainer.getSelected(), log.length - before, trainer.phase], [null, [53], 0, 'asking']);
  trainer.togglePause();
  trainer.noteOn(57);
  eq(trainer.getSelected(), [53, 57]);
});

test('trainer: los eventos llevan kind = chord', () => {
  const { trainer, log } = makeTrainer();
  trainer.next();
  trainer.noteOn(53);
  trainer.submit();
  eq(log.find(([t]) => t === 'exercise:new')[1].kind, 'chord');
  eq(log[log.length - 1][1].kind, 'chord');
});

/* ---------- Historial (solo en memoria) ---------- */

test('historial: cada respuesta deja un registro con lo que faltó y sobró', () => {
  clearHistory();
  const { trainer } = makeTrainer();
  trainer.next();
  [53, 57, 63].forEach((m) => trainer.noteOn(m)); // F A Eb para Fmaj7
  trainer.submit();
  const [r] = getHistory('chord');
  eq([r.item, r.correct, r.missing, r.extra, r.inversion], ['F|maj7', false, ['C', 'E'], [63], null]);
});

test('historial: no pasa del tope y descarta los más viejos', () => {
  clearHistory();
  for (let i = 0; i < MAX_RECORDS + 5; i++) record({ module: 'x', item: String(i) });
  const all = getHistory();
  eq([all.length, all[0].item], [MAX_RECORDS, '5']);
  clearHistory();
});

/* ---------- Lectura ---------- */

const texts = (ps) => ps.map((p) => p.name + p.octave);

test('lectura: notas del pentagrama de sol (D4–G5) y de fa (F2–B3), solo naturales', () => {
  eq(texts(readingPitches('treble')), ['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5']);
  eq(texts(readingPitches('bass')), ['F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3']);
});

test('lectura: con líneas adicionales llega a 2 líneas (sol A3–C6, fa C2–E4)', () => {
  const t = readingPitches('treble', { ledger: true });
  const b = readingPitches('bass', { ledger: true });
  eq([t.length, texts(t)[0], texts(t).at(-1), b.length, texts(b)[0], texts(b).at(-1)], [17, 'A3', 'C6', 17, 'C2', 'E4']);
  for (const [clef, ps] of [['treble', t], ['bass', b]]) {
    for (const p of ps) if (ledgerYs(noteY(p, clef)).length > 2) throw new Error(`${p.name}${p.octave} lleva más de 2 líneas`);
  }
});

test('lectura: alteraciones solo de tecla negra (sin E♯, B♯, C♭, F♭) y todo cabe en C2–C6', () => {
  for (const clef of ['treble', 'bass']) {
    for (const p of readingPitches(clef, { ledger: true, accidentals: true })) {
      if (/^(E#|B#|Cb|Fb)$/.test(p.name)) throw new Error(`no debería estar ${p.name}`);
      if (p.midi < 36 || p.midi > 84) throw new Error(`${p.name}${p.octave} se sale del teclado`);
    }
  }
  const names = texts(readingPitches('treble', { ledger: true, accidentals: true }));
  eq([names.includes('C#6'), names.includes('Bb5'), names.includes('F#4')], [false, true, true]);
});

test('lectura: parsePitch y spellPlayed (♭ si la pedida lleva ♭, si no ♯)', () => {
  eq(parsePitch('Bb3'), { name: 'Bb', octave: 3, midi: 58 });
  eq(spellPlayed(63, parsePitch('Eb4')), { name: 'Eb', octave: 4, midi: 63 });
  eq(spellPlayed(63, parsePitch('E4')).name, 'D#');
  eq(spellPlayed(60, parsePitch('Bb4')), { name: 'C', octave: 4, midi: 60 });
});

test('lectura: describeMiss explica octava, alteración e intervalo', () => {
  const f = parsePitch('F#4');
  eq(describeMiss(f, spellPlayed(54, f)), 'Tocaste F♯3: la nota correcta, pero una octava más abajo.');
  eq(describeMiss(f, spellPlayed(65, f)), 'Tocaste F4: la misma línea o espacio, pero sin el ♯.');
  eq(describeMiss(parsePitch('A4'), spellPlayed(65, f)), 'Tocaste F4: está una 3.ª más abajo.');
  eq(describeMiss(parsePitch('C4'), spellPlayed(67, f)), 'Tocaste G4: está una 5.ª más arriba.');
});

test('lectura: configuración inválida vuelve a sol, sin líneas ni alteraciones', () => {
  eq(readingConfig({ clef: 'alto', ledger: 'x', chordTypes: ['dom9', 'x'] }), {
    mode: 'notes', clef: 'treble', ledger: false, accidentals: false,
    chordTypes: ['maj', 'm', 'dim', 'aug'], chordRoots: 'naturals', inversions: false,
  });
});

function makeReader(config) {
  const bus = new EventBus();
  const events = [];
  for (const e of ['answer:correct', 'answer:wrong', 'answer:empty', 'note:on', 'selection:change']) bus.on(e, (d) => events.push([e, d]));
  const reader = new Reader({ bus, persist: false, random: () => 0 });
  if (config) reader.setConfig(config);
  return { reader, events };
}

test('lectura: la primera tecla es la respuesta y exige la octava exacta', () => {
  const { reader, events } = makeReader();
  reader.next();
  const target = reader.current.pitch.midi;
  reader.noteOn(target - 12); // misma nota, otra octava → error
  reader.noteOn(target); // ya respondió: solo suena
  eq(events.map(([e]) => e), ['note:on', 'answer:wrong', 'note:on']);
  eq(reader.items[reader.current.id].box, 1);
});

test('lectura: acierto y "Ambas" mezcla las dos claves', () => {
  const { reader, events } = makeReader({ clef: 'both' });
  reader.next();
  reader.noteOn(reader.current.pitch.midi);
  eq(events.at(-1)[0], 'answer:correct');
  const clefs = new Set(reader.activeIds().map((id) => id.split('|')[0]));
  eq([...clefs], ['treble', 'bass']);
});

test('pentagrama: etiqueta propia bajo la nota y ancho mínimo fijo', () => {
  const out = layoutStaff({ notes: [{ name: 'F#', octave: 4, label: 'F♯4' }], mode: 'sequence', labels: true, minWidth: 72 });
  eq([out.width, out.labels.map((l) => l.text)], [72, ['F♯4']]);
});

/* ---------- Lectura de acordes escritos ---------- */

const chordText = (pitches) => pitches.map(pitchText).join(' ');

test('slashChordName: Fmaj7/A, C sin barra y (Am6/9)/C', () => {
  eq([slashChordName('F', 'maj7', 1), slashChordName('C', 'maj', 0), slashChordName('A', 'm69', 1)],
    ['Fmaj7/A', 'C', '(Am6/9)/C']);
});

test('lectura acordes: inversiones en posición cerrada (las de abajo suben una octava)', () => {
  eq(chordText(chordReadingVoicing('F', 'maj7', 0, 3)), 'F3 A3 C4 E4');
  eq(chordText(chordReadingVoicing('F', 'maj7', 1, 3)), 'A3 C4 E4 F4');
  eq(chordText(chordReadingVoicing('Bb', 'm7', 3, 3)), 'Ab4 Bb4 Db5 F5');
});

test('lectura acordes: C mayor sin líneas adicionales va en C5 (sol) y en C3 (fa)', () => {
  eq(chordPlacements('treble', 'C', 'maj', 0).map(chordText), ['C5 E5 G5']);
  eq(chordPlacements('bass', 'C', 'maj', 0).map(chordText), ['C3 E3 G3']);
  eq(chordPlacements('treble', 'C', 'maj', 0, { ledger: true }).map(chordText), ['C4 E4 G4', 'C5 E5 G5']);
});

test('lectura acordes: toda colocación cabe en la pizarra (≤ 2 líneas) y en UNA ventana', () => {
  for (const clef of ['treble', 'bass']) {
    for (const type of READING_CHORD_TYPES) {
      for (const root of ROOTS) {
        for (let inv = 0; inv < CHORD_TYPES[type].degrees.length; inv++) {
          for (const ps of chordPlacements(clef, root, type, inv, { ledger: true })) {
            if (ps.some((p) => ledgerYs(noteY(p, clef)).length > 2)) throw new Error(`${chordText(ps)} lleva más de 2 líneas`);
            const fits = RANGES.some((from) => ps.every((p) => p.midi >= from && p.midi <= from + 24));
            if (!fits) throw new Error(`${chordText(ps)} no cabe en una ventana`);
          }
        }
      }
    }
  }
});

test('lectura acordes: cada tipo tiene acordes en las dos claves con lo mínimo (sin líneas, naturales)', () => {
  for (const type of READING_CHORD_TYPES) {
    for (const clef of ['treble', 'bass']) {
      const ids = chordIds(readingConfig({ mode: 'chords', clef, chordTypes: [type] }));
      if (!ids.length) throw new Error(`${type} no tiene acordes en ${clef}`);
    }
  }
});

test('lectura acordes: compareChordReading exige notas y octavas exactas', () => {
  const ps = chordReadingVoicing('F', 'maj7', 0, 4); // F4 A4 C5 E5
  eq(compareChordReading(ps, [65, 69, 72, 76]).correct, true);
  // Inversión (mismas notas, otras octavas): no vale en lectura.
  const inv = compareChordReading(ps, [57, 60, 64, 65]);
  eq([inv.correct, inv.hit, inv.missing.map(pitchText), inv.extra], [false, [65], ['A4', 'C5', 'E5'], [57, 60, 64]]);
  // Duplicación: sobra la F5.
  eq(compareChordReading(ps, [65, 69, 72, 76, 77]).extra, [77]);
});

test('lectura acordes: lo que sobró se escribe con ♭ si el acorde lleva ♭', () => {
  const bb = chordReadingVoicing('Bb', 'maj', 0, 3);
  eq(spellExtras([61], bb).map(pitchText), ['Db4']);
  eq(spellExtras([61], chordReadingVoicing('D', 'maj', 0, 3)).map(pitchText), ['C#4']);
});

test('lectura acordes: ids por clave + acorde + inversión; sin inversiones solo la 0', () => {
  eq(parseId('acorde|bass|Eb|m7|2'), { id: 'acorde|bass|Eb|m7|2', mode: 'chords', clef: 'bass', root: 'Eb', type: 'm7', inversion: 2 });
  eq(parseId('treble|F#4').mode, 'notes');
  const base = { mode: 'chords', clef: 'treble', chordTypes: ['maj'], ledger: true };
  const plain = chordIds(readingConfig(base));
  const withInv = chordIds(readingConfig({ ...base, inversions: true }));
  eq([plain.length, plain.every((id) => id.endsWith('|0')), withInv.length], [NATURAL_ROOTS.length, true, NATURAL_ROOTS.length * 3]);
});

test('lectura acordes: se marca, se confirma y se compara exacto', () => {
  const { reader, events } = makeReader({ mode: 'chords' });
  reader.next();
  eq(reader.current.mode, 'chords');
  reader.submit(); // sin notas
  eq(events.at(-1)[0], 'answer:empty');
  const midis = reader.current.pitches.map((p) => p.midi);
  for (const m of midis) reader.noteOn(m);
  reader.noteOn(midis[0] + 1);
  reader.noteOn(midis[0] + 1); // otro clic la desmarca
  eq(events.at(-1), ['selection:change', { notes: midis, count: midis.length }]);
  reader.submit();
  eq(events.at(-1)[0], 'answer:correct');
  reader.noteOn(midis[0]); // ya respondió: solo suena, no cambia nada
  eq(events.at(-1)[0], 'note:on');
});

test('lectura acordes: una octava equivocada es error (no se aceptan inversiones)', () => {
  const { reader, events } = makeReader({ mode: 'chords' });
  reader.next();
  const midis = reader.current.pitches.map((p) => p.midi);
  for (const m of [midis[0] + 12, ...midis.slice(1)]) reader.noteOn(m);
  reader.submit();
  const [name, d] = events.at(-1);
  eq([name, d.result.missing.length, d.result.extra], ['answer:wrong', 1, [midis[0] + 12]]);
  eq(reader.items[reader.current.id].box, 1);
});

test('lectura: cambiar a acordes plantea un acorde; volver a notas, una nota', () => {
  const { reader } = makeReader();
  reader.next();
  reader.setConfig({ ...reader.config, mode: 'chords' });
  eq(reader.current.mode, 'chords');
  reader.setConfig({ ...reader.config, mode: 'notes' });
  eq(reader.current.mode, 'notes');
});

test('pentagrama: columna 1 (lo que sobró) va a la derecha del acorde', () => {
  const ps = [{ name: 'C', octave: 5 }, { name: 'E', octave: 5 }, { name: 'G', octave: 5 }];
  const out = layoutStaff({ notes: [...ps, { name: 'F', octave: 5, column: 1 }], mode: 'chord', clef: 'treble' });
  const main = out.heads.filter((h) => h.index < 3);
  const extra = out.heads.find((h) => h.index === 3);
  if (!(extra.x > Math.max(...main.map((h) => h.x)) + GLYPHS.head.w)) throw new Error('la columna 1 no queda a la derecha');
});

test('pentagrama: becuadro en la columna 1 si la columna 0 alteró esa nota', () => {
  const notes = [{ name: 'D', octave: 4 }, { name: 'F#', octave: 4 }, { name: 'A', octave: 4 }, { name: 'F', octave: 4, column: 1 }];
  const out = layoutStaff({ notes, mode: 'chord', clef: 'treble' });
  const glyphOf = (index) => out.accidentals.find((a) => a.index === index)?.glyph;
  eq([glyphOf(1) === GLYPHS.sharp, glyphOf(3) === GLYPHS.natural], [true, true]);
});

/* ---------- Reconocer intervalos y escalas ---------- */

function makeRec(config = {}) {
  const bus = new EventBus();
  const events = [];
  for (const e of ['exercise:new', 'answer:correct', 'answer:wrong', 'answer:empty', 'note:on', 'selection:change']) {
    bus.on(e, (d) => events.push([e, d]));
  }
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rec = new Recognizer({ bus, persist: false, now: () => 0, random });
  rec.config = recConfig(config);
  return { rec, events };
}

/** Plantea un ejercicio concreto (sin sorteo). */
function startWith(rec, id) {
  const item = recParseId(id);
  if (item.family === 'intervals') rec.buildInterval(item);
  else rec.buildScale(item);
  rec.begin(item);
  return item;
}

test('reconocer: configuración por defecto e inválida', () => {
  eq(recConfig({ family: 'x', intervals: ['zz'], scales: [] }), {
    family: 'intervals', source: 'both', answer: 'name', form: 'asc', clef: 'treble', accidentals: false,
    intervals: ['m3', 'M3', 'P5', 'P8'], scales: ['major', 'minor', 'harmonic', 'melodic'], roots: 'naturals',
  });
});

test('reconocer: pruebas según de dónde y cómo responder', () => {
  eq(testsOf(recConfig({ source: 'staff', answer: 'play' })), ['staff']);
  eq(testsOf(recConfig({ source: 'ear' })), ['ear']);
  eq(testsOf(recConfig({ source: 'both', answer: 'play' })), ['staff', 'play']);
});

test('reconocer: los candidatos de un intervalo SON ese intervalo y caben en el pentagrama', () => {
  for (const form of ['asc', 'desc', 'harm']) {
    for (const interval of RECOGNIZE_INTERVALS) {
      // En alguna clave tiene que haber (la 9m natural no cabe en fa sin líneas: E–F, B–C se salen).
      if (!['treble', 'bass'].some((clef) => intervalCandidates(interval, form, clef, { accidentals: false }).length)) {
        throw new Error(`${interval} ${form} sin candidatos`);
      }
    }
  }
  for (const clef of ['treble', 'bass']) {
    for (const form of ['asc', 'desc', 'harm']) {
      for (const interval of RECOGNIZE_INTERVALS) {
        const pairs = intervalCandidates(interval, form, clef, { accidentals: false });
        for (const [given, other, spelled] of pairs) {
          if (intervalBetween(given, other) !== spelled) throw new Error(`${given.name}${given.octave}–${other.name}${other.octave} no es ${spelled}`);
          if (interval === 'TT' ? !['A4', 'd5'].includes(spelled) : spelled !== interval) throw new Error(`${interval} escrito como ${spelled}`);
          if (other.name.length > 1 || given.name.length > 1) throw new Error('sin alteraciones pedidas');
          if ((form === 'desc') !== (given.midi > other.midi)) throw new Error(`dirección mal en ${form}`);
          if ([given, other].some((p) => ledgerYs(noteY(p, clef)).length)) throw new Error('lleva líneas adicionales');
        }
      }
    }
  }
});

test('reconocer: de oído, todo en C4–C6 y sin dobles alteraciones ni E♯/C♭', () => {
  for (const interval of RECOGNIZE_INTERVALS) {
    for (const form of ['asc', 'desc', 'harm']) {
      const pairs = intervalCandidates(interval, form);
      if (!pairs.length) throw new Error(`${interval} ${form} sin candidatos`);
      for (const [given, other] of pairs) {
        for (const p of [given, other]) {
          if (p.midi < 60 || p.midi > 84) throw new Error(`${p.name}${p.octave} fuera de C4–C6`);
          if (p.name.length > 2 || ['E#', 'B#', 'Cb', 'Fb'].includes(p.name)) throw new Error(`${p.name} mal escrita`);
        }
      }
    }
  }
});

test('reconocer: escala en la pizarra con las menos líneas adicionales', () => {
  eq(texts(scalePlacement('C', 'major', 'treble')), ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
  eq(texts(scalePlacement('C', 'major', 'bass')), ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4']);
  eq([scaleSpellable('Db', 'minor'), scaleSpellable('D', 'lydian')], [false, true]);
});

test('reconocer: toda escala que entra cabe en la pizarra (≤ 2 líneas) en alguna clave', () => {
  const ids = scaleIds(recConfig({ source: 'staff', clef: 'both', roots: 'all', scales: RECOGNIZE_SCALES }));
  if (ids.length < 100) throw new Error(`muy pocas: ${ids.length}`);
  for (const id of ids) {
    const { scale, root } = recParseId(id);
    const ok = ['treble', 'bass'].some((clef) => {
      const ps = scalePlacement(root, scale, clef);
      return ps && ps.every((p) => ledgerYs(noteY(p, clef)).length <= 2);
    });
    if (!ok) throw new Error(`${id} no cabe`);
  }
});

test('reconocer: escala tocada compara exacto y no cuenta la tónica ni su octava', () => {
  const ps = spellScaleVoicing('D', 'lydian', 60); // D4 … D5
  const inner = ps.slice(1, -1).map((p) => p.midi);
  eq(compareScalePlay(ps, inner).correct, true);
  eq(compareScalePlay(ps, [ps[0].midi, ...inner, ps[7].midi]).correct, true);
  const wrong = compareScalePlay(ps, [...inner.slice(0, 2), 67, ...inner.slice(3)]); // G4 en vez de G♯4
  eq([wrong.correct, wrong.missing.map(pitchText), wrong.extra], [false, ['G#4'], [67]]);
  eq(compareScalePlay(ps, inner.map((m) => m + 12)).hit.length, 0); // otra octava: no vale
});

test('reconocer: 12 intervalos; el tritono es uno solo, escrito como 4A o 5d', () => {
  eq(RECOGNIZE_INTERVALS.length, 12);
  const { rec, events } = makeRec({ source: 'both' });
  startWith(rec, 'int|staff|m3|asc');
  rec.choose('M3');
  eq([events.at(-1)[0], events.at(-1)[1].answer], ['answer:wrong', 'M3']);
  const spelled = new Set();
  for (let i = 0; i < 30; i++) {
    const item = startWith(rec, 'int|staff|TT|asc');
    spelled.add(item.spelled);
    rec.choose('TT');
    if (events.at(-1)[0] !== 'answer:correct') throw new Error('el tritono no se aceptó');
  }
  eq([...spelled].sort(), ['A4', 'd5']);
  // Configuraciones guardadas con 4A/5d separados pasan al tritono.
  eq(recConfig({ intervals: ['A4', 'd5', 'm9', 'P5'] }).intervals, ['TT', 'P5']);
});

test('reconocer: intervalo tocado: la dada solo suena; la primera otra tecla es la respuesta', () => {
  const { rec, events } = makeRec({ source: 'ear', answer: 'play' });
  const item = startWith(rec, 'int|play|P5|desc');
  eq(item.given.midi - item.target.midi, 7);
  rec.noteOn(item.given.midi);
  eq([events.at(-1)[0], rec.phase], ['note:on', 'asking']);
  rec.noteOn(item.target.midi + 12); // octava equivocada
  const [name, d] = events.at(-1);
  eq([name, d.played, rec.items[item.id].box], ['answer:wrong', item.target.midi + 12, 1]);
});

test('reconocer: escala tocada: se marca, las doradas no cuentan, se confirma', () => {
  const { rec, events } = makeRec({ family: 'scales', source: 'ear', answer: 'play' });
  const item = startWith(rec, 'esc|play|major');
  rec.submit();
  eq(events.at(-1)[0], 'answer:empty');
  rec.noteOn(item.given.midi); // la tónica: solo suena
  eq(rec.getSelected(), []);
  for (const p of item.pitches.slice(1, -1)) rec.noteOn(p.midi);
  rec.submit();
  eq(events.at(-1)[0], 'answer:correct');
});

test('reconocer: elegir nombre de escala; tocar no responde en una prueba de nombre', () => {
  const { rec, events } = makeRec({ family: 'scales' });
  const item = startWith(rec, 'esc|staff|lydian|F');
  eq([item.root, item.pitches[0].name, item.pitches.length], ['F', 'F', 8]);
  rec.noteOn(60);
  eq([events.at(-1)[0], rec.phase], ['note:on', 'asking']);
  rec.choose('lydian');
  eq(events.at(-1)[0], 'answer:correct');
});

test('reconocer: ids por prueba; cambiar de familia plantea uno de la nueva', () => {
  const ids = intervalIds(recConfig({ source: 'both', form: 'mix', intervals: ['m3'] }));
  eq(ids, ['int|staff|m3|asc', 'int|staff|m3|desc', 'int|staff|m3|harm', 'int|ear|m3|asc', 'int|ear|m3|desc', 'int|ear|m3|harm']);
  const { rec } = makeRec();
  rec.next();
  rec.setConfig({ ...rec.config, family: 'scales' });
  eq(rec.current.family, 'scales');
});

test('pentagrama: secuencia con slot más angosto (escala sin grados)', () => {
  const ps = spellScaleVoicing('C', 'major', 60);
  eq([layoutStaff({ notes: ps, mode: 'sequence', clef: 'treble' }).width, layoutStaff({ notes: ps, mode: 'sequence', clef: 'treble', slot: 14 }).width], [186, 138]);
});

/* ---------- Mostrar resultados ---------- */

const list = document.getElementById('results');
for (const r of results) {
  const li = document.createElement('li');
  li.className = r.ok ? 'pass' : 'fail';
  li.textContent = `${r.ok ? '✓' : '✗'} ${r.name}`;
  if (!r.ok) {
    const pre = document.createElement('pre');
    pre.textContent = r.msg;
    li.appendChild(pre);
  }
  list.appendChild(li);
}
const failed = results.filter((r) => !r.ok).length;
const summary = document.getElementById('summary');
summary.textContent = failed
  ? `${failed} de ${results.length} pruebas fallaron`
  : `${results.length} pruebas pasaron`;
summary.className = `summary ${failed ? 'fail' : 'pass'}`;
