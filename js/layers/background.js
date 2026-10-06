/*
 * Capa 1: fondo. PLACEHOLDER: pared, zócalo y piso planos.
 *
 * El fondo definitivo (interior de un conservatorio de noche, detallado y de bajo
 * contraste, con elementos animados sutiles) reemplazará esta clase sin tocar nada más.
 * Regla: usar solo tonos medios/oscuros (piedra, madera oscura, azules nocturnos)
 * para no competir con el teclado ni con el nombre del acorde.
 * El piano tapa todo lo que está por debajo de y = 100.
 */
import { C, PAL } from '../engine/palette.js';
import { W, H } from '../engine/renderer.js';

export class BackgroundLayer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const g = this.canvas.getContext('2d');
    const rect = (c, x, y, w, h) => { g.fillStyle = PAL[c]; g.fillRect(x, y, w, h); };
    rect(C.STONE_0, 0, 0, W, 80); // pared
    rect(C.WOOD_1, 0, 80, W, 1); // moldura del zócalo
    rect(C.WOOD_0, 0, 81, W, 11); // zócalo
    rect(C.STONE_1, 0, 92, W, 8); // piso
  }

  draw(ctx) {
    ctx.drawImage(this.canvas, 0, 0);
  }
}
