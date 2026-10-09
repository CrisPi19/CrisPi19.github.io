/*
 * Capa 5 de Reconocer (módulo 5): la misma pizarra de Lectura (js/layers/board.js).
 *
 *   Pentagrama: el intervalo (dos notas seguidas, o en bloque si es armónico) o la escala
 *               (de la tónica a su octava, más apretada: sin grados debajo) escritos en
 *               marfil, sin nombre.
 *   Oído:       la pizarra solo dice qué se pregunta; no hay nada que leer.
 *   Al responder (las dos): lo que sonó se escribe (en sol si era de oído) para unir
 *   sonido, pentagrama y nombre. Verde = acertado; naranja = lo que era (y faltó);
 *   rojo = lo que se tocó de más; dorado = tónica o nota dada. Burbuja con el veredicto.
 * En pausa se ve la pizarra vacía. Sprites y rectángulos se preparan en los eventos.
 */
import { C } from '../engine/palette.js';
import { makeBubble } from '../engine/bubble.js';
import { renderText, measure, CAP_TOP } from '../engine/font.js';
import { displayNote, INTERVALS } from '../theory.js';
import { layoutStaff } from '../notation.js';
import { scaleLabel } from '../recognize.js';
import { spellExtras } from '../reading.js';
import { StaffLayer } from './staff.js';
import { TimerText } from './timer.js';
import {
  BOARD_Y, FRAME, BUBBLE_GAP, BUBBLE_CENTER_Y, fitsPaper, createBoard, drawBoard,
} from './board.js';

/** Escala: 8 notas a 14 px cada una (26 + 8·14 = 138); va a la izquierda para dejar sitio a la burbuja. */
const SCALE_SLOT = 14;
const BOARDS = {
  intervals: { w: 88 },
  scales: { w: 140, x: 14 },
};

const pitchLabel = (p) => displayNote(p.name) + p.octave;

/** Texto del ejercicio de oído, en dos líneas. */
const EAR_TEXT = {
  intervals: { ear: '¿Qué intervalo?', play: 'Toca la otra' },
  scales: { ear: '¿Qué escala?', play: 'Marca la escala' },
};

export class RecognizeUiLayer {
  constructor(bus, session) {
    this.session = session;
    this.boards = {};
    for (const [family, { w, x }] of Object.entries(BOARDS)) this.boards[family] = createBoard(w, x);
    this.board = this.boards.intervals;
    this.staff = new StaffLayer({ x: this.board.box.x, y: BOARD_Y });
    this.texts = []; // [{ canvas, x, y }] (pregunta de oído)
    this.timer = new TimerText();
    this.bubble = null;
    this.bubbleKind = null;

    bus.on('exercise:new', (d) => this.showExercise(d));
    bus.on('answer:correct', (d) => this.showAnswer(d, true));
    bus.on('answer:wrong', (d) => this.showAnswer(d, false));
    bus.on('answer:empty', () => this.setBubble([{ text: 'Marca al menos' }, { text: 'una tecla.' }], 'empty'));
    bus.on('selection:change', () => { if (this.bubbleKind === 'empty') this.setBubble(null); });
  }

  setBoard(family) {
    this.board = this.boards[family];
    this.staff.x = this.board.box.x;
  }

  showExercise(d) {
    this.setBoard(d.family);
    this.setBubble(null);
    this.texts = [];
    if (d.test === 'staff') {
      this.staff.visible = true;
      this.write(d, {});
      return;
    }
    // De oído: nada escrito, solo la pregunta.
    this.staff.visible = false;
    const lines = [
      { text: EAR_TEXT[d.family][d.test], color: C.IVORY_2 },
      { text: 'Espacio: oír', color: C.IVORY_0 },
    ];
    const { box } = this.board;
    lines.forEach((line, i) => {
      const canvas = renderText(line.text, { color: line.color });
      this.texts.push({ canvas, x: box.x + ((box.w - measure(line.text)) >> 1), y: box.y + 22 + i * 13 - CAP_TOP });
    });
  }

