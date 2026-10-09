/*
 * Capa 5 de Lectura: el pentagrama va DENTRO de la escena, en una pizarra con marco de
 * madera sobre la pared (anticipo de la opción B). Es lo que hay que leer, así que va a
 * la altura de los ojos, justo encima del teclado, a escala ×1 lógica (en pantalla se ve
 * al mismo factor entero que todo el canvas).
 *
 * Notas sueltas:
 *   - Mientras se pregunta: solo la nota, en marfil (lo de mayor contraste).
 *   - Al responder: la nota pedida se pinta verde (acierto) o naranja (la que faltó, igual
 *     que su tecla) con su nombre debajo; si fue un error, al lado aparece en rojo la nota
 *     que se tocó, tal como se escribiría (se ve cuánto se desvió la lectura).
 * Acordes (pizarra más ancha):
 *   - Mientras se pregunta: el acorde en bloque, sin nombre.
 *   - Al confirmar: verde lo acertado, naranja lo que faltó y, al lado (si cabe), en rojo
 *     lo que sobró. La burbuja dice el nombre (Fmaj7/A) para unir las tres representaciones.
 * Burbuja corta con el veredicto a la derecha de la pizarra; cronómetro arriba.
 * En pausa se ve la pizarra vacía. Sprites y rectángulos se preparan en los eventos.
 */
import { C, PAL } from '../engine/palette.js';
import { makeBubble } from '../engine/bubble.js';
import { W } from '../engine/renderer.js';
import { displayNote, slashChordName } from '../theory.js';
import { noteY, layoutStaff, STAFF_HEIGHT } from '../notation.js';
import { spellExtras } from '../reading.js';
import { StaffLayer } from './staff.js';
import { TimerText } from './timer.js';

/** Ancho del papel en cada modo (el acorde con alteraciones y lo que sobró necesita más). */
const BOARD_W = { notes: 72, chords: 88 };
const BOARD_Y = 8;
const FRAME = 3;
const BUBBLE_GAP = 6;
const BUBBLE_CENTER_Y = BOARD_Y + 30; // a la altura del centro del pentagrama

/** Una nota se escribe al lado solo si cabe en el papel (hasta 4 líneas adicionales arriba, 3 abajo). */
const PAPER_MIN_Y = 6;
const PAPER_MAX_Y = 50;
const fitsPaper = (pitch, clef) => {
  const y = noteY(pitch, clef);
  return y >= PAPER_MIN_Y && y <= PAPER_MAX_Y;
};

const pitchLabel = (p) => displayNote(p.name) + p.octave;

/** Caja del papel (centrada en el canvas); el marco la rodea con 3 px. */
const boardBox = (mode) => ({ x: (W - BOARD_W[mode]) >> 1, y: BOARD_Y, w: BOARD_W[mode], h: STAFF_HEIGHT });

function makeBoard(box) {
  const canvas = document.createElement('canvas');
  canvas.width = box.w + FRAME * 2;
  canvas.height = box.h + FRAME * 2;
  const g = canvas.getContext('2d');
  const rect = (c, x, y, w, h) => { g.fillStyle = PAL[c]; g.fillRect(x, y, w, h); };
  rect(C.INK, 0, 0, canvas.width, canvas.height);
  rect(C.WOOD_2, 1, 1, canvas.width - 2, canvas.height - 2);
  rect(C.WOOD_1, 2, 2, canvas.width - 4, canvas.height - 4);
  rect(C.WOOD_3, 2, 1, canvas.width - 4, 1); // canto superior iluminado
  rect(C.STONE_0, FRAME, FRAME, box.w, box.h);
  return canvas;
}

