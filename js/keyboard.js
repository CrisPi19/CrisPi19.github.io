/*
 * Teclado de piano en pantalla, reutilizable por todos los módulos.
 *
 * Uso:
 *   const kb = new PianoKeyboard(contenedor, { from: 48, to: 72 });
 *   kb.addEventListener('change', (e) => e.detail.notes);   // notas seleccionadas
 *   kb.addEventListener('noteon', (e) => e.detail.midi);    // tecla pulsada (para sonar)
 *
 * El teclado solo sabe de teclas y colores; no sabe nada de acordes. Las marcas de
 * corrección (correcta / sobra / falta) y las etiquetas las pone el módulo que lo usa.
 * Cuando llegue el MIDI, el teclado físico podrá fijar la selección con setSelected().
 */
import { isBlackKey, midiToName, displayNote } from './theory.js';

const BLACK_WIDTH = 0.62; // ancho de tecla negra relativo a la blanca

export class PianoKeyboard extends EventTarget {
  constructor(container, { from = 48, to = 72 } = {}) {
    super();
    this.from = from;
    this.to = to;
    this.selected = new Set();
    this.locked = false;
    this.keys = new Map(); // midi → <button>
    this.render(container);
  }

  render(container) {
    const whites = [];
    for (let m = this.from; m <= this.to; m++) if (!isBlackKey(m)) whites.push(m);
    const whiteWidth = 100 / whites.length;

    const scroller = document.createElement('div');
    scroller.className = 'piano';
    const keysEl = document.createElement('div');
    keysEl.className = 'piano-keys';
    keysEl.style.setProperty('--white-count', whites.length);
    keysEl.setAttribute('role', 'group');
    keysEl.setAttribute('aria-label', 'Teclado de piano');

    let whiteIndex = 0;
    for (let m = this.from; m <= this.to; m++) {
      const black = isBlackKey(m);
      const key = document.createElement('button');
      key.type = 'button';
      key.className = `key ${black ? 'key-black' : 'key-white'}`;
      key.dataset.midi = m;
      key.setAttribute('aria-label', displayNote(midiToName(m)));
      key.setAttribute('aria-pressed', 'false');

      const label = document.createElement('span');
      label.className = 'key-label';
      key.appendChild(label);

      if (black) {
        // Centrada sobre la frontera entre la blanca anterior y la siguiente.
        key.style.left = `${whiteIndex * whiteWidth - (whiteWidth * BLACK_WIDTH) / 2}%`;
      } else {
        // Las C llevan su octava como referencia (C3, C4…).
        if (m % 12 === 0) {
          const octave = document.createElement('span');
          octave.className = 'key-octave';
          octave.textContent = midiToName(m);
          key.appendChild(octave);
        }
        whiteIndex++;
      }
      this.keys.set(m, key);
      keysEl.appendChild(key);
    }
    this.keys.get(whites[whites.length - 1]).classList.add('is-last');

    keysEl.addEventListener('click', (event) => {
      const key = event.target.closest('.key');
      if (key) this.press(Number(key.dataset.midi));
    });

    scroller.appendChild(keysEl);
    container.appendChild(scroller);
    this.scroller = scroller;
  }

  /** Clic en una tecla: siempre emite noteon; si no está bloqueado, alterna la selección. */
  press(midi) {
    const key = this.keys.get(midi);
    key.classList.remove('is-struck');
    void key.offsetWidth; // reinicia la animación
    key.classList.add('is-struck');

    this.dispatchEvent(new CustomEvent('noteon', { detail: { midi, source: 'screen' } }));
    if (this.locked) return;
    if (this.selected.has(midi)) this.selected.delete(midi);
    else this.selected.add(midi);
    this.updateSelection();
  }

  getSelected() {
    return [...this.selected].sort((a, b) => a - b);
  }

  setSelected(notes) {
    this.selected = new Set(notes.filter((m) => this.keys.has(m)));
    this.updateSelection();
  }

  clearSelection() {
    this.setSelected([]);
  }

  updateSelection() {
    for (const [midi, key] of this.keys) {
      const on = this.selected.has(midi);
      key.classList.toggle('is-selected', on);
      key.setAttribute('aria-pressed', String(on));
    }
    this.dispatchEvent(new CustomEvent('change', { detail: { notes: this.getSelected() } }));
  }

  setLocked(locked) {
    this.locked = locked;
  }

  /** marks: Map midi → 'correct' | 'wrong' | 'missing'. labels: Map midi → texto. */
  setMarks(marks, labels = new Map()) {
    this.clearMarks();
    for (const [midi, mark] of marks) this.keys.get(midi)?.classList.add(`mark-${mark}`);
    for (const [midi, text] of labels) {
      const label = this.keys.get(midi)?.querySelector('.key-label');
      if (label) label.textContent = text;
    }
  }

  clearMarks() {
    for (const key of this.keys.values()) {
      key.classList.remove('mark-correct', 'mark-wrong', 'mark-missing');
      key.querySelector('.key-label').textContent = '';
    }
  }

  has(midi) {
    return this.keys.has(midi);
  }
}
