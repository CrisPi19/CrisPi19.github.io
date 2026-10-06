/*
 * Escena: lista ordenada de capas con nombre.
 *
 * Una capa es cualquier objeto con:
 *   update(dt, time)  → avanza su estado (opcional)
 *   draw(ctx, time)   → se dibuja en el canvas lógico (opcional)
 * Las capas no se conocen entre sí. Para cambiar una (por ejemplo, el fondo
 * definitivo) basta con scene.set('background', nuevaCapa).
 */
export const LAYER_ORDER = ['background', 'characters', 'piano', 'effects', 'ui'];

const EMPTY_LAYER = {};

export class Scene {
  constructor() {
    this.time = 0;
    this.layers = LAYER_ORDER.map(() => EMPTY_LAYER);
  }

  set(name, layer) {
    const i = LAYER_ORDER.indexOf(name);
    if (i === -1) throw new Error(`Capa desconocida: ${name}`);
    this.layers[i] = layer || EMPTY_LAYER;
  }

  get(name) {
    return this.layers[LAYER_ORDER.indexOf(name)];
  }

  update(dt) {
    this.time += dt;
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer.update) layer.update(dt, this.time);
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer.draw) layer.draw(ctx, this.time);
    }
  }
}
