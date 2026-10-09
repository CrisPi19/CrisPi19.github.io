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
import { C } from '../engine/palette.js';
import { makeBubble } from '../engine/bubble.js';
import { displayNote, slashChordName } from '../theory.js';
import { layoutStaff } from '../notation.js';
import { spellExtras } from '../reading.js';
import { StaffLayer } from './staff.js';
import { TimerText } from './timer.js';
import {
  BOARD_Y, FRAME, BUBBLE_GAP, BUBBLE_CENTER_Y, fitsPaper, createBoard, drawBoard,
} from './board.js';

/** Ancho del papel en cada modo (el acorde con alteraciones y lo que sobró necesita más). */
const BOARD_W = { notes: 72, chords: 88 };

const pitchLabel = (p) => displayNote(p.name) + p.octave;

export class ReadingUiLayer {
  constructor(bus, session) {
    this.session = session;
    this.boards = {};
    for (const [mode, w] of Object.entries(BOARD_W)) this.boards[mode] = createBoard(w);
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
    const { box } = this.board;
    drawBoard(ctx, this.board);
    // En pausa lo escrito se oculta: la pausa no sirve para leer con el cronómetro detenido.
    if (this.session.paused) return;
    this.staff.draw(ctx);
    this.timer.draw(ctx, this.session.elapsedMs());
    if (this.bubble) {
      ctx.drawImage(this.bubble, box.x + box.w + FRAME + BUBBLE_GAP, BUBBLE_CENTER_Y - (this.bubble.height >> 1));
    }
  }
}
