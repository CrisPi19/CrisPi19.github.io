/*
 * Conversión de coordenadas de pantalla a coordenadas lógicas (320×180).
 *
 * Se usa el rectángulo real del canvas en la página, así funciona con cualquier escala,
 * devicePixelRatio o centrado. El resultado se escribe en `out` para no crear objetos.
 */
import { W, H } from './renderer.js';

/** Devuelve true si el punto cae dentro del canvas; deja en out.x/out.y la coordenada lógica. */
export function screenToLogical(clientX, clientY, rect, out) {
  const x = Math.floor(((clientX - rect.left) * W) / rect.width);
  const y = Math.floor(((clientY - rect.top) * H) / rect.height);
  out.x = x;
  out.y = y;
  return x >= 0 && y >= 0 && x < W && y < H;
}
