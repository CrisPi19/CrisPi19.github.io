/*
 * Pentagrama pixel art en un panel HTML aparte, debajo de la escena.
 *
 * Dibuja con la misma capa que podría ir dentro de la escena (js/layers/staff.js) en un
 * canvas lógico pequeño y lo amplía por un factor ENTERO fijo: ×2 en píxeles físicos
 * (decisión de diseño; solo baja si el panel es demasiado angosto).
 *
 *   const staff = new Staff(contenedor);
 *   staff.render({ notes, mode: 'chord' })        // acorde en bloque (redondas)
 *   staff.render({ notes, mode: 'sequence' })     // una nota tras otra (escala)
 *
 * Recibe notas ESCRITAS de js/theory.js ({ name: 'Bb', octave: 3 }).
 */
import { StaffLayer } from './layers/staff.js';

export { clefFor } from './notation.js';

const SCALE = 2;

export class Staff {
  constructor(container, colors = {}) {
    this.container = container;
    this.layer = new StaffLayer(colors);
    this.buffer = document.createElement('canvas');
    this.bctx = this.buffer.getContext('2d');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'staff-canvas';
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);
    // Al cambiar el ancho del panel se recalcula el factor (ResizeObserver no está en todos
    // los navegadores viejos; sin él, basta con el tamaño inicial).
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.present()).observe(container);
  }

  /** Mismas opciones que layoutStaff(): { notes, mode, clef, labels, colors }. */
  render(options) {
    const { layer } = this;
    layer.set(options);
    this.buffer.width = layer.width;
    this.buffer.height = layer.height;
    layer.draw(this.bctx);
    this.present();
    return true;
  }

  present() {
    const { width, height } = this.layer;
    if (!width) return;
    const dpr = window.devicePixelRatio || 1;
    const style = getComputedStyle(this.container);
    const avail = this.container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const scale = Math.max(1, Math.min(SCALE, Math.floor((avail * dpr) / width)));
    if (this.canvas.width !== width * scale || this.canvas.height !== height * scale) {
      this.canvas.width = width * scale;
      this.canvas.height = height * scale;
      this.canvas.style.width = `${(width * scale) / dpr}px`;
      this.canvas.style.height = `${(height * scale) / dpr}px`;
    }
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.buffer, 0, 0, width * scale, height * scale);
  }
}
