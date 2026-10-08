/*
 * Diagramación del pentagrama pixel art: decide DÓNDE va cada cosa (líneas, clave,
 * cabezas, alteraciones, líneas adicionales, grados), en píxeles lógicos enteros.
 * No dibuja ni toca el DOM: lo pinta js/layers/staff.js y se puede probar.
 *
 * Recibe notas ESCRITAS de js/theory.js ({ name: 'Bb', octave: 3 }): la altura en el
 * pentagrama depende solo de la letra y la octava escrita (C♭4 va en el espacio de C4).
 *
 * Geometría (relativa a la esquina superior izquierda de la caja del pentagrama):
 *   líneas cada 4 px; cada paso de letra (C→D) sube 2 px.
 *   Margen de 4 líneas adicionales arriba y abajo, y una fila para los grados.
 * Solo redondas: los módulos 3–5 no necesitan ritmo (el módulo 6 usará OSMD).
 */
import { letterSteps, romanDegree } from './theory.js';
import { GLYPHS, accidentalGlyph } from './engine/music-glyphs.js';

export const LINE_GAP = 4;
export const STAFF_TOP = 22; // y de la 1.ª línea (la de arriba)
export const STAFF_BOTTOM = STAFF_TOP + LINE_GAP * 4; // y de la 5.ª línea
export const LABEL_Y = 57; // celda de la fuente bitmap para los grados (sus dígitos: +2…+8)
export const STAFF_HEIGHT = 68;

const CLEF_X = 3;
const NOTES_X = 18; // primera columna libre después de la clave
const LEDGER_OVER = 2; // cuánto sobresale la línea adicional a cada lado de la cabeza
const ACC_GAP = 3; // de la cabeza al borde derecho de la alteración (deja libre la línea adicional)
const SLOT = 20; // ancho por nota en modo secuencia (cabe el grado más ancho, ♭VII)
const SEQ_ACC = 8; // espacio reservado para la alteración en cada nota de una secuencia
const MIN_CHORD_WIDTH = 56;
const RIGHT_PAD = 6;

/** Paso de letra de la línea de abajo de cada clave: E4 en sol, G2 en fa. */
const BOTTOM_STEP = { treble: letterSteps({ name: 'E', octave: 4 }), bass: letterSteps({ name: 'G', octave: 2 }) };

/** Clave sugerida: fa si el promedio de las notas está bajo el Do central. */
export function clefFor(pitches) {
  if (!pitches.length) return 'treble';
  const avg = pitches.reduce((sum, p) => sum + (p.midi ?? 0), 0) / pitches.length;
  return avg < 60 ? 'bass' : 'treble';
}

/** y del centro de una nota escrita en la clave dada. */
export function noteY(pitch, clef) {
  return STAFF_BOTTOM - (letterSteps(pitch) - BOTTOM_STEP[clef]) * (LINE_GAP / 2);
}

/** y de las líneas adicionales que necesita una nota (vacío si está dentro del pentagrama). */
export function ledgerYs(y) {
  const ys = [];
  for (let ly = STAFF_TOP - LINE_GAP; ly >= y; ly -= LINE_GAP) ys.push(ly);
  for (let ly = STAFF_BOTTOM + LINE_GAP; ly <= y; ly += LINE_GAP) ys.push(ly);
  return ys;
}

/** Alteración escrita de una nota ('#', '##', 'b', 'bb') o null. */
function accidentalOf({ name }) {
  return name.slice(1) || null;
}

/**
 * @param notes   notas escritas [{ name, octave, midi?, degree? }]
 * @param mode    'chord' (bloque) o 'sequence' (una tras otra)
 * @param clef    'treble' | 'bass' (por defecto, según la altura media)
 * @param labels  true: texto bajo cada nota (solo en 'sequence'): su `label` si la trae
 *                (p. ej. 'F♯4' en Lectura) o su grado en números romanos
 * @param colors  índice de nota (en el orden recibido) → índice de la paleta
 * @param minWidth  ancho mínimo de la caja (para que no cambie de tamaño entre ejercicios)
 * @returns {
 *   width, height, clef: { glyph, x, y }, lines: [y], ledgers: [{ x, y, w }],
 *   heads: [{ x, y, index, displaced }], accidentals: [{ glyph, x, y, index }],
 *   labels: [{ text, cx, y, index }], colors
 * }  donde `index` es la posición de la nota en `notes` (para su color).
 */
