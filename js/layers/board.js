/*
 * Pizarra de la escena: papel oscuro con marco de madera, donde va el pentagrama
 * (anticipo de la opción B: el pentagrama dentro del conservatorio). La usan Lectura
 * (js/layers/reading-ui.js) y Reconocer (js/layers/recognize-ui.js).
 *
 * Solo prepara sprites y medidas; cada módulo decide qué escribe en ella.
 */
import { C, PAL } from '../engine/palette.js';
import { W } from '../engine/renderer.js';
import { noteY, STAFF_HEIGHT } from '../notation.js';

export const BOARD_Y = 8;
export const FRAME = 3;
export const BUBBLE_GAP = 6;
/** Altura del centro del pentagrama: ahí se centra la burbuja de al lado. */
export const BUBBLE_CENTER_Y = BOARD_Y + 30;

/** Una nota se escribe en el papel solo si cabe (hasta 4 líneas adicionales arriba, 3 abajo). */
const PAPER_MIN_Y = 6;
const PAPER_MAX_Y = 50;
export function fitsPaper(pitch, clef) {
  const y = noteY(pitch, clef);
  return y >= PAPER_MIN_Y && y <= PAPER_MAX_Y;
}

/** Caja del papel de ancho `w`: centrada en el canvas, o desde `x` si se da. */
export function boardBox(w, x = (W - w) >> 1) {
  return { x, y: BOARD_Y, w, h: STAFF_HEIGHT };
}

/** Sprite del marco + papel para una caja (el marco la rodea con FRAME px). */
export function makeBoard(box) {
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

/** Pizarra lista: { box, sprite }. */
export function createBoard(w, x) {
  const box = boardBox(w, x);
  return { box, sprite: makeBoard(box) };
}

export function drawBoard(ctx, board) {
  ctx.drawImage(board.sprite, board.box.x - FRAME, board.box.y - FRAME);
}
