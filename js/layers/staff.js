/*
 * Capa del pentagrama pixel art: pinta en un canvas LÓGICO lo que diagramó js/notation.js.
 *
 * Es una capa como las demás (draw(ctx)), así que sirve en dos lugares sin cambios:
 *   - hoy: en su propio canvas, debajo de la escena (js/staff.js);
 *   - más adelante: dentro de la escena (en el atril o en una pizarra), con
 *     scene.set(…, staffLayer) y su posición en `x`, `y`.
 *
 * set() calcula todo y lo guarda en arreglos planos; draw() solo los recorre
 * (cero asignaciones dentro del bucle).
 */
import { PAL, C } from '../engine/palette.js';
import { renderText, measure } from '../engine/font.js';
import { GLYPHS } from '../engine/music-glyphs.js';
import { layoutStaff } from '../notation.js';

const MAX_RECTS = 1024;

export class StaffLayer {
  /**
   * @param x, y    posición de la caja del pentagrama en el canvas lógico
   * @param paper   color del fondo (−1: sin fondo; el hueco de las redondas usa este color)
   * @param line    color de las líneas y líneas adicionales (el más apagado)
   * @param clef    color de la clave (distinto de las líneas para que se lea sobre ellas)
   * @param ink     color de las notas (el de más contraste)
   */
  constructor({ x = 0, y = 0, paper = C.STONE_0, line = C.IVORY_0, clef = C.IVORY_1, ink = C.IVORY_2 } = {}) {
    this.x = x;
    this.y = y;
    this.paper = paper;
    this.line = line;
    this.clefColor = clef;
    this.ink = ink;
    this.visible = true;
    this.width = 0;
    this.height = 0;
    // [x, y, w, h, color] por rectángulo, relativos a la caja.
    this.rects = new Int16Array(MAX_RECTS * 5);
    this.count = 0;
    this.texts = []; // [{ canvas, x, y }]
  }

  /** Mismas opciones que layoutStaff(): { notes, mode, clef, labels, colors }. */
  set(options) {
    const layout = layoutStaff(options);
    const { colors } = layout;
    const colorOf = (index) => (colors[index] != null ? colors[index] : this.ink);
    this.width = layout.width;
    this.height = layout.height;
    this.count = 0;
    this.texts = [];

    for (const y of layout.lines) this.rect(0, y, layout.width, 1, this.line);
    for (const l of layout.ledgers) this.rect(l.x, l.y, l.w, 1, this.line);
    this.glyph(layout.clef.glyph, layout.clef.x, layout.clef.y, this.clefColor);
    for (const a of layout.accidentals) this.glyph(a.glyph, a.x, a.y, colorOf(a.index));
    for (const h of layout.heads) this.glyph(GLYPHS.head, h.x, h.y, colorOf(h.index));
    for (const l of layout.labels) {
      const color = colorOf(l.index);
      this.texts.push({ canvas: renderText(l.text, { color }), x: l.cx - (measure(l.text) >> 1), y: l.y });
    }
    return this;
  }

  rect(x, y, w, h, color) {
    if (this.count >= MAX_RECTS) return;
    const i = this.count++ * 5;
    this.rects[i] = x;
    this.rects[i + 1] = y;
    this.rects[i + 2] = w;
    this.rects[i + 3] = h;
    this.rects[i + 4] = color;
  }

  glyph(g, x, y, color) {
    const { runs } = g;
    for (let i = 0; i < runs.length; i += 4) {
      const kind = runs[i + 3];
      // El hueco ('o') toma el color del papel: tapa la línea que cruza la redonda.
      const c = kind === 2 ? this.paper : color;
      if (c < 0) continue;
      this.rect(x + runs[i], y + runs[i + 1], runs[i + 2], 1, c);
    }
  }

  draw(ctx) {
    if (!this.visible || !this.width) return;
    const ox = this.x;
    const oy = this.y;
    if (this.paper >= 0) {
      ctx.fillStyle = PAL[this.paper];
      ctx.fillRect(ox, oy, this.width, this.height);
    }
    const r = this.rects;
    for (let i = 0, n = this.count * 5; i < n; i += 5) {
      ctx.fillStyle = PAL[r[i + 4]];
      ctx.fillRect(ox + r[i], oy + r[i + 1], r[i + 2], r[i + 3]);
    }
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      ctx.drawImage(t.canvas, ox + t.x, oy + t.y);
    }
  }
}
