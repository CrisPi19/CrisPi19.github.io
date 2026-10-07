/*
 * Pantalla de pausa, común a todos los módulos.
 *
 * - Trama (dither): una cuadrícula de ajedrez de píxeles `ink` sobre toda la escena.
 *   Oscurece a la mitad sin usar transparencias (cada píxel es opaco o vacío), que es
 *   como los juegos de 16 bits "atenuaban" la pantalla.
 * - Cartel "En pausa" centrado, con el símbolo de pausa (dos barras).
 *
 * Ambos se crean una sola vez; en el bucle solo se dibujan con drawImage.
 * El atajo para reanudar no se muestra en pantalla (decisión de diseño).
 */
import { C, PAL, RGB } from './palette.js';
import { renderText, CAP_TOP } from './font.js';
import { W, H } from './renderer.js';

const TEXT_SCALE = 2;
const PAD_X = 10;
const PAD_Y = 7;
const ICON_GAP = 7;

function makeDither() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const img = g.createImageData(W, H);
  const [r, gr, b] = RGB[C.INK];
  for (let y = 0; y < H; y++) {
    for (let x = (y & 1); x < W; x += 2) {
      const i = (y * W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gr;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

function makePanel() {
  const text = renderText('En pausa', { color: C.IVORY_2, outline: C.INK, scale: TEXT_SCALE });
  const capH = 7 * TEXT_SCALE; // alto de una mayúscula
  const iconW = 9;
  const w = PAD_X * 2 + iconW + ICON_GAP + text.width;
  const h = PAD_Y * 2 + capH;
  const canvas = document.createElement('canvas');
  canvas.width = w + 2; // +2: sombra dura
  canvas.height = h + 2;
  const g = canvas.getContext('2d');
  const rect = (c, x, y, rw, rh) => { g.fillStyle = PAL[c]; g.fillRect(x, y, rw, rh); };

  rect(C.INK, 2, 2, w, h); // sombra
  rect(C.INK, 0, 0, w, h); // borde
  rect(C.NIGHT_1, 1, 1, w - 2, h - 2);
  rect(C.NIGHT_2, 1, 1, w - 2, 1); // brillo superior
  rect(C.NIGHT_2, 1, 1, 1, h - 2); // brillo izquierdo

  // Símbolo de pausa: dos barras con contorno
  const iy = PAD_Y;
  for (const bx of [PAD_X, PAD_X + 6]) {
    rect(C.INK, bx - 1, iy - 1, 5, capH + 2);
    rect(C.FX_GOLD, bx, iy, 3, capH);
  }

  g.drawImage(text, PAD_X + iconW + ICON_GAP - 1, PAD_Y - 1 - CAP_TOP * TEXT_SCALE);
  return canvas;
}

export class PauseOverlay {
  constructor() {
    this.dither = makeDither();
    this.panel = makePanel();
    this.x = (W - this.panel.width) >> 1;
    this.y = (H - this.panel.height) >> 1;
  }

  draw(ctx) {
    ctx.drawImage(this.dither, 0, 0);
    ctx.drawImage(this.panel, this.x, this.y);
  }
}
