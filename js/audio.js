/*
 * Sonido con Tone.js (cargado como script clásico desde el CDN, queda en la global `Tone`).
 *
 * - Instrumento: muestras reales de piano (Salamander Grand Piano, las que usa la
 *   documentación de Tone.js). Se empiezan a descargar APENAS carga la página: si se
 *   esperara al primer clic, los primeros segundos sonaría el sintetizador de respaldo
 *   (una onda triangular, "plana"). Descargar y decodificar no necesita permiso.
 * - Lo que sí exige un gesto del usuario (clic/tecla) es ENCENDER el audio: Tone.start()
 *   se llama en el primer sonido pedido.
 * - Si las muestras aún no llegan (conexión lenta), suena un sintetizador simple.
 * - Si Tone.js no cargó (sin internet), las funciones no hacen nada: la app funciona igual.
 */
import { load, save } from './storage.js';

const SAMPLES_URL = 'https://tonejs.github.io/audio/salamander/';

let instrument = null;
let muted = load('muted', false);

function sampleUrls() {
  // Una muestra cada 3 semitonos (C, D#, F#, A) de C2 a C6; Tone transpone el resto.
  const urls = {};
  for (let octave = 2; octave <= 5; octave++) {
    urls[`C${octave}`] = `C${octave}.mp3`;
    urls[`D#${octave}`] = `Ds${octave}.mp3`;
    urls[`F#${octave}`] = `Fs${octave}.mp3`;
    urls[`A${octave}`] = `A${octave}.mp3`;
  }
  urls.C6 = 'C6.mp3';
  return urls;
}

function createInstrument() {
  if (instrument || typeof Tone === 'undefined') return;
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.15, release: 1 },
  }).toDestination();
  synth.volume.value = -12;
  instrument = synth;

  const sampler = new Tone.Sampler({
    urls: sampleUrls(),
    baseUrl: SAMPLES_URL,
    release: 1,
    onload: () => { instrument = sampler; },
    onerror: () => { /* se queda el sintetizador */ },
  }).toDestination();
}

/** Prepara el audio. Llamar dentro de un gesto del usuario. Devuelve false si no hay audio. */
function ensureAudio() {
  if (typeof Tone === 'undefined') return false;
  if (Tone.getContext().state !== 'running') Tone.start();
  createInstrument();
  return true;
}

// Precarga al importar el módulo (ver comentario inicial).
try {
  createInstrument();
} catch {
  /* sin audio: la app funciona igual */
}

const toNote = (midi) => Tone.Frequency(midi, 'midi').toNote();

export function playNote(midi, duration = 0.9) {
  if (muted || !ensureAudio()) return;
  instrument.triggerAttackRelease(toNote(midi), duration);
}

/*
 * Notas a futuro (rasgueo, escalas, "A y luego B"): se programan con temporizadores
 * propios y no con el reloj de Tone, porque Tone no permite cancelar notas ya agendadas.
 * Así stopPlayback() puede borrar lo pendiente: si se aprieta "Escuchar" varias veces
 * seguidas, cada vez empieza de cero en vez de amontonar reproducciones que siguen
 * sonando después.
 */
const pending = new Set();

function later(seconds, midi, duration) {
  if (seconds <= 0) {
    instrument.triggerAttackRelease(toNote(midi), duration);
    return;
  }
  const id = setTimeout(() => {
    pending.delete(id);
    if (!muted) instrument.triggerAttackRelease(toNote(midi), duration);
  }, seconds * 1000);
  pending.add(id);
}

/** Cancela las notas programadas y apaga las que están sonando. */
export function stopPlayback() {
  for (const id of pending) clearTimeout(id);
  pending.clear();
  if (instrument) instrument.releaseAll();
}

/**
 * Toca un acorde rasgueado (de grave a agudo, con `strum` segundos entre notas).
 * `delay`: segundos de espera antes de empezar (para encadenar, p. ej. al comparar).
 */
export function playChord(midis, { strum = 0.05, duration = 2, delay = 0 } = {}) {
  if (muted || !midis.length || !ensureAudio()) return;
  [...midis].sort((a, b) => a - b).forEach((midi, i) => later(delay + i * strum, midi, duration));
}

/** Toca notas una tras otra, en el orden dado (una escala). Devuelve cuánto dura en segundos. */
export function playSequence(midis, { step = 0.3, duration = 0.6, delay = 0 } = {}) {
  if (muted || !midis.length || !ensureAudio()) return 0;
  midis.forEach((midi, i) => later(delay + i * step, midi, duration));
  return midis.length * step;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  save('muted', muted);
  if (muted) stopPlayback();
}
