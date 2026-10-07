/*
 * Capa 3: piano de madera y teclado de 2 octavas, dibujado proceduralmente.
 *
 * Geometría (en píxeles lógicos):
 *   - 15 teclas blancas de 20 px (incluye su borde izquierdo) desde x = 10 → 300 px.
 *   - Negras de 12×34 px, desplazadas como en un piano real (C♯ y F♯ hacia la izquierda,
 *     D♯ y A♯ hacia la derecha, G♯ centrada), no centradas en la unión de las blancas.
 *
 * Ventanas: se ve una de 3 ventanas de 2 octavas (C2–C4, C3–C5, C4–C6). Se cambia de una
 * en una con las flechas de las mejillas del piano (sin deslizar). Una flecha se pinta en
 * azul si al otro lado hay teclas seleccionadas o marcadas, y brilla en dorado si el módulo
 * lo pide con setArrowHint() (por ejemplo, la nota a leer está en otra ventana).
 *
 * La capa no conoce ningún ejercicio: cada módulo le dice qué mostrar con setSelected(),
 * setMarks() y clearMarks(). Así no tiene ningún dato con qué revelar una respuesta
 * hasta que el módulo se lo entrega tras confirmar.
 */
import { C, PAL } from '../engine/palette.js';
import { renderText, CAP_TOP, measure } from '../engine/font.js';
import { W } from '../engine/renderer.js';
import {
  isBlackKey, midiToName, displayNote, displayDegree, chordPitchClasses, CHORD_TYPES,
} from '../theory.js';

export const KB_FROM = 48; // C3: ventana inicial
export const KB_TO = 72; // C5
export const KB_SPAN = 24; // 2 octavas
/** Inicio de cada ventana: C2–C4, C3–C5, C4–C6. */
export const RANGES = [36, 48, 60];
export const MIDI_MIN = RANGES[0];
export const MIDI_MAX = RANGES[RANGES.length - 1] + KB_SPAN;

export const KEYS_X = 10;
export const KEYS_Y = 120;
export const WHITE_W = 20;
export const WHITE_H = 56;
export const BLACK_W = 12;
export const BLACK_H = 34;
export const PIANO_TOP = 100;

/** Borde izquierdo de cada negra respecto a la unión de blancas (por clase de altura). */
const BLACK_OFFSET = { 1: -8, 3: -4, 6: -8, 8: -6, 10: -4 };

/** Flechas: en las mejillas del piano, abajo. La zona de clic es toda la mejilla. */
const KEYS_RIGHT = KEYS_X + 15 * WHITE_W; // 310
const ARROW_Y = 166;
const ARROW_X = { [-1]: 3, 1: 313 };

/** Marcas posibles de una tecla. */
export const MARK = { NONE: 0, CORRECT: 1, WRONG: 2, MISSING: 3 };

/* ---------------- Geometría (pura, se puede probar) ---------------- */

export function buildKeys(from = KB_FROM, to = KB_TO) {
  const keys = [];
  let whiteIndex = 0;
  for (let midi = from; midi <= to; midi++) {
    const black = isBlackKey(midi);
    if (black) {
      const x = KEYS_X + whiteIndex * WHITE_W + BLACK_OFFSET[midi % 12];
      keys.push({ midi, black, x, y: KEYS_Y, w: BLACK_W, h: BLACK_H });
    } else {
      keys.push({ midi, black, x: KEYS_X + whiteIndex * WHITE_W, y: KEYS_Y, w: WHITE_W, h: WHITE_H });
      whiteIndex++;
    }
  }
  return keys;
}

/** Tecla bajo el punto lógico (x, y), o -1. Las negras se prueban primero: están encima. */
export function hitTest(keys, x, y) {
  for (let pass = 0; pass < 2; pass++) {
    const wantBlack = pass === 0;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k.black !== wantBlack) continue;
      if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h) return k.midi;
    }
  }
  return -1;
}

/** Mejilla bajo el punto lógico: -1 izquierda, 1 derecha, 0 ninguna (no mira si se puede usar). */
export function arrowAt(x, y) {
  if (y < KEYS_Y || y >= KEYS_Y + WHITE_H + 4) return 0;
  if (x >= 0 && x < KEYS_X) return -1;
  if (x >= KEYS_RIGHT && x < W) return 1;
  return 0;
}

/**
 * Ventana (su nota inicial) donde se ve una nota, prefiriendo la actual y luego la más
 * cercana. -1 si no cabe en ninguna.
 */
export function rangeFor(midi, current = KB_FROM) {
  const order = [...RANGES].sort((a, b) => Math.abs(a - current) - Math.abs(b - current));
  for (const from of order) if (midi >= from && midi <= from + KB_SPAN) return from;
  return -1;
}

