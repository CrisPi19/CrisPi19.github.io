/*
 * Burbuja de diálogo pixel art: caja marfil con borde oscuro, esquinas recortadas
 * y cola opcional. Devuelve un canvas listo para dibujar (crearla en un evento, no en el bucle).
 *
 * lines: [{ text, color }]   tail: null | 'down' | 'left' | 'right'
 * Lo usará también el sistema de diálogos de las mascotas (etapa 3).
 */
import { C, PAL } from './palette.js';
import { renderText, measure, CAP_TOP } from './font.js';

const LINE_H = 10;
const PAD_X = 5;
const PAD_Y = 4;
const TAIL_H = 3;

export function makeBubble(lines, { fill = C.IVORY_2, border = C.INK, tail = null } = {}) {
  const textW = Math.max(...lines.map((l) => measure(l.text)));
  const w = textW + PAD_X * 2;
  const h = PAD_Y * 2 + lines.length * LINE_H - 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h + TAIL_H + 1;
  const g = canvas.getContext('2d');
  const rect = (c, x, y, rw, rh) => { g.fillStyle = PAL[c]; g.fillRect(x, y, rw, rh); };

  // Borde (con esquinas recortadas de 1 px) y relleno
  rect(border, 1, 0, w - 2, h);
  rect(border, 0, 1, w, h - 2);
  rect(fill, 1, 1, w - 2, h - 2);
  // Sombra dura de 1 px bajo la caja
  rect(C.INK, 2, h, w - 3, 1);

  if (tail) {
    const cx = tail === 'left' ? 8 : tail === 'right' ? w - 9 : w >> 1;
    for (let i = 0; i < TAIL_H; i++) {
      const half = TAIL_H - 1 - i;
      rect(border, cx - half - 1, h - 1 + i, half * 2 + 3, 1);
      if (half > 0 || i === 0) rect(fill, cx - half, h - 1 + i, half * 2 + 1, 1);
    }
  }

  lines.forEach((line, i) => {
    const sprite = renderText(line.text, { color: line.color ?? C.INK });
    const x = (w - sprite.width) >> 1;
    g.drawImage(sprite, x, PAD_Y + i * LINE_H - CAP_TOP);
  });
  return canvas;
}
