/*
 * Sonido con Tone.js (cargado como script clásico desde el CDN, queda en la global `Tone`).
 *
 * - Los navegadores solo permiten iniciar audio tras un gesto del usuario (clic/tecla),
 *   por eso el instrumento se crea la primera vez que se pide un sonido.
 * - Instrumento: muestras reales de piano (Salamander Grand Piano, las que usa la
 *   documentación de Tone.js). Mientras descargan, suena un sintetizador simple.
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
  if (!instrument) createInstrument();
  return true;
}

const toNote = (midi) => Tone.Frequency(midi, 'midi').toNote();

export function playNote(midi, duration = 0.9) {
  if (muted || !ensureAudio()) return;
  instrument.triggerAttackRelease(toNote(midi), duration);
}

/** Toca un acorde rasgueado (de grave a agudo, con `strum` segundos entre notas). */
export function playChord(midis, { strum = 0.05, duration = 2 } = {}) {
  if (muted || !midis.length || !ensureAudio()) return;
  const now = Tone.now();
  [...midis].sort((a, b) => a - b).forEach((midi, i) => {
    instrument.triggerAttackRelease(toNote(midi), duration, now + i * strum);
  });
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  save('muted', muted);
  if (muted && instrument) instrument.releaseAll();
}