/**
 * Calcula marcas y etiquetas de grado tras confirmar.
 * Las notas que faltaron se muestran en la octava justo encima de la nota más grave tocada.
 */
export function computeMarks(notes, result, root, type, from = KB_FROM, to = KB_TO) {
  const degrees = CHORD_TYPES[type].degrees;
  const pcs = chordPitchClasses(root, type);
  const marks = new Map();
  const labels = new Map();
  for (const midi of notes) {
    const degree = result.degreeOf(midi);
    marks.set(midi, degree ? MARK.CORRECT : MARK.WRONG);
    // Correctas: su función (1, ♭3…). Sobrantes: su nombre, para ver qué se tocó.
    labels.set(midi, degree ? displayDegree(degree) : displayNote(midiToName(midi).replace(/-?\d+$/, '')));
  }
  const low = notes.length ? notes[0] : from;
  for (const pc of result.missing) {
    let midi = low + (((pc - low) % 12) + 12) % 12;
    if (midi > to) midi -= 12;
    if (midi < from) midi += 12;
    marks.set(midi, MARK.MISSING);
    labels.set(midi, displayDegree(degrees[pcs.indexOf(pc)]));
  }
  return { marks, labels };
}

/* ---------------- Colores por estado ---------------- */

// [cuerpo, frente, brillo] para blancas; [cuerpo, brillo] para negras. Índice = MARK (+ selección).
const WHITE_STYLE = {
  normal: [C.IVORY_1, C.IVORY_0, C.IVORY_2],
  selected: [C.NIGHT_3, C.NIGHT_2, C.IVORY_2],
  [MARK.CORRECT]: [C.OK_1, C.OK_0, C.FX_WHITE],
  [MARK.WRONG]: [C.BAD_1, C.BAD_0, C.FX_WHITE],
  [MARK.MISSING]: [C.MISS, C.WOOD_3, C.FX_WHITE],
};
const BLACK_STYLE = {
  normal: [C.KEY_BLACK, C.KEY_BLACK_HI],
  selected: [C.NIGHT_2, C.NIGHT_3],
  [MARK.CORRECT]: [C.OK_0, C.OK_1],
  [MARK.WRONG]: [C.BAD_0, C.BAD_1],
  [MARK.MISSING]: [C.MISS, C.FX_WHITE],
};

/* ---------------- Flechas ---------------- */

// Triángulo de 4×7 que apunta a la derecha; la flecha izquierda es su espejo.
const ARROW_ROWS = ['#...', '##..', '###.', '####', '###.', '##..', '#...'];

/** Flecha con sombra dura de 1 px (canvas de 5×8). */
function makeArrow(dir, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 5;
  canvas.height = 8;
  const g = canvas.getContext('2d');
  for (const [d, c] of [[1, C.INK], [0, color]]) {
    g.fillStyle = PAL[c];
    ARROW_ROWS.forEach((row, y) => {
      for (let x = 0; x < 4; x++) {
        if (row[dir > 0 ? x : 3 - x] === '#') g.fillRect(x + d, y + d, 1, 1);
      }
    });
  }
  return canvas;
}

/* ---------------- Capa ---------------- */

const STATE_SIZE = MIDI_MAX - MIDI_MIN + 1;

export class PianoLayer {
  constructor() {
    this.from = KB_FROM;
    this.to = KB_TO;
    this.keys = buildKeys(this.from, this.to);
    // Estado por nota MIDI (de C2 a C6), no por tecla visible: sobrevive a los cambios de ventana.
    this.selected = new Uint8Array(STATE_SIZE);
    this.marks = new Uint8Array(STATE_SIZE);
    this.degreeSprites = new Array(STATE_SIZE).fill(null);
    this.showNames = false;
    this.body = this.renderBody();
    this.nameSprites = buildKeys(MIDI_MIN, MIDI_MAX).map((k) => this.makeNameSprites(k));
    this.labelCache = new Map(); // texto|color → sprite (se llena en eventos, no en el bucle)

    this.hint = { [-1]: false, 1: false };
    this.offscreen = { [-1]: false, 1: false };
    this.arrows = {};
    for (const dir of [-1, 1]) {
      this.arrows[dir] = {
        normal: makeArrow(dir, C.WOOD_3),
        content: makeArrow(dir, C.NIGHT_3),
        glowA: makeArrow(dir, C.FX_GOLD),
        glowB: makeArrow(dir, C.FX_WHITE),
      };
    }
  }

  stateIndex(midi) {
    return midi - MIDI_MIN;
  }

  /* ----- Qué se muestra (lo decide cada módulo) ----- */

  setSelected(notes) {
    this.selected.fill(0);
    for (const midi of notes) {
      if (midi >= MIDI_MIN && midi <= MIDI_MAX) this.selected[this.stateIndex(midi)] = 1;
    }
    this.updateOffscreen();
  }