  /** Escribe las notas del ejercicio con colores por índice (y lo que sobró, si cabe). */
  write(d, colors, extras = []) {
    const minWidth = this.board.box.w;
    if (d.family === 'scales') {
      // Lo que sobró se intercala por altura (se ve dónde se metió), si todo cabe en el papel.
      let notes = d.pitches.map((p, i) => ({ ...p, i }));
      const extraNotes = extras.filter((p) => fitsPaper(p, d.clef)).map((p) => ({ ...p, i: -1 }));
      const merged = [...notes, ...extraNotes].sort((a, b) => a.midi - b.midi);
      if (extraNotes.length && layoutStaff({ notes: merged, mode: 'sequence', clef: d.clef, slot: SCALE_SLOT }).width <= minWidth) {
        notes = merged;
      }
      const byIndex = {};
      notes.forEach((n, k) => { byIndex[k] = n.i === -1 ? C.BAD_1 : colors[n.i]; });
      this.staff.set({ notes, mode: 'sequence', clef: d.clef, colors: byIndex, minWidth, slot: SCALE_SLOT });
      return;
    }
    if (d.form === 'harm') {
      const notes = [...d.pitches, ...extras.filter((p) => fitsPaper(p, d.clef)).map((p) => ({ ...p, column: 1 }))];
      const cols = { ...colors };
      for (let i = 2; i < notes.length; i++) cols[i] = C.BAD_1;
      this.staff.set({ notes, mode: 'chord', clef: d.clef, colors: cols, minWidth });
      return;
    }
    const labelled = Object.keys(colors).length > 0;
    const notes = d.pitches.map((p) => (labelled ? { ...p, label: pitchLabel(p) } : p));
    const cols = { ...colors };
    for (const p of extras.filter((e) => fitsPaper(e, d.clef))) {
      cols[notes.length] = C.BAD_1;
      notes.push({ ...p, label: pitchLabel(p) });
    }
    this.staff.set({ notes, mode: 'sequence', clef: d.clef, labels: labelled, colors: cols, minWidth });
  }

  showAnswer(d, correct) {
    this.texts = [];
    this.staff.visible = true;
    if (d.family === 'scales') this.showScaleAnswer(d, correct);
    else this.showIntervalAnswer(d, correct);
  }

  showIntervalAnswer(d, correct) {
    // La dada (o la primera) en dorado; la otra verde si se acertó, naranja si no.
    const colors = { 0: C.FX_GOLD, 1: correct ? C.OK_1 : C.MISS };
    const extras = d.test === 'play' && !correct ? [d.playedPitch] : [];
    this.write(d, colors, extras);
    const name = INTERVALS[d.spelled].short; // como está escrito (el tritono: 4A o 5d)
    this.setBubble(correct
      ? [{ text: '¡Correcto!', color: C.OK_0 }, { text: name }]
      : [{ text: 'No es correcto', color: C.BAD_0 }, { text: `era ${name}` }]);
  }

  showScaleAnswer(d, correct) {
    const last = d.pitches.length - 1;
    const colors = {};
    let extras = [];
    if (d.test === 'play') {
      const missing = new Set(d.result.missing.map((p) => p.midi));
      d.pitches.forEach((p, i) => { colors[i] = missing.has(p.midi) ? C.MISS : C.OK_1; });
      extras = spellExtras(d.result.extra, d.pitches);
    } else {
      d.pitches.forEach((_, i) => { colors[i] = correct ? C.OK_1 : C.MISS; });
    }
    colors[0] = C.FX_GOLD;
    colors[last] = C.FX_GOLD;
    this.write(d, colors, extras);
    const name = scaleLabel(d.root, d.scale);
    this.setBubble(correct
      ? [{ text: '¡Correcto!', color: C.OK_0 }, { text: name }]
      : [{ text: 'No es correcto', color: C.BAD_0 }, { text: `era ${name}` }]);
  }

  setBubble(lines, kind = null) {
    this.bubble = lines ? makeBubble(lines) : null;
    this.bubbleKind = lines ? kind : null;
  }

  draw(ctx) {
    const { box } = this.board;
    drawBoard(ctx, this.board);
    // En pausa lo escrito se oculta: la pausa no sirve para leer con el cronómetro detenido.
    if (this.session.paused) return;
    this.staff.draw(ctx);
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      ctx.drawImage(t.canvas, t.x, t.y);
    }
    this.timer.draw(ctx, this.session.elapsedMs());
    if (this.bubble) {
      ctx.drawImage(this.bubble, box.x + box.w + FRAME + BUBBLE_GAP, BUBBLE_CENTER_Y - (this.bubble.height >> 1));
    }
  }
}
