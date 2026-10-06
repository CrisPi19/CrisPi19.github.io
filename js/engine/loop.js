/*
 * Bucle de juego con timestep fijo.
 *
 * - update(dt) se llama SIEMPRE con dt = 1/60 s, tantas veces como haga falta para
 *   alcanzar el tiempo real (así la lógica no depende de los fps de la pantalla).
 * - render() se llama una vez por requestAnimationFrame.
 * - Si la pestaña estuvo oculta, el tiempo acumulado se limita a MAX_STEPS pasos
 *   para no ejecutar cientos de updates seguidos al volver.
 *
 * Cero asignaciones: `frame` se crea una sola vez y se reutiliza en cada fotograma.
 */
export const STEP = 1 / 60;
const MAX_STEPS = 5;

export function startLoop(update, render) {
  let last = performance.now();
  let acc = 0;
  let running = true;

  function frame(now) {
    if (!running) return;
    acc += Math.min((now - last) / 1000, STEP * MAX_STEPS);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return { stop() { running = false; } };
}

/**
 * Cuantiza el tiempo para que una animación avance a `fps` cuadros por segundo
 * aunque el bucle vaya a 60: así se lee como animación de píxeles.
 */
export function quantize(time, fps) {
  return Math.floor(time * fps) / fps;
}