export class ReadingUiLayer {
  constructor(bus, session) {
    this.session = session;
    this.boards = {};
    for (const mode of Object.keys(BOARD_W)) {
      const box = boardBox(mode);
      this.boards[mode] = { box, sprite: makeBoard(box) };
    }
    this.board = this.boards.notes;
    this.staff = new StaffLayer({ x: this.board.box.x, y: BOARD_Y });
    this.timer = new TimerText();
    this.bubble = null;
    this.bubbleKind = null;

    bus.on('exercise:new', (d) => this.showExercise(d));
    bus.on('answer:correct', (d) => this.showAnswer(d, true));
    bus.on('answer:wrong', (d) => this.showAnswer(d, false));
    bus.on('answer:empty', () => this.setBubble([{ text: 'Marca al menos' }, { text: 'una tecla.' }], 'empty'));
    bus.on('selection:change', () => { if (this.bubbleKind === 'empty') this.setBubble(null); });
  }

  setBoard(mode) {
    this.board = this.boards[mode];
    this.staff.x = this.board.box.x;
  }

  showExercise({ mode, clef, pitch, pitches }) {
    this.setBoard(mode);
    const minWidth = this.board.box.w;
    if (mode === 'chords') this.staff.set({ notes: pitches, mode: 'chord', clef, minWidth });
    else this.staff.set({ notes: [pitch], mode: 'sequence', clef, minWidth });
    this.setBubble(null);
  }

  showAnswer(detail, correct) {
    if (detail.mode === 'chords') this.showChordAnswer(detail, correct);
    else this.showNoteAnswer(detail, correct);
  }

  showNoteAnswer({ clef, pitch, playedPitch }, correct) {
    const notes = [{ ...pitch, label: pitchLabel(pitch) }];
    const colors = { 0: correct ? C.OK_1 : C.MISS };
    if (!correct && fitsPaper(playedPitch, clef)) {
      notes.push({ ...playedPitch, label: pitchLabel(playedPitch) });
      colors[1] = C.BAD_1;
    }
    this.staff.set({ notes, mode: 'sequence', clef, labels: true, colors, minWidth: this.board.box.w });
    this.setBubble(correct
      ? [{ text: '¡Correcto!', color: C.OK_0 }]
      : [{ text: 'No es correcto', color: C.BAD_0 }, { text: `era ${pitchLabel(pitch)}` }]);
  }

  showChordAnswer({ clef, root, type, inversion, pitches, result }, correct) {
    const minWidth = this.board.box.w;
    const missing = new Set(result.missing.map((p) => p.midi));
    const notes = [...pitches];
    const colors = {};
    pitches.forEach((p, i) => { colors[i] = missing.has(p.midi) ? C.MISS : C.OK_1; });

    // Lo que sobró, escrito al lado (columna 1) en rojo, si cabe en el papel.
    const extras = spellExtras(result.extra, pitches).filter((p) => fitsPaper(p, clef));
    const withExtras = [...notes, ...extras.map((p) => ({ ...p, column: 1 }))];
    if (extras.length && layoutStaff({ notes: withExtras, mode: 'chord', clef }).width <= minWidth) {
      extras.forEach((_, i) => { colors[notes.length + i] = C.BAD_1; });
      notes.push(...withExtras.slice(notes.length));
    }
    this.staff.set({ notes, mode: 'chord', clef, colors, minWidth });

    const name = slashChordName(root, type, inversion);
    this.setBubble(correct
      ? [{ text: '¡Correcto!', color: C.OK_0 }, { text: name }]
      : [{ text: 'No es correcto', color: C.BAD_0 }, { text: `era ${name}` }]);
  }

  setBubble(lines, kind = null) {
    this.bubble = lines ? makeBubble(lines) : null;
    this.bubbleKind = lines ? kind : null;
  }

  draw(ctx) {
    const { box, sprite } = this.board;
    ctx.drawImage(sprite, box.x - FRAME, box.y - FRAME);
    // En pausa lo escrito se oculta: la pausa no sirve para leer con el cronómetro detenido.
    if (this.session.paused) return;
    this.staff.draw(ctx);
    this.timer.draw(ctx, this.session.elapsedMs());
    if (this.bubble) {
      ctx.drawImage(this.bubble, box.x + box.w + FRAME + BUBBLE_GAP, BUBBLE_CENTER_Y - (this.bubble.height >> 1));
    }
  }
}
