/*
 * Pentagrama con VexFlow 4.2.5 (cargado como script clásico desde el CDN: global `Vex`).
 *
 * Va en un panel HTML aparte, NO en el canvas pixel art: es un SVG nítido que se escala
 * con la página (viewBox + width 100 %). Los colores salen de la misma paleta del juego.
 *
 * Recibe notas ESCRITAS de js/theory.js ({ name: 'Bb', octave: 3 }), porque la partitura
 * necesita la letra y la octava escrita, no solo el sonido.
 *
 *   const staff = new Staff(contenedor);
 *   staff.render({ notes, mode: 'chord' })        // acorde en bloque (redonda)
 *   staff.render({ notes, mode: 'sequence' })     // una nota tras otra (escala, melodía)
 *
 * Si VexFlow no cargó (sin internet), render() no dibuja nada y devuelve false.
 */
import { PAL, C } from './engine/palette.js';
import { displayDegree } from './theory.js';

/** Clave de una nota para VexFlow: solo letra y octava ('b/3'); la alteración va aparte. */
export function vexKey({ name, octave }) {
  return `${name[0].toLowerCase()}/${octave}`;
}

/** Alteración escrita para VexFlow ('#', '##', 'b', 'bb') o null si es natural. */
export function vexAccidental({ name }) {
  return name.slice(1) || null;
}

/** Clave sugerida: fa si el promedio de las notas está bajo el Do central. */
export function clefFor(pitches) {
  if (!pitches.length) return 'treble';
  const avg = pitches.reduce((sum, p) => sum + (p.midi ?? 0), 0) / pitches.length;
  return avg < 60 ? 'bass' : 'treble';
}

const STAVE_X = 10;
const STAVE_Y = 40; // deja espacio arriba para líneas adicionales
const HEIGHT = 190; // y abajo para líneas adicionales y etiquetas de grado
const CHORD_WIDTH = 170;
const NOTE_WIDTH = 42; // por nota, en modo secuencia
const CLEF_WIDTH = 70;

export class Staff {
  constructor(container) {
    this.container = container;
  }

  /**
   * @param notes   notas escritas [{ name, octave, degree? }]
   * @param mode    'chord' (bloque) o 'sequence' (una tras otra)
   * @param clef    'treble' | 'bass' (por defecto, según la altura media)
   * @param labels  true: escribe el grado bajo cada nota (solo en 'sequence')
   * @param colors  índice de nota → índice de la paleta, para resaltar (p. ej. la tónica)
   * @returns true si dibujó
   */
  render({ notes, mode = 'chord', clef = clefFor(notes), labels = false, colors = {} }) {
    this.container.textContent = '';
    if (typeof Vex === 'undefined' || !notes.length) return false;
    const VF = Vex.Flow;

    const base = PAL[C.IVORY_1];
    const style = (i) => {
      const color = colors[i] != null ? PAL[colors[i]] : base;
      return { fillStyle: color, strokeStyle: color };
    };

    const width = mode === 'chord' ? CHORD_WIDTH : CLEF_WIDTH + NOTE_WIDTH * notes.length;
    const renderer = new VF.Renderer(this.container, VF.Renderer.Backends.SVG);
    renderer.resize(width, HEIGHT);
    const ctx = renderer.getContext();
    ctx.setFillStyle(base);
    ctx.setStrokeStyle(base);

    const stave = new VF.Stave(STAVE_X, STAVE_Y, width - STAVE_X * 2);
    stave.addClef(clef);
    stave.setStyle({ fillStyle: base, strokeStyle: base });
    stave.setContext(ctx).draw();

    let staveNotes;
    if (mode === 'chord') {
      // VexFlow ordena las claves de grave a agudo: se ordenan antes para que los
      // índices de alteraciones y colores coincidan.
      const sorted = notes.map((p, i) => ({ p, i })).sort((a, b) => (a.p.midi ?? 0) - (b.p.midi ?? 0));
      const note = new VF.StaveNote({ keys: sorted.map(({ p }) => vexKey(p)), duration: 'w', clef });
      note.setStyle(style(-1));
      note.setLedgerLineStyle({ fillStyle: base, strokeStyle: base });
      sorted.forEach(({ p, i }, k) => {
        const acc = vexAccidental(p);
        if (acc) note.addModifier(new VF.Accidental(acc).setStyle(style(i)), k);
        note.setKeyStyle(k, style(i));
      });
      staveNotes = [note];
    } else {
      // Una alteración vale para toda la línea/espacio hasta el final del compás: si después
      // vuelve la misma letra natural (E♭3 … E3) hace falta un becuadro.
      const altered = new Map(); // 'e/3' → alteración vigente
      staveNotes = notes.map((p, i) => {
        const key = vexKey(p);
        const note = new VF.StaveNote({ keys: [key], duration: 'q', clef });
        note.setStyle(style(i));
        note.setLedgerLineStyle({ fillStyle: base, strokeStyle: base });
        let acc = vexAccidental(p);
        if (acc) altered.set(key, acc);
        else if (altered.has(key)) {
          acc = 'n';
          altered.delete(key);
        }
        if (acc) note.addModifier(new VF.Accidental(acc).setStyle(style(i)), 0);
        if (labels && p.degree) {
          const text = new VF.Annotation(displayDegree(p.degree))
            .setFont('Tiny5', 13)
            .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
          text.setStyle(style(i));
          note.addModifier(text, 0);
        }
        return note;
      });
    }

    VF.Formatter.FormatAndDraw(ctx, stave, staveNotes);

    // Escalable: el SVG ocupa el ancho del panel y conserva la proporción.
    const svg = this.container.querySelector('svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.maxWidth = `${width * 1.6}px`;
    svg.style.height = 'auto';
    return true;
  }
}