export function layoutStaff({
  notes, mode = 'chord', clef = clefFor(notes), labels = false, colors = {}, minWidth = 0,
}) {
  const out = {
    width: MIN_CHORD_WIDTH,
    height: STAFF_HEIGHT,
    clef: clef === 'bass'
      ? { glyph: GLYPHS.bass, x: CLEF_X, y: STAFF_TOP + LINE_GAP }
      : { glyph: GLYPHS.treble, x: CLEF_X, y: STAFF_BOTTOM - LINE_GAP },
    lines: [0, 1, 2, 3, 4].map((i) => STAFF_TOP + i * LINE_GAP),
    ledgers: [],
    heads: [],
    accidentals: [],
    labels: [],
    colors,
  };
  if (notes.length) {
    if (mode === 'chord') layoutChord(out, notes, clef);
    else layoutSequence(out, notes, clef, labels);
  }
  out.width = Math.max(out.width, minWidth);
  return out;
}

function layoutChord(out, notes, clef) {
  const head = GLYPHS.head;
  // De grave a agudo (por altura escrita; a igual letra, por sonido).
  const sorted = notes
    .map((p, index) => ({ p, index, step: letterSteps(p), y: noteY(p, clef) }))
    .sort((a, b) => a.step - b.step || (a.p.midi ?? 0) - (b.p.midi ?? 0));

  // Segundas: dos cabezas a 1 paso no caben una sobre otra; la de arriba va a la derecha
  // (como en un acorde con plica hacia arriba). En un racimo C D E: C izq., D der., E izq.
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    n.displaced = !!prev && n.step - prev.step === 1 && !prev.displaced;
  });

  // Alteraciones en columnas, de arriba hacia abajo: cada una va en la columna más cercana
  // a las cabezas donde no choque (con al menos 1 fila libre) con las ya puestas.
  const columns = []; // [{ w, spans: [[top, bottom]] }]
  const placed = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const n = sorted[i];
    const glyph = accidentalGlyph(accidentalOf(n.p));
    if (!glyph) continue;
    const top = n.y - glyph.ay;
    const bottom = top + glyph.h - 1;
    let col = columns.findIndex((c) => c.spans.every(([t, b]) => top > b + 1 || bottom < t - 1));
    if (col === -1) col = columns.push({ w: 0, spans: [] }) - 1;
    columns[col].spans.push([top, bottom]);
    columns[col].w = Math.max(columns[col].w, glyph.w);
    placed.push({ n, glyph, col });
  }
  const accWidth = columns.reduce((sum, c) => sum + c.w + 1, 0);

  const headX = NOTES_X + accWidth + LEDGER_OVER;
  const anyDisplaced = sorted.some((n) => n.displaced);
  const headsWidth = head.w * (anyDisplaced ? 2 : 1);

  for (const n of sorted) {
    out.heads.push({ x: headX + (n.displaced ? head.w : 0), y: n.y, index: n.index, displaced: n.displaced });
  }

  // Columna k: su borde derecho queda a la izquierda de la columna k-1.
  let right = headX - ACC_GAP;
  const colRight = columns.map((c) => {
    const r = right;
    right -= c.w + 1;
    return r;
  });
  for (const { n, glyph, col } of placed) {
    out.accidentals.push({ glyph, x: colRight[col] - glyph.w + 1, y: n.y, index: n.index });
  }

  // Líneas adicionales: una sola por altura, tan ancha como todas las cabezas del acorde.
  const ys = new Set();
  for (const n of sorted) for (const y of ledgerYs(n.y)) ys.add(y);
  for (const y of [...ys].sort((a, b) => a - b)) {
    out.ledgers.push({ x: headX - LEDGER_OVER, y, w: headsWidth + LEDGER_OVER * 2 });
  }

  out.width = Math.max(MIN_CHORD_WIDTH, headX + headsWidth + LEDGER_OVER + RIGHT_PAD);
}

function layoutSequence(out, notes, clef, labels) {
  const head = GLYPHS.head;
  // Una alteración vale hasta el final del compás para esa línea/espacio: si después vuelve
  // la misma letra natural (E♭3 … E3) hace falta un becuadro.
  const altered = new Map(); // 'E3' → alteración vigente
  notes.forEach((p, index) => {
    const y = noteY(p, clef);
    const x = NOTES_X + SEQ_ACC + index * SLOT;
    out.heads.push({ x, y, index, displaced: false });
    for (const ly of ledgerYs(y)) out.ledgers.push({ x: x - LEDGER_OVER, y: ly, w: head.w + LEDGER_OVER * 2 });

    const key = p.name[0] + p.octave;
    let acc = accidentalOf(p);
    if (acc) altered.set(key, acc);
    else if (altered.has(key)) {
      acc = 'n';
      altered.delete(key);
    }
    const glyph = accidentalGlyph(acc);
    if (glyph) out.accidentals.push({ glyph, x: x - ACC_GAP - glyph.w + 1, y, index });

    const text = p.label ?? (p.degree ? romanDegree(p.degree) : null);
    if (labels && text) out.labels.push({ text, cx: x + (head.w >> 1), y: LABEL_Y, index });
  });
  out.width = NOTES_X + SEQ_ACC + notes.length * SLOT;
}