  clearMarks() {
    this.marks.fill(0);
    this.degreeSprites.fill(null);
    this.updateOffscreen();
  }

  /** Reemplaza las marcas: marks es un Map midi → MARK; labels, un Map midi → texto. */
  setMarks(marks, labels = new Map()) {
    this.marks.fill(0);
    this.degreeSprites.fill(null);
    for (const [midi, mark] of marks) {
      if (midi < MIDI_MIN || midi > MIDI_MAX) continue;
      const i = this.stateIndex(midi);
      this.marks[i] = mark;
      const text = labels.get(midi);
      if (text) this.degreeSprites[i] = this.label(text, this.labelColor(isBlackKey(midi), mark));
    }
    this.updateOffscreen();
  }

  setShowNames(show) {
    this.showNames = show;
  }

  /* ----- Ventanas ----- */

  /** Muestra la ventana que empieza en `from` (uno de RANGES). Devuelve true si cambió. */
  setRange(from) {
    if (!RANGES.includes(from) || from === this.from) return false;
    this.from = from;
    this.to = from + KB_SPAN;
    this.keys = buildKeys(this.from, this.to);
    this.updateOffscreen();
    return true;
  }

  /** Una ventana a la izquierda (-1) o a la derecha (1). Devuelve true si cambió. */
  shiftRange(dir) {
    return this.canShift(dir) && this.setRange(RANGES[RANGES.indexOf(this.from) + dir]);
  }

  canShift(dir) {
    const i = RANGES.indexOf(this.from) + dir;
    return i >= 0 && i < RANGES.length;
  }

  /** Flecha usable bajo el punto lógico: -1, 1 o 0. */
  arrowAt(x, y) {
    const dir = arrowAt(x, y);
    return dir && this.canShift(dir) ? dir : 0;
  }

  /** Hace brillar las flechas; lo pide el módulo (por ejemplo, la nota está en otra ventana). */
  setArrowHint(left, right) {
    this.hint[-1] = Boolean(left);
    this.hint[1] = Boolean(right);
  }

  /** Recalcula si hay teclas seleccionadas o marcadas fuera de la ventana, a cada lado. */
  updateOffscreen() {
    let left = false;
    let right = false;
    for (let i = 0; i < STATE_SIZE; i++) {
      if (!this.selected[i] && !this.marks[i]) continue;
      const midi = i + MIDI_MIN;
      if (midi < this.from) left = true;
      else if (midi > this.to) right = true;
    }
    this.offscreen[-1] = left;
    this.offscreen[1] = right;
  }

  /* ----- Sprites ----- */

  labelColor(black, mark) {
    return black && mark !== MARK.MISSING ? C.IVORY_2 : C.INK;
  }

  label(text, color) {
    const k = `${text}|${color}`;
    if (!this.labelCache.has(k)) this.labelCache.set(k, renderText(text, { color }));
    return this.labelCache.get(k);
  }

  /** Nombres de nota preparados al inicio: claro (sobre negra) y oscuro (sobre blanca o naranja). */
  makeNameSprites(key) {
    const name = midiToName(key.midi);
    if (!key.black) {
      const text = key.midi % 12 === 0 ? name : name[0];
      return { dark: renderText(text, { color: C.INK }), subtle: renderText(text, { color: C.IVORY_0 }) };
    }
    const letter = name[0];
    return {
      letterLight: renderText(letter, { color: C.IVORY_2 }),
      letterDark: renderText(letter, { color: C.INK }),
      sharpLight: renderText('♯', { color: C.IVORY_2 }),
      sharpDark: renderText('♯', { color: C.INK }),
    };
  }

  /** Cuerpo del piano (madera, mejillas, nombre): estático, se pinta una vez. */
  renderBody() {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = 80;
    const g = canvas.getContext('2d');
    const top = PIANO_TOP;
    const rect = (c, x, y, w, h) => { g.fillStyle = PAL[c]; g.fillRect(x, y - top, w, h); };

    rect(C.WOOD_1, 0, top, W, 80); // caja
    rect(C.WOOD_3, 0, top, W, 1); // canto de la tapa
    rect(C.WOOD_2, 0, top + 1, W, 1);
    rect(C.WOOD_0, 0, 113, W, 5); // tapa del teclado
    rect(C.WOOD_2, 0, 118, W, 1);
    rect(C.INK, 0, 119, W, 1); // sombra sobre las teclas
    // Mejillas laterales
    rect(C.WOOD_2, 1, top + 2, 1, 78);
    rect(C.WOOD_0, 9, 113, 1, 67);
    rect(C.INK, 310, 113, 1, 67);
    rect(C.WOOD_2, 312, top + 2, 1, 78);
    // Riel frontal bajo las teclas
    rect(C.WOOD_2, 10, 176, 300, 1);
    rect(C.WOOD_0, 10, 177, 300, 3);
    // Nombre en la tapa, en tono de madera (decorativo, de bajo contraste)
    const brand = renderText('CrisPianist', { color: C.WOOD_3 });
    g.drawImage(brand, Math.floor((W - measure('CrisPianist')) / 2), 104 - CAP_TOP - top);
    return canvas;
  }

