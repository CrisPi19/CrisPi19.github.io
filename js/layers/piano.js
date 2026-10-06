/*
 * Capa 3: piano de madera y teclado de 2 octavas (C3–C5), dibujado proceduralmente.
 *
 * Geometría (en píxeles lógicos):
 *   - 15 teclas blancas de 20 px (incluye su borde izquierdo) desde x = 10 → 300 px.
 *   - Negras de 12×34 px, desplazadas como en un piano real (C♯ y F♯ hacia la izquierda,
 *     D♯ y A♯ hacia la derecha, G♯ centrada), no centradas en la unión de las blancas.
 *
 * La capa solo se entera de la respuesta por los eventos 'answer:*': antes de confirmar
 * no tiene ningún dato con qué revelarla.
 */
import { C, PAL } from '../engine/palette.js';
import { renderText, CAP_TOP, measure } from '../engine/font.js';
import { W } from '../engine/renderer.js';
import {
  isBlackKey, midiToName, displayNote, displayDegree, chordPitchClasses, CHORD_TYPES,
} from '../theory.js';

export const KB_FROM = 48; // C3
export const KB_TO = 72; // C5
export const KEYS_X = 10;
export const KEYS_Y = 120;
export const WHITE_W = 20;
export const WHITE_H = 56;
export const BLACK_W = 12;
export const BLACK_H = 34;
export const PIANO_TOP = 100;

/** Borde izquierdo de cada negra respecto a la unión de blancas (por clase de altura). */
const BLACK_OFFSET = { 1: -8, 3: -4, 6: -8, 8: -6, 10: -4 };

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

/* ---------------- Capa ---------------- */

export class PianoLayer {
  constructor(bus) {
    this.keys = buildKeys();
    const n = this.keys.length;
    this.selected = new Uint8Array(n);
    this.marks = new Uint8Array(n);
    this.degreeSprites = new Array(n).fill(null);
    this.showNames = false;
    this.body = this.renderBody();
    this.nameSprites = this.keys.map((k) => this.makeNameSprites(k));
    this.labelCache = new Map(); // texto|color → sprite (se llena en eventos, no en el bucle)

    bus.on('exercise:new', () => this.clearMarks());
    bus.on('selection:change', ({ notes }) => this.setSelected(notes));
    bus.on('answer:correct', (d) => this.showAnswer(d));
    bus.on('answer:wrong', (d) => this.showAnswer(d));
  }

  indexOf(midi) {
    return midi - KB_FROM;
  }

  setSelected(notes) {
    this.selected.fill(0);
    for (const midi of notes) {
      const i = this.indexOf(midi);
      if (i >= 0 && i < this.keys.length) this.selected[i] = 1;
    }
  }

  clearMarks() {
    this.marks.fill(0);
    this.degreeSprites.fill(null);
  }

  showAnswer({ notes, result, root, type }) {
    const { marks, labels } = computeMarks(notes, result, root, type);
    this.clearMarks();
    for (const [midi, mark] of marks) {
      const i = this.indexOf(midi);
      this.marks[i] = mark;
      const text = labels.get(midi);
      if (text) this.degreeSprites[i] = this.label(text, this.labelColor(this.keys[i], mark));
    }
  }

  setShowNames(show) {
    this.showNames = show;
  }

  labelColor(key, mark) {
    return key.black && mark !== MARK.MISSING ? C.IVORY_2 : C.INK;
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

  draw(ctx) {
    ctx.drawImage(this.body, 0, PIANO_TOP);
    const keys = this.keys;
    for (let i = 0; i < keys.length; i++) if (!keys[i].black) this.drawWhite(ctx, i);
    for (let i = 0; i < keys.length; i++) if (keys[i].black) this.drawBlack(ctx, i);
  }

  drawWhite(ctx, i) {
    const k = this.keys[i];
    const mark = this.marks[i];
    const pressed = this.selected[i] === 1;
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
    const deg = this.degreeSprites[i];
    if (deg) ctx.drawImage(deg, x + 1 + ((WHITE_W - 1 - deg.width) >> 1), y + 36 - CAP_TOP + dy);

    const names = this.nameSprites[i];
    const isC = k.midi % 12 === 0;
    if (this.showNames || isC) {
      const s = this.showNames ? names.dark : names.subtle;
      if (this.showNames || (!mark && !pressed)) {
        ctx.drawImage(s, x + 1 + ((WHITE_W - 1 - s.width) >> 1), y + 44 - CAP_TOP + dy);
      }
    }
  }

  drawBlack(ctx, i) {
    const k = this.keys[i];
    const mark = this.marks[i];
    const pressed = this.selected[i] === 1;
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
      const n = this.nameSprites[i];
      const dark = mark === MARK.MISSING;
      const letter = dark ? n.letterDark : n.letterLight;
      const sharp = dark ? n.sharpDark : n.sharpLight;
      ctx.drawImage(letter, x + ((BLACK_W - letter.width) >> 1), y + 3 - CAP_TOP);
      ctx.drawImage(sharp, x + ((BLACK_W - sharp.width) >> 1), y + 12 - CAP_TOP);
    }

    const deg = this.degreeSprites[i];
    if (deg) ctx.drawImage(deg, x + ((BLACK_W - deg.width) >> 1), y + 22 - CAP_TOP);
  }
}
