/*
 * Fuente bitmap de CrisPianist, definida en código.
 *
 * Cada carácter ocupa una celda de CELL_H = 11 filas:
 *   filas 0–1  espacio para tildes
 *   filas 2–8  cuerpo (mayúsculas y dígitos: 7 filas; minúsculas: filas 4–8)
 *   filas 9–10 descendentes (g, j, p, q, y)
 * El ancho es variable (fuente proporcional) y entre letras hay 1 px.
 *
 * Formato: 'X': [filaInicial, 'fila', 'fila', …] con '#' = píxel encendido.
 * Las letras con tilde, diéresis o virgulilla se componen solas (base + acento).
 *
 * Uso: renderText() devuelve un canvas con el texto ya pintado (se llama cuando ocurre
 * un evento, NUNCA dentro del bucle). Para números que cambian cada fotograma
 * (el cronómetro) se usan sprites de glifos sueltos creados una sola vez.
 */
import { RGB } from './palette.js';

export const CELL_H = 11;
/** Fila donde empieza el cuerpo de mayúsculas: útil para alinear texto. */
export const CAP_TOP = 2;
const SPACING = 1;

/* eslint-disable */
const GLYPHS = {
  ' ': [2, '...'],
  // ---------- Mayúsculas ----------
  A: [2, '.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: [2, '####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: [2, '.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: [2, '####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: [2, '#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: [2, '#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: [2, '.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: [2, '#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: [2, '###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: [2, '..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: [2, '#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: [2, '#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: [2, '#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: [2, '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: [2, '.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: [2, '####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: [2, '.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: [2, '####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: [2, '.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: [2, '#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: [2, '#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: [2, '#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: [2, '#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: [2, '#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: [2, '#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: [2, '#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  // ---------- Minúsculas ----------
  a: [4, '.###.', '....#', '.####', '#...#', '.####'],
  b: [2, '#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: [4, '.###', '#...', '#...', '#...', '.###'],
  d: [2, '....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: [4, '.###.', '#...#', '#####', '#....', '.###.'],
  f: [2, '..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'],
  g: [4, '.####', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  h: [2, '#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: [2, '#', '.', '#', '#', '#', '#', '#'],
  j: [2, '..#', '...', '..#', '..#', '..#', '..#', '..#', '..#', '##.'],
  k: [2, '#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: [2, '#.', '#.', '#.', '#.', '#.', '#.', '.#'],
  m: [4, '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: [4, '####.', '#...#', '#...#', '#...#', '#...#'],
  o: [4, '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: [4, '####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  q: [4, '.####', '#...#', '#...#', '.####', '....#', '....#', '....#'],
  r: [4, '#.##', '##..', '#...', '#...', '#...'],
  s: [4, '.####', '#....', '.###.', '....#', '####.'],
  t: [2, '.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'],
  u: [4, '#...#', '#...#', '#...#', '#...#', '.####'],
  v: [4, '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: [4, '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  x: [4, '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: [4, '#...#', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  z: [4, '#####', '...#.', '..#..', '.#...', '#####'],
  'ı': [4, '#', '#', '#', '#', '#'], // i sin punto: base de la í
  // ---------- Dígitos ----------
  0: [2, '.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: [2, '.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: [2, '.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: [2, '####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: [2, '...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: [2, '#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: [2, '.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: [2, '#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: [2, '.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: [2, '.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  // ---------- Puntuación ----------
  '.': [8, '#'],
  ',': [8, '.#', '#.'],
  ':': [4, '#', '.', '.', '.', '#'],
  ';': [4, '.#', '..', '..', '.#', '#.'],
  '!': [2, '#', '#', '#', '#', '#', '.', '#'],
  '¡': [4, '#', '.', '#', '#', '#', '#', '#'],
  '?': [2, '.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '¿': [4, '..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
  '-': [5, '###'],
  '–': [5, '####'],
  '+': [4, '.#.', '###', '.#.'],
  '=': [4, '###', '...', '###'],
  '/': [2, '....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': [2, '.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': [2, '#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  "'": [2, '#', '#'],
  '·': [5, '#'],
  '%': [3, '#...#', '...#.', '..#..', '.#...', '#...#'],
  'ª': [2, '.##', '#.#', '.##', '...', '###'],
  'º': [2, '.#.', '#.#', '.#.', '...', '###'],
  // ---------- Música ----------
  '♭': [2, '#...', '#...', '#...', '###.', '#..#', '#.#.', '##..'],
  '♯': [2, '.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '𝄪': [3, '##.##', '##.##', '..#..', '##.##', '##.##'],
};
/* eslint-enable */

const ACCENTS = {
  acute: ['.#', '#.'],
  tilde: ['.##.#', '#.##.'],
  diaeresis: ['#.#'],
};

const COMPOSED = {
  'Á': ['A', 'acute'], 'É': ['E', 'acute'], 'Í': ['I', 'acute'], 'Ó': ['O', 'acute'], 'Ú': ['U', 'acute'],
  'á': ['a', 'acute'], 'é': ['e', 'acute'], 'í': ['ı', 'acute'], 'ó': ['o', 'acute'], 'ú': ['u', 'acute'],
  'Ñ': ['N', 'tilde'], 'ñ': ['n', 'tilde'], 'Ü': ['U', 'diaeresis'], 'ü': ['u', 'diaeresis'],
};

/* ---------------- Construcción de glifos (una sola vez, al cargar) ---------------- */

/** Glifo: { w, bits } con bits = Uint8Array(w * CELL_H), 1 = píxel encendido. */
function makeGlyph(y, rows) {
  const w = Math.max(...rows.map((r) => r.length));
  const bits = new Uint8Array(w * CELL_H);
  rows.forEach((row, ry) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') bits[(y + ry) * w + x] = 1;
  });
  return { w, bits, top: y };
}

/** Pone un acento sobre una base, centrado, dejando 1 fila de aire si cabe. */
function compose(base, accentRows) {
  const aw = accentRows[0].length;
  const w = Math.max(base.w, aw);
  const bx = Math.floor((w - base.w) / 2);
  const ax = Math.floor((w - aw) / 2);
  const ay = Math.max(0, base.top - accentRows.length - 1);
  const bits = new Uint8Array(w * CELL_H);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < base.w; x++) bits[y * w + x + bx] = base.bits[y * base.w + x];
  }
  accentRows.forEach((row, ry) => {
    for (let x = 0; x < aw; x++) if (row[x] === '#') bits[(ay + ry) * w + x + ax] = 1;
  });
  return { w, bits, top: ay };
}

/** Pega dos glifos lado a lado (para 𝄫 = ♭♭). */
function joinGlyphs(a, b) {
  const w = a.w + b.w;
  const bits = new Uint8Array(w * CELL_H);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < a.w; x++) bits[y * w + x] = a.bits[y * a.w + x];
    for (let x = 0; x < b.w; x++) bits[y * w + a.w + x] = b.bits[y * b.w + x];
  }
  return { w, bits, top: Math.min(a.top, b.top) };
}

const glyphs = new Map(); // code point → glifo
for (const [ch, [y, ...rows]] of Object.entries(GLYPHS)) glyphs.set(ch.codePointAt(0), makeGlyph(y, rows));
for (const [ch, [base, accent]] of Object.entries(COMPOSED)) {
  glyphs.set(ch.codePointAt(0), compose(glyphs.get(base.codePointAt(0)), ACCENTS[accent]));
}
const flat = glyphs.get('♭'.codePointAt(0));
glyphs.set('𝄫'.codePointAt(0), joinGlyphs(flat, flat));

const FALLBACK = glyphs.get('?'.codePointAt(0));

export function getGlyph(codePoint) {
  return glyphs.get(codePoint) || FALLBACK;
}

export function hasGlyph(ch) {
  return glyphs.has(ch.codePointAt(0));
}

/** Caracteres del texto que la fuente no tiene (para las pruebas). */
export function missingChars(text) {
  return [...new Set([...text].filter((ch) => !hasGlyph(ch)))];
}

/** Ancho en píxeles lógicos de un texto a cierta escala. */
export function measure(text, scale = 1) {
  let w = 0;
  let n = 0;
  for (const ch of text) {
    w += getGlyph(ch.codePointAt(0)).w;
    n++;
  }
  return n ? (w + (n - 1) * SPACING) * scale : 0;
}

/* ---------------- Pintado ---------------- */

/**
 * Pinta el texto en un canvas nuevo y lo devuelve.
 * - color / outline: índices de la paleta (outline opcional: contorno de 1 px lógico)
 * - scale: entero; cada píxel de la fuente se vuelve un bloque scale×scale
 * Con contorno, el canvas tiene 1 px extra por lado.
 * Llamar en respuesta a eventos (crea objetos), no dentro del bucle.
 */
export function renderText(text, { color, outline = -1, scale = 1 }) {
  const pad = outline >= 0 ? 1 : 0;
  const w = Math.max(1, measure(text, scale) + pad * 2);
  const h = CELL_H * scale + pad * 2;
  const mask = new Uint8Array(w * h); // 0 vacío, 1 texto, 2 contorno

  let penX = pad;
  for (const ch of text) {
    const g = getGlyph(ch.codePointAt(0));
    for (let gy = 0; gy < CELL_H; gy++) {
      for (let gx = 0; gx < g.w; gx++) {
        if (!g.bits[gy * g.w + gx]) continue;
        for (let sy = 0; sy < scale; sy++) {
          const row = (pad + gy * scale + sy) * w;
          for (let sx = 0; sx < scale; sx++) mask[row + penX + gx * scale + sx] = 1;
        }
      }
    }
    penX += (g.w + SPACING) * scale;
  }

  if (pad) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x]) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx] === 1) { near = true; break; }
          }
        }
        if (near) mask[y * w + x] = 2;
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const fill = RGB[color];
  const line = pad ? RGB[outline] : null;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const rgb = mask[i] === 1 ? fill : line;
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Sprites de caracteres sueltos, para dibujar texto que cambia cada fotograma sin crear
 * objetos (por ejemplo, el cronómetro). Devuelve un Map carácter → canvas.
 */
export function makeGlyphSprites(chars, options) {
  const map = new Map();
  for (const ch of chars) map.set(ch, renderText(ch, options));
  return map;
}
