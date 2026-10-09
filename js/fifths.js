/*
 * Círculo de quintas, común a todos los módulos.
 *
 *   mountCircleOfFifths(contenedor)  agrega al encabezado un botón pequeño con una rosa
 *                                    cromática (sin texto) que abre y cierra la ventana.
 *
 * La ventana flota en el medio de la pantalla y NO pausa nada: no tiene fondo que
 * bloquee, el ejercicio y su cronómetro siguen, y el piano se puede seguir tocando.
 * Se cierra con la ×, con el mismo botón o con Esc (que entonces no llega al módulo:
 * no borra la selección).
 *
 * El círculo es pixel art (canvas lógico a escala entera, como la escena):
 *   - anillo de afuera: tonalidades mayores; anillo de adentro: sus relativas menores;
 *   - afuera, la armadura de cada mayor en un pentagrama chiquito (clave de sol);
 *   - tocar una nota la hace sonar desde el Do central (C4–B4).
 *
 * Colores: EXCEPCIÓN a la paleta fija, a propósito. Un círculo de quintas se reconoce por
 * su rueda de colores (cada quinta, un tono vecino del arcoíris), y la paleta de 32 no
 * tiene 12 tonos así. Los 12 tonos (y sus versiones oscuras para las menores) viven solo
 * aquí y solo se usan en esta ventana y en su ícono; lo demás (texto, papel, líneas) sale
 * de la paleta.
 */
import { C, PAL, RGB } from './engine/palette.js';
import { renderText, measure, CAP_TOP } from './engine/font.js';
import { GLYPHS } from './engine/music-glyphs.js';
import { displayNote, notePc } from './theory.js';
import { playNote } from './audio.js';

/** Tonalidades en el orden del círculo (en el sentido del reloj desde arriba). sig > 0: ♯; < 0: ♭. */
export const CIRCLE = [
  { major: 'C', minor: 'A', sig: 0, hue: '#e8463f' },
  { major: 'G', minor: 'E', sig: 1, hue: '#ff8a2f' },
  { major: 'D', minor: 'B', sig: 2, hue: '#ffc23f' },
  { major: 'A', minor: 'F#', sig: 3, hue: '#efe04a' },
  { major: 'E', minor: 'C#', sig: 4, hue: '#9fd94a' },
  { major: 'B', minor: 'G#', sig: 5, hue: '#43c463' },
  { major: 'F#', minor: 'D#', sig: 6, alt: { major: 'Gb', minor: 'Eb', sig: -6 }, hue: '#2fbf9a' },
  { major: 'Db', minor: 'Bb', sig: -5, hue: '#4fc8e3' },
  { major: 'Ab', minor: 'F', sig: -4, hue: '#4f86e3' },
  { major: 'Eb', minor: 'C', sig: -3, hue: '#6a5fd9' },
  { major: 'Bb', minor: 'G', sig: -2, hue: '#9a55d0' },
  { major: 'F', minor: 'D', sig: -1, hue: '#d9509e' },
];

/** Orden de las alteraciones de una armadura en clave de sol (letra + octava escrita). */
const SHARPS = [['F', 5], ['C', 5], ['G', 5], ['D', 5], ['A', 4], ['E', 5], ['B', 4]];
const FLATS = [['B', 4], ['E', 5], ['A', 4], ['D', 5], ['G', 4], ['C', 5], ['F', 4]];

/* ---------------- Geometría (píxeles lógicos) ---------------- */

const W = 272;
const H = 276;
const CX = 136;
const CY = 122;
const R_HOLE = 26;
const R_MID = 54; // borde entre menores (adentro) y mayores (afuera)
const R_OUT = 86;
const SIG_W = 42;
const SIG_H = 28;
const SIG_GAP = 4;
const SIG_LINE0 = 9; // y de la línea de arriba dentro de la cajita
const LINE_GAP = 4;
const MAX_SCALE = 2; // es una ventana de consulta: no tapa toda la pantalla

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const shade = (rgb, k) => rgb.map((v) => Math.round(v * k));
const mix = (rgb, to, k) => rgb.map((v, i) => Math.round(v + (to[i] - v) * k));

/** Ángulo (radianes, en el sentido del reloj desde arriba) del centro del sector i. */
const angleOf = (i) => (i * Math.PI) / 6;

/** Sector (0–11) de un punto, o -1 si está fuera del círculo; ring: 0 hueco, 1 menores, 2 mayores. */
function locate(x, y) {
  const dx = x - CX;
  const dy = y - CY;
  const r = Math.hypot(dx, dy);
  if (r >= R_OUT) return { ring: -1, seg: -1 };
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += Math.PI * 2;
  const seg = Math.floor((a + Math.PI / 12) / (Math.PI / 6)) % 12;
  const ring = r < R_HOLE ? 0 : r < R_MID ? 1 : 2;
  return { ring, seg };
}