  /* ----- Dibujo ----- */

  draw(ctx, time = 0) {
    ctx.drawImage(this.body, 0, PIANO_TOP);
    const keys = this.keys;
    for (let i = 0; i < keys.length; i++) if (!keys[i].black) this.drawWhite(ctx, keys[i]);
    for (let i = 0; i < keys.length; i++) if (keys[i].black) this.drawBlack(ctx, keys[i]);
    // Brillo a 4 fps: alterna dorado y blanco (cuantizado, se lee como animación de píxeles).
    const blink = Math.floor(time * 4) & 1;
    this.drawArrow(ctx, -1, blink);
    this.drawArrow(ctx, 1, blink);
  }

  drawArrow(ctx, dir, blink) {
    if (!this.canShift(dir)) return;
    const set = this.arrows[dir];
    let sprite = set.normal;
    if (this.hint[dir]) sprite = blink ? set.glowB : set.glowA;
    else if (this.offscreen[dir]) sprite = set.content;
    ctx.drawImage(sprite, ARROW_X[dir], ARROW_Y);
  }

  drawWhite(ctx, k) {
    const s = this.stateIndex(k.midi);
    const mark = this.marks[s];
    const pressed = this.selected[s] === 1;
    const style = mark ? WHITE_STYLE[mark] : (pressed ? WHITE_STYLE.selected : WHITE_STYLE.normal);
    const dy = pressed ? 1 : 0; // seleccionada: baja 1 píxel
    const x = k.x;
    const y = k.y;

    ctx.fillStyle = PAL[C.INK];
    ctx.fillRect(x, y, WHITE_W, WHITE_H);
    ctx.fillStyle = PAL[style[0]];
    ctx.fillRect(x + 1, y + dy, WHITE_W - 1, 51);
    ctx.fillStyle = PAL[style[2]];
    ctx.fillRect(x + 1, y + dy, 1, 51);
    ctx.fillStyle = PAL[style[1]];
    ctx.fillRect(x + 1, y + 51 + dy, WHITE_W - 1, 4 - dy);

    // Etiquetas por debajo del largo de las negras (34 px) para que nunca queden tapadas.
    const deg = this.degreeSprites[s];
    if (deg) ctx.drawImage(deg, x + 1 + ((WHITE_W - 1 - deg.width) >> 1), y + 36 - CAP_TOP + dy);

    const names = this.nameSprites[s];
    const isC = k.midi % 12 === 0;
    if (this.showNames || isC) {
      const sprite = this.showNames ? names.dark : names.subtle;
      if (this.showNames || (!mark && !pressed)) {
        ctx.drawImage(sprite, x + 1 + ((WHITE_W - 1 - sprite.width) >> 1), y + 44 - CAP_TOP + dy);
      }
    }
  }

  drawBlack(ctx, k) {
    const s = this.stateIndex(k.midi);
    const mark = this.marks[s];
    const pressed = this.selected[s] === 1;
    const style = mark ? BLACK_STYLE[mark] : (pressed ? BLACK_STYLE.selected : BLACK_STYLE.normal);
    const dy = pressed ? 1 : 0;
    const x = k.x;
    const y = k.y + dy;

    ctx.fillStyle = PAL[C.INK];
    ctx.fillRect(x, y, BLACK_W, BLACK_H);
    ctx.fillStyle = PAL[style[0]];
    ctx.fillRect(x + 1, y, BLACK_W - 2, BLACK_H - 1);
    ctx.fillStyle = PAL[style[1]];
    ctx.fillRect(x + 2, y, 1, 26); // brillo lateral
    ctx.fillRect(x + 2, y + 26, BLACK_W - 4, 1); // inicio del bisel frontal

    if (this.showNames) {
      const n = this.nameSprites[s];
      const dark = mark === MARK.MISSING;
      const letter = dark ? n.letterDark : n.letterLight;
      const sharp = dark ? n.sharpDark : n.sharpLight;
      ctx.drawImage(letter, x + ((BLACK_W - letter.width) >> 1), y + 3 - CAP_TOP);
      ctx.drawImage(sharp, x + ((BLACK_W - sharp.width) >> 1), y + 12 - CAP_TOP);
    }

    const deg = this.degreeSprites[s];
    if (deg) ctx.drawImage(deg, x + ((BLACK_W - deg.width) >> 1), y + 22 - CAP_TOP);
  }
}
