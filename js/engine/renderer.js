/*
 * Renderer: canvas lógico fijo de 320×180 → canvas visible a escala ENTERA.
 *
 * Todo se dibuja en `buffer` (fuera de pantalla) en coordenadas enteras.
 * present() lo copia al canvas visible multiplicado por `scale`, sin suavizado.
 *
 * El factor se calcula en píxeles FÍSICOS: con Windows al 125 % (devicePixelRatio 1,25),
 * escalar ×3 en píxeles CSS daría 3,75 píxeles reales por píxel lógico (píxeles
 * desparejos). Calculando sobre píxeles físicos, cada píxel lógico ocupa exactamente
 * scale × scale píxeles de la pantalla.
 */
export const W = 320;
export const H = 180;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.buffer = document.createElement('canvas');
    this.buffer.width = W;
    this.buffer.height = H;
    this.bctx = this.buffer.getContext('2d');
    this.bctx.imageSmoothingEnabled = false;
    this.scale = 1;
  }

  /** Ajusta la escala al espacio disponible (en píxeles CSS). */
  resize(availWidth, availHeight) {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.floor(Math.min((availWidth * dpr) / W, (availHeight * dpr) / H)));
    this.scale = scale;
    this.canvas.width = W * scale;
    this.canvas.height = H * scale;
    this.canvas.style.width = `${(W * scale) / dpr}px`;
    this.canvas.style.height = `${(H * scale) / dpr}px`;
    // Cambiar el tamaño del canvas reinicia su contexto: hay que volver a desactivar el suavizado.
    this.ctx.imageSmoothingEnabled = false;
  }

  present() {
    this.ctx.drawImage(this.buffer, 0, 0, W * this.scale, H * this.scale);
  }
}
