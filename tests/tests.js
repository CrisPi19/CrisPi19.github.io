/*
 * Pruebas de js/theory.js y js/srs.js. Abrir tests/index.html con el servidor local.
 * Mini "framework": test(nombre, fn) y eq(real, esperado).
 */
import {
  spellChord, spellDegree, chordPitchClasses, chordName, analyzeAnswer,
  rootPositionVoicing, notePc, displayNote, parseDegree, CHORD_TYPES, ROOTS,
} from '../js/theory.js';
import { grade, pickNext, createItem, MAX_BOX } from '../js/srs.js';

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