/** Cajitas de las armaduras: afuera del círculo, frente a su sector (abajo, F♯ y G♭ una sobre otra). */
function signatureBoxes() {
  const boxes = [];
  CIRCLE.forEach((key, i) => {
    const a = angleOf(i);
    const s = Math.abs(Math.sin(a));
    const c = Math.abs(Math.cos(a));
    const rho = R_OUT + SIG_GAP + c * (SIG_H / 2) + s * (SIG_W / 2);
    const x = Math.round(CX + rho * Math.sin(a) - SIG_W / 2);
    const y = Math.round(CY - rho * Math.cos(a) - SIG_H / 2);
    boxes.push({ x, y, seg: i, sig: key.sig });
    if (key.alt) boxes.push({ x, y: y + SIG_H + 2, seg: i, sig: key.alt.sig });
  });
  return boxes;
}

/* ---------------- Dibujo ---------------- */

/**
 * Pinta la rueda en `g` (tamaño lógico), con el sector `lit` (o -1) iluminado.
 * Bordes de 1 px `ink` entre sectores y anillos: se marcan los píxeles cuyo vecino de la
 * derecha o de abajo cae en otra zona (así el borde es nítido, sin antialiasing).
 */
function drawWheel(g, lit = { ring: -1, seg: -1 }) {
  const img = g.createImageData(W, H);
  const zone = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const { ring, seg } = locate(x + 0.5, y + 0.5);
      if (ring >= 0) zone[y * W + x] = ring === 0 ? 0 : ring * 12 + seg;
    }
  }
  const ink = RGB[C.INK];
  const hole = RGB[C.STONE_1];
  const white = RGB[C.FX_WHITE];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const z = zone[y * W + x];
      if (z < 0) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => {
        const nx = x + ox;
        const ny = y + oy;
        const nz = nx < 0 || ny < 0 || nx >= W || ny >= H ? -1 : zone[ny * W + nx];
        return nz !== z && (nz < 0 || ox > 0 || oy > 0);
      });
      let rgb;
      if (edge) rgb = ink;
      else if (z === 0) rgb = hole;
      else {
        const ring = Math.floor(z / 12);
        const seg = z % 12;
        const base = hexRgb(CIRCLE[seg].hue);
        rgb = ring === 1 ? shade(base, 0.62) : base;
        if (ring === lit.ring && seg === lit.seg) rgb = mix(rgb, white, 0.55);
      }
      const i = (y * W + x) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

/** Texto centrado en (cx, cy): la fila central de las mayúsculas cae en cy. */
function drawText(g, text, cx, cy, color) {
  const sprite = renderText(text, { color });
  g.drawImage(sprite, Math.round(cx - measure(text) / 2), Math.round(cy - 3 - CAP_TOP));
}

function drawLabels(g) {
  CIRCLE.forEach((key, i) => {
    const a = angleOf(i);
    const at = (r) => [CX + r * Math.sin(a), CY - r * Math.cos(a)];
    const [mx, my] = at((R_MID + R_OUT) / 2);
    const [nx, ny] = at((R_HOLE + R_MID) / 2);
    const minor = (n) => `${displayNote(n)}m`;
    if (key.alt) {
      drawText(g, displayNote(key.major), mx, my - 6, C.INK);
      drawText(g, displayNote(key.alt.major), mx, my + 6, C.INK);
      drawText(g, minor(key.minor), nx, ny - 6, C.IVORY_2);
      drawText(g, minor(key.alt.minor), nx, ny + 6, C.IVORY_2);
    } else {
      drawText(g, displayNote(key.major), mx, my, C.INK);
      drawText(g, minor(key.minor), nx, ny, C.IVORY_2);
    }
  });
}

/** Pentagrama chiquito con la armadura: papel y líneas como la pizarra, alteraciones en marfil. */
function drawSignature(g, { x, y, sig }) {
  const rect = (c, rx, ry, w, h) => { g.fillStyle = PAL[c]; g.fillRect(rx, ry, w, h); };
  rect(C.INK, x, y, SIG_W, SIG_H);
  rect(C.STONE_0, x + 1, y + 1, SIG_W - 2, SIG_H - 2);
  for (let l = 0; l < 5; l++) rect(C.IVORY_0, x + 2, y + SIG_LINE0 + l * LINE_GAP, SIG_W - 4, 1);
  const n = Math.abs(sig);
  const glyph = sig > 0 ? GLYPHS.sharp : GLYPHS.flat;
  const list = sig > 0 ? SHARPS : FLATS;
  const step = glyph.w + 1;
  let gx = x + Math.round((SIG_W - (n * step - 1)) / 2);
  for (let k = 0; k < n; k++) {
    const [letter, octave] = list[k];
    // Pasos de letra desde la línea de arriba (F5): cada paso, 2 px hacia abajo.
    const steps = (5 * 7 + 3) - (octave * 7 + 'CDEFGAB'.indexOf(letter));
    const cy = y + SIG_LINE0 + steps * (LINE_GAP / 2);
    const { runs } = glyph;
    g.fillStyle = PAL[C.IVORY_2];
    for (let r = 0; r < runs.length; r += 4) g.fillRect(gx + runs[r], cy + runs[r + 1], runs[r + 2], 1);
    gx += step;
  }
}

