/*
 * Capa 5 de Lectura: el pentagrama va DENTRO de la escena, en una pizarra con marco de
 * madera sobre la pared (anticipo de la opción B). Es lo que hay que leer, así que va a
 * la altura de los ojos, justo encima del teclado, a escala ×1 lógica (en pantalla se ve
 * al mismo factor entero que todo el canvas).
 *
 *   - Mientras se pregunta: solo la nota, en marfil (lo de mayor contraste).
 *   - Al responder: la nota pedida se pinta verde (acierto) o naranja (la que faltó, igual
 *     que su tecla) con su nombre debajo; si fue un error, al lado aparece en rojo la nota
 *     que se tocó, tal como se escribiría (se ve cuánto se desvió la lectura).
 *   - Burbuja corta con el veredicto a la derecha de la pizarra; cronómetro arriba.
 * En pausa se ve la pizarra vacía. Sprites y rectángulos se preparan en los eventos.
 */
import { C, PAL } from '../engine/palette.js';
import { makeBubble } from '../engine/bubble.js';
import { displayNote } from '../theory.js';
import { noteY, STAFF_HEIGHT } from '../notation.js';
import { StaffLayer } from './staff.js';
import { TimerText } from './timer.js';

/** Caja del papel del pentagrama (el marco la rodea con 3 px). */
export const BOARD = { x: 124, y: 8, w: 72, h: STAFF_HEIGHT };
const FRAME = 3;
const BUBBLE_X = BOARD.x + BOARD.w + FRAME + 6;
const BUBBLE_CENTER_Y = BOARD.y + 30; // a la altura del centro del pentagrama

/** La nota tocada se dibuja solo si cabe en el papel (hasta 4 líneas adicionales arriba, 3 abajo). */
const PAPER_MIN_Y = 6;
const PAPER_MAX_Y = 50;

const pitchLabel = (p) => displayNote(p.name) + p.octave;

function makeBoard() {
  const canvas = document.createElement('canvas');
  canvas.width = BOARD.w + FRAME * 2;
  canvas.height = BOARD.h + FRAME * 2;
  const g = canvas.getContext('2d');
  const rect = (c, x, y, w, h) => { g.fillStyle = PAL[c]; g.fillRect(x, y, w, h); };
  rect(C.INK, 0, 0, canvas.width, canvas.height);
  rect(C.WOOD_2, 1, 1, canvas.width - 2, canvas.height - 2);
  rect(C.WOOD_1, 2, 2, canvas.width - 4, canvas.height - 4);
  rect(C.WOOD_3, 2, 1, canvas.width - 4, 1); // canto superior iluminado
  rect(C.STONE_0, FRAME, FRAME, BOARD.w, BOARD.h);
  return canvas;
}

export class ReadingUiLayer {
  constructor(bus, session) {
    this.session = session;
    this.board = makeBoard();
    this.staff = new StaffLayer({ x: BOARD.x, y: BOARD.y });
    this.timer = new TimerText();
    this.bubble = null;

    bus.on('exercise:new', ({ clef, pitch }) => {
      this.staff.set({ notes: [pitch], mode: 'sequence', clef, minWidth: BOARD.w });
      this.bubble = null;
    });
    bus.on('answer:correct', (d) => this.showAnswer(d, true));
    bus.on('answer:wrong', (d) => this.showAnswer(d, false));
  }

  showAnswer({ clef, pitch, playedPitch }, correct) {
    const notes = [{ ...pitch, label: pitchLabel(pitch) }];
    const colors = { 0: correct ? C.OK_1 : C.MISS };
    if (!correct) {
      const y = noteY(playedPitch, clef);
      if (y >= PAPER_MIN_Y && y <= PAPER_MAX_Y) {
        notes.push({ ...playedPitch, label: pitchLabel(playedPitch) });
        colors[1] = C.BAD_1;
      }
    }
    this.staff.set({ notes, mode: 'sequence', clef, labels: true, colors, minWidth: BOARD.w });
    this.bubble = makeBubble(correct
      ? [{ text: '¡Correcto!', color: C.OK_0 }]
      : [{ text: 'No es correcto', color: C.BAD_0 }, { text: `era ${pitchLabel(pitch)}` }],
    );
  }

  draw(ctx) {
    ctx.drawImage(this.board, BOARD.x - FRAME, BOARD.y - FRAME);
    // En pausa la nota se oculta: la pausa no sirve para leer con el cronómetro detenido.
    if (this.session.paused) return;
    this.staff.draw(ctx);
    this.timer.draw(ctx, this.session.elapsedMs());
    if (this.bubble) ctx.drawImage(this.bubble, BUBBLE_X, BUBBLE_CENTER_Y - (this.bubble.height >> 1));
  }
}
