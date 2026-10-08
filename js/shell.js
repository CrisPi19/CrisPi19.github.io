/*
 * Armazón común de los módulos con piano: lo que todos repiten y no es lógica de ejercicio.
 *
 *   createStage()     canvas 320×180 escalado, capas, clic → nota o flecha, bucle y pausa
 *   bindShortcuts()   atajos de teclado (P siempre; el resto se bloquea en pausa)
 *   onButton()        botón que suelta el foco tras un clic (para que Enter/Espacio sigan
 *                     yendo a los atajos)
 *   bindSoundToggle() botón "Sonido: sí/no"
 *
 * Cada módulo pone su propia capa de interfaz (scene.set('ui', …)) y decide qué hacer con
 * cada nota en `onNote` (normalmente, llamar al noteOn de su ejercicio).
 */
import { isMuted, setMuted } from './audio.js';
import { Renderer } from './engine/renderer.js';
import { Scene } from './engine/scene.js';
import { startLoop } from './engine/loop.js';
import { screenToLogical } from './engine/input.js';
import { PauseOverlay } from './engine/pause.js';
import { BackgroundLayer } from './layers/background.js';
import { CharactersLayer } from './layers/characters.js';
import { PianoLayer, hitTest } from './layers/piano.js';
import { EffectsLayer } from './layers/effects.js';

/**
 * @param canvas    canvas visible
 * @param stage     contenedor del canvas (da el ancho disponible)
 * @param reserved  función → px de alto que ocupan los demás elementos de la página
 * @param isPaused  función → ¿está en pausa? (congela escena, clics y flechas)
 * @param onNote    función (midi) al tocar una tecla en pantalla
 * @param onRangeChange  función (opcional) tras cambiar de ventana, con flecha o con ← →
 */
export function createStage({ canvas, stage, reserved, isPaused, onNote, onRangeChange = () => {} }) {
  const renderer = new Renderer(canvas);
  const scene = new Scene();
  const piano = new PianoLayer();
  scene.set('background', new BackgroundLayer());
  scene.set('characters', new CharactersLayer());
  scene.set('piano', piano);
  scene.set('effects', new EffectsLayer());
  const pauseOverlay = new PauseOverlay();

  function shiftRange(dir) {
    if (isPaused() || !piano.shiftRange(dir)) return false;
    onRangeChange();
    return true;
  }

  const point = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (event) => {
    if (isPaused()) return;
    if (!screenToLogical(event.clientX, event.clientY, canvas.getBoundingClientRect(), point)) return;
    const dir = piano.arrowAt(point.x, point.y);
    if (dir) {
      event.preventDefault();
      shiftRange(dir);
      return;
    }
    const midi = hitTest(piano.keys, point.x, point.y);
    if (midi === -1) return;
    event.preventDefault();
    onNote(midi);
  });

  function fit() {
    // clientWidth incluye el padding: restarlo para que el canvas no se salga por los lados
    // (las flechas de ventana están justo en los bordes).
    const style = getComputedStyle(stage);
    const width = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    renderer.resize(width, Math.max(180, window.innerHeight - reserved()));
  }
  window.addEventListener('resize', fit);
  fit();

  function start() {
    startLoop((dt) => {
      if (!isPaused()) scene.update(dt); // en pausa no avanza nada: el tiempo de la escena se congela
    }, () => {
      scene.draw(renderer.bctx);
      if (isPaused()) pauseOverlay.draw(renderer.bctx);
      renderer.present();
    });
  }

  return { renderer, scene, piano, fit, start, shiftRange };
}

/**
 * Atajos de teclado. `keys` es un objeto tecla → función (claves de KeyboardEvent.key;
 * para letras se aceptan mayúscula y minúscula). P y Pausa alternan la pausa siempre;
 * el resto no responde mientras está en pausa.
 * Solo actúan con el foco en la página o en el canvas (no en casillas ni botones enfocados).
 */
export function bindShortcuts({ canvas, isPaused, togglePause, keys }) {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target;
    if (target !== document.body && target !== canvas) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'p' || key === 'Pause') togglePause();
    else if (isPaused()) return; // en pausa solo responde el atajo de pausa
    else if (keys[key]) keys[key]();
    else return;
    event.preventDefault();
  });
}

export function onButton(button, action) {
  button.addEventListener('click', (event) => {
    action();
    // Tras un clic con mouse, soltar el foco para que Enter/Espacio vayan a los atajos.
    if (event.detail > 0) button.blur();
  });
}

export function bindSoundToggle(button) {
  function render() {
    const muted = isMuted();
    button.textContent = muted ? 'Sonido: no' : 'Sonido: sí';
    button.setAttribute('aria-pressed', String(!muted));
  }
  button.addEventListener('click', () => {
    setMuted(!isMuted());
    render();
  });
  render();
}
