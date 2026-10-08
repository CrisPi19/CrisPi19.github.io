/*
 * Capa 5: interfaz dentro del canvas.
 *   - Nombre del acorde: lo más contrastado de la pantalla (marfil claro con contorno negro).
 *   - Nombre del tipo y cronómetro, en tonos discretos.
 *   - Burbuja de veredicto tras confirmar (corta; la explicación larga va en HTML).
 *
 * Todos los textos se convierten en sprites cuando llega el evento. En el bucle solo se
 * dibujan sprites ya hechos (el cronómetro, js/layers/timer.js, usa dígitos sueltos).
 */
import { C } from '../engine/palette.js';
import { renderText, CAP_TOP } from '../engine/font.js';
import { makeBubble } from '../engine/bubble.js';
import { W } from '../engine/renderer.js';
import { CHORD_TYPES, displayNote, inversionName } from '../theory.js';
import { TimerText } from './timer.js';

const NAME_CAP_Y = 16; // fila donde empieza el cuerpo de la tónica (escala ×3)
const BUBBLE_BOTTOM = 92;

export class UiLayer {
  constructor(bus, trainer) {
    this.trainer = trainer;
    this.rootSprite = null;
    this.qualitySprite = null;
    this.typeSprite = null;
    this.bubble = null;
    this.bubbleKind = null;

    this.timer = new TimerText();

    bus.on('exercise:new', (d) => this.setChord(d));
    bus.on('answer:correct', (d) => this.showVerdict(d));
    bus.on('answer:wrong', (d) => this.showVerdict(d));
    bus.on('answer:empty', () => this.setBubble([{ text: 'Marca al menos una tecla.' }], 'empty'));
    bus.on('selection:change', () => { if (this.bubbleKind === 'empty') this.setBubble(null); });
  }

  setChord({ root, type }) {
    const symbol = CHORD_TYPES[type].symbol.replace('b', '♭');
    const opts = { color: C.IVORY_2, outline: C.INK };
    this.rootSprite = renderText(displayNote(root), { ...opts, scale: 3 });
    this.qualitySprite = symbol ? renderText(symbol, { ...opts, scale: 2 }) : null;
    this.typeSprite = renderText(CHORD_TYPES[type].name, { color: C.IVORY_0 });
    this.setBubble(null);
  }

  showVerdict({ result }) {
    if (result.correct) {
      const lines = [{ text: '¡Correcto!', color: C.OK_0 }];
      if (result.inversion > 0) lines.push({ text: `${inversionName(result.inversion)}: ${result.slashName}` });
      this.setBubble(lines, 'verdict');
    } else {
      this.setBubble([{ text: 'No es correcto', color: C.BAD_0 }], 'verdict');
    }
  }

  setBubble(lines, kind = null) {
    this.bubble = lines ? makeBubble(lines) : null;
    this.bubbleKind = lines ? kind : null;
  }

  draw(ctx) {
    // En pausa el acorde se oculta: así la pausa no sirve para pensar con el cronómetro detenido.
    if (this.trainer.paused) return;

    if (this.rootSprite) {
      // La cualidad (maj7, m6/9…) va como superíndice, alineada arriba con la tónica.
      const gap = 1;
      const qw = this.qualitySprite ? this.qualitySprite.width + gap : 0;
      const x = (W - (this.rootSprite.width + qw)) >> 1;
      const rootY = NAME_CAP_Y - 1 - CAP_TOP * 3;
      ctx.drawImage(this.rootSprite, x, rootY);
      if (this.qualitySprite) {
        ctx.drawImage(this.qualitySprite, x + this.rootSprite.width + gap, NAME_CAP_Y - 1 - CAP_TOP * 2);
      }
      ctx.drawImage(this.typeSprite, (W - this.typeSprite.width) >> 1, 43 - CAP_TOP);
    }

    this.timer.draw(ctx, this.trainer.elapsedMs());

    if (this.bubble) {
      ctx.drawImage(this.bubble, (W - this.bubble.width) >> 1, BUBBLE_BOTTOM - this.bubble.height);
    }
  }
}
