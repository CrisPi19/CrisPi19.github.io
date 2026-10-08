/*
 * Capa 5 del Explorador: el nombre de lo que se explora, arriba del piano.
 *   - Acorde: tónica grande y cualidad en superíndice (igual que en el entrenador).
 *   - Escala: tónica y nombre de la escala.
 *   - Debajo, en tono discreto: el tipo (acordes) o las notas deletreadas (escalas).
 *   - Al comparar, una línea más con lo comparado, en el color de sus notas (cian).
 * Los sprites se crean en set() (en un evento), nunca dentro del bucle.
 */
import { C } from '../engine/palette.js';
import { renderText, measure, CAP_TOP } from '../engine/font.js';
import { W } from '../engine/renderer.js';
import { CHORD_TYPES, SCALE_TYPES, displayNote } from '../theory.js';

const NAME_CAP_Y = 16; // igual que en el entrenador de acordes
const SUB_Y = 43;
const COMPARE_Y = 56;
const MAX_W = W - 16;

const TITLE = { color: C.IVORY_2, outline: C.INK };

export class ExplorerUiLayer {
  constructor() {
    this.parts = []; // [{ sprite, x, y }]
  }

  /**
   * @param item     { kind, root, type }
   * @param notes    notas escritas del ítem (para deletrear las escalas)
   * @param compare  null o { name } de lo comparado
   * @param note     null o { note, color }: línea extra (p. ej. al ver solo lo comparado)
   */
  set(item, notes, compare = null, note = null) {
    const parts = [];
    const { kind, root, type } = item;

    if (kind === 'chord') {
      const symbol = CHORD_TYPES[type].symbol.replace('b', '♭');
      const rootSprite = renderText(displayNote(root), { ...TITLE, scale: 3 });
      const quality = symbol ? renderText(symbol, { ...TITLE, scale: 2 }) : null;
      const gap = 1;
      const total = rootSprite.width + (quality ? quality.width + gap : 0);
      const x = (W - total) >> 1;
      parts.push({ sprite: rootSprite, x, y: NAME_CAP_Y - 1 - CAP_TOP * 3 });
      if (quality) parts.push({ sprite: quality, x: x + rootSprite.width + gap, y: NAME_CAP_Y - 1 - CAP_TOP * 2 });
      this.centered(parts, CHORD_TYPES[type].name, C.IVORY_0, SUB_Y);
    } else {
      // Nombres largos ("Menor natural (eólico)") se achican para no salirse del canvas.
      const text = `${displayNote(root)} ${SCALE_TYPES[type].name}`;
      const scale = measure(text, 2) + 2 <= MAX_W ? 2 : 1;
      const sprite = renderText(text, { ...TITLE, scale });
      parts.push({ sprite, x: (W - sprite.width) >> 1, y: NAME_CAP_Y + 6 - 1 - CAP_TOP * scale });
      this.centered(parts, notes.map((n) => displayNote(n.name)).join(' '), C.IVORY_0, SUB_Y);
    }

    if (compare) this.centered(parts, `comparado con ${compare.name}`, C.FX_CYAN, COMPARE_Y);
    else if (note) this.centered(parts, note.note, note.color, COMPARE_Y);
    this.parts = parts;
  }

  centered(parts, text, color, capY) {
    const sprite = renderText(text, { color });
    parts.push({ sprite, x: (W - sprite.width) >> 1, y: capY - CAP_TOP });
  }

  draw(ctx) {
    const parts = this.parts;
    for (let i = 0; i < parts.length; i++) ctx.drawImage(parts[i].sprite, parts[i].x, parts[i].y);
  }
}
