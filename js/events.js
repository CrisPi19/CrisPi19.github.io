/*
 * Bus de eventos: el entrenador publica lo que pasa y quien quiera se suscribe
 * (capas del canvas, sonido, panel HTML y, más adelante, los perros).
 * Así la lógica del entrenador no necesita saber quién la escucha.
 *
 * Los envíos son síncronos: si un clic provoca un emit('note:on'), los oyentes
 * (por ejemplo el sonido) se ejecutan dentro del mismo evento del clic.
 */
export class EventBus {
  constructor() {
    this.handlers = new Map(); // tipo → array de funciones
  }

  /** Suscribe y devuelve una función para desuscribirse. */
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const list = this.handlers.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  }

  emit(type, detail) {
    const list = this.handlers.get(type);
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](detail);
  }
}
