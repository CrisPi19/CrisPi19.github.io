/*
 * Glifos musicales pixel art, definidos en código (como la fuente bitmap).
 *
 * Pensados para un pentagrama con líneas cada 4 px (3 px libres entre líneas):
 * una cabeza de redonda (3 px de alto) cabe justo en un espacio sin tocar las líneas.
 *
 * Formato: { ay, rows } con
 *   '#'  píxel del color de la nota/clave
 *   'o'  píxel del color del papel (el hueco de la redonda tapa la línea que la cruza;
 *        si se dejara transparente, una redonda sobre una línea se vería rellena)
 *   '.'  transparente
 * `ay` es la fila que se alinea con la altura de referencia: el centro de la nota para
 * cabezas y alteraciones, la línea de sol (2.ª desde abajo) para la clave de sol y la
 * línea de fa (2.ª desde arriba) para la clave de fa. Se dibujan desde su borde izquierdo.
 *
 * Sin DOM: la diagramación (js/notation.js) usa los anchos y altos, y se puede probar.
 */

/* eslint-disable */
const DEFS = {
  // Redonda: ancha y con los costados gruesos, como la de imprenta.
  head: { ay: 1, rows: [
    '.####.',
    '##oo##',
    '.####.',
  ] },

  treble: { ay: 16, rows: [
    '.....###...',
    '....#...#..',
    '....#...#..',
    '....#...#..',
    '....#..#...',
    '....#..#...',
    '....#.#....',
    '....##.....',
    '....#......',
    '...##......',
    '..#.#......',
    '.#..#......',
    '#...#......',
    '#...####...',
    '#...#...#..',
    '#...#....#.',
    '#...#....#.',
    '#...#....#.',
    '.#..#...#..',
    '..#.#..#...',
    '...###.....',
    '....#......',
    '....#......',
    '....#......',
    '.##.#......',
    '####.......',
    '.##........',
  ] },

  // Los dos puntos van centrados en los espacios de arriba y abajo de la línea de fa.
  bass: { ay: 4, rows: [
    '..####.....',
    '.#....#..##',
    '#......#.##',
    '##.....#...',
    '###....#...',
    '##.....#...',
    '.......#.##',
    '......#..##',
    '.....#.....',
    '....#......',
    '..##.......',
    '##.........',
  ] },

  sharp: { ay: 4, rows: [
    '.#.#.',
    '.#.#.',
    '#####',
    '.#.#.',
    '.#.#.',
    '.#.#.',
    '#####',
    '.#.#.',
    '.#.#.',
  ] },

  flat: { ay: 5, rows: [
    '#...',
    '#...',
    '#...',
    '#.#.',
    '##.#',
    '#..#',
    '#.#.',
    '##..',
  ] },

  natural: { ay: 4, rows: [
    '#..',
    '#..',
    '###',
    '#.#',
    '#.#',
    '#.#',
    '###',
    '..#',
    '..#',
  ] },

  doubleSharp: { ay: 2, rows: [
    '##.##',
    '##.##',
    '..#..',
    '##.##',
    '##.##',
  ] },
};
/* eslint-enable */

// Doble bemol: dos bemoles que comparten 1 columna de aire.
DEFS.doubleFlat = {
  ay: DEFS.flat.ay,
  rows: DEFS.flat.rows.map((r) => `${r}${r.slice(0, 3)}`),
};

/**
 * Glifo listo para dibujar: ancho, alto, ancla y `runs`, tramos horizontales del mismo
 * tipo [dx, dy, ancho, tipo] (tipo 1 = tinta, 2 = papel) relativos a (borde izq., ancla).
 * Dibujar por tramos en vez de píxel a píxel reduce las llamadas a fillRect.
 */
function compile({ ay, rows }) {
  const runs = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let end = x;
      while (end < row.length && row[end] === ch) end++;
      runs.push(x, y - ay, end - x, ch === 'o' ? 2 : 1);
      x = end;
    }
  });
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length, ay, runs };
}

export const GLYPHS = Object.freeze(
  Object.fromEntries(Object.entries(DEFS).map(([k, def]) => [k, compile(def)])),
);

/** Glifo de una alteración escrita ('#', '##', 'b', 'bb', 'n') o null. */
export function accidentalGlyph(acc) {
  return {
    '#': GLYPHS.sharp, '##': GLYPHS.doubleSharp, b: GLYPHS.flat, bb: GLYPHS.doubleFlat,
    n: GLYPHS.natural,
  }[acc] || null;
}