function paint(g, lit) {
  g.clearRect(0, 0, W, H);
  drawWheel(g, lit);
  drawLabels(g);
  for (const box of signatureBoxes()) drawSignature(g, box);
}

/* ---------------- Ícono: rosa cromática sin texto ---------------- */

const ICON = 17;
const ICON_R = 8;

function paintIcon(g) {
  const img = g.createImageData(ICON, ICON);
  const c = ICON / 2;
  const ink = RGB[C.INK];
  for (let y = 0; y < ICON; y++) {
    for (let x = 0; x < ICON; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      if (r > ICON_R) continue;
      let a = Math.atan2(dx, -dy);
      if (a < 0) a += Math.PI * 2;
      const seg = Math.floor((a + Math.PI / 12) / (Math.PI / 6)) % 12;
      // Contorno y centro en tinta; el resto, el color de su quinta.
      const rgb = r > ICON_R - 1 || r < 1.5 ? ink : hexRgb(CIRCLE[seg].hue);
      const i = (y * ICON + x) * 4;
      img.data.set([...rgb, 255], i);
    }
  }
  g.putImageData(img, 0, 0);
}

/** Tamaño CSS para que cada píxel lógico ocupe N×N píxeles físicos (N entero). */
function pixelScale(canvas, w, h, scale) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${(w * scale) / dpr}px`;
  canvas.style.height = `${(h * scale) / dpr}px`;
}

/* ---------------- Montaje ---------------- */

export function mountCircleOfFifths(container) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-sm fifths-btn';
  button.setAttribute('aria-label', 'Círculo de quintas');
  button.setAttribute('aria-expanded', 'false');
  const icon = document.createElement('canvas');
  icon.width = ICON;
  icon.height = ICON;
  icon.className = 'pixel';
  paintIcon(icon.getContext('2d'));
  button.appendChild(icon);
  container.appendChild(button);

  const layer = document.createElement('div');
  layer.className = 'fifths-layer';
  layer.hidden = true;
  layer.innerHTML = `
    <section class="fifths-window panel" role="dialog" aria-label="Círculo de quintas">
      <div class="fifths-head">
        <h2>Círculo de quintas</h2>
        <button class="btn btn-sm fifths-close" type="button" aria-label="Cerrar">×</button>
      </div>
      <canvas class="pixel fifths-canvas" width="${W}" height="${H}"></canvas>
      <p class="small muted">Afuera las mayores con su armadura; adentro, sus relativas menores.
        Toca una nota para oírla (desde el Do central). El ejercicio sigue corriendo.</p>
    </section>`;
  document.body.appendChild(layer);
  const canvas = layer.querySelector('canvas');
  const g = canvas.getContext('2d');
  paint(g);

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    pixelScale(icon, ICON, ICON, Math.max(1, Math.floor(2 * dpr)));
    if (layer.hidden) return;
    const availW = Math.max(W, (window.innerWidth - 40) * dpr);
    const availH = Math.max(H, (window.innerHeight - 140) * dpr);
    const scale = Math.max(1, Math.min(MAX_SCALE, Math.floor(Math.min(availW / W, availH / H))));
    pixelScale(canvas, W, H, scale);
  }

  function setOpen(open) {
    layer.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    fit();
  }

  button.addEventListener('click', (event) => {
    setOpen(layer.hidden);
    if (event.detail > 0) button.blur(); // Enter/Espacio siguen yendo a los atajos del módulo
  });
  layer.querySelector('.fifths-close').addEventListener('click', () => setOpen(false));
  window.addEventListener('resize', fit);
  // En captura: Esc cierra la ventana y no llega a los atajos del módulo.
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || layer.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setOpen(false);
  }, true);

  const boxes = signatureBoxes();
  let unlit = null;
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * W) / rect.width;
    const y = ((event.clientY - rect.top) * H) / rect.height;
    let { ring, seg } = locate(x, y);
    if (ring < 1) {
      const box = boxes.find((b) => x >= b.x && x < b.x + SIG_W && y >= b.y && y < b.y + SIG_H);
      if (!box) return;
      ring = 2;
      seg = box.seg;
    }
    // Abajo hay dos nombres (F♯/G♭, D♯m/E♭m), pero suenan igual: basta con el primero.
    const key = CIRCLE[seg];
    const note = ring === 2 ? key.major : key.minor;
    playNote(60 + notePc(note));
    paint(g, { ring, seg });
    clearTimeout(unlit);
    unlit = setTimeout(() => paint(g), 220);
  });

  fit();
  return { open: () => setOpen(true), close: () => setOpen(false) };
}
