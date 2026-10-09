/*
 * Íconos pixel art para botones HTML (sin texto), definidos en código como los glifos.
 *
 *   mountIcon(button, 'names' | 'ear')  pone el ícono dentro del botón
 *
 * Formato de cada fila: '#' tinta, 'x' marfil claro, '+' marfil oscuro (sombra),
 * '.' transparente. Los colores salen de la paleta. Se dibujan a escala ENTERA en
 * píxeles físicos (×2), igual que la escena: nítidos en cualquier pantalla.
 */
import { C, RGB } from './engine/palette.js';

/* eslint-disable */
const ICONS = {
  // La C de la fuente bitmap (brazos rectos, abierta), al doble y con sombra de tinta.
  names: [
    '..xxxxxxxx..',
    '..xxxxxxxx#.',
    'xx#########.',
    'xx#.........',
    'xx#.........',
    'xx#.........',
    'xx#.........',
    'xx#.........',
    'xx#.........',
    'xx#.........',
    'xx#.........',
    'xx#.........',
    '..xxxxxxxx..',
    '..xxxxxxxx#.',
    '...#########',
  ],
  // Oreja vista de lado: borde (hélice) arriba y a la derecha, lóbulo abajo, curva interior en sombra.
  ear: [
    '...######...',
    '..#xxxxxx#..',
    '.#xx++++xx#.',
    '#xx+xxxx+xx#',
    '#x+xxxxxx+x#',
    '#x+xx++xx+x#',
    '#x+x+xx+x+x#',
    '#xxx+xx+x+x#',
    '.#xxxxx+x+x#',
    '..#xxx+xx+x#',
    '...#xxxxx+#.',
    '...#xxxx+x#.',
    '...#xx++x#..',
    '....#xxx#...',
    '.....###....',
  ],
};
/* eslint-enable */

const COLORS = { '#': C.INK, x: C.IVORY_2, '+': C.IVORY_0 };
const SCALE = 2;

function paint(canvas, rows) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = COLORS[ch];
      if (c == null) return;
      img.data.set([...RGB[c], 255], (y * w + x) * 4);
    });
  });
  g.putImageData(img, 0, 0);
}

/** Cada píxel del ícono ocupa N×N píxeles físicos (N entero ≈ ×2 a 100 %). */
function fit(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const n = Math.max(1, Math.round(SCALE * dpr));
  canvas.style.width = `${(canvas.width * n) / dpr}px`;
  canvas.style.height = `${(canvas.height * n) / dpr}px`;
}

const mounted = [];
window.addEventListener('resize', () => mounted.forEach(fit));

export function mountIcon(button, name) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel';
  canvas.setAttribute('aria-hidden', 'true');
  paint(canvas, ICONS[name]);
  fit(canvas);
  mounted.push(canvas);
  button.replaceChildren(canvas);
  return canvas;
}
