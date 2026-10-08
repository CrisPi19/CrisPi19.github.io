/*
 * Módulo 4: Lectura (etapa 3: notas sueltas en clave de sol y de fa).
 *
 * Este archivo solo CONECTA piezas:
 *   reader (lógica, js/reading.js) ──eventos──► pizarra del canvas, teclas, sonido y paneles
 *   clic en el canvas ──► reader.noteOn(midi)   (lo mismo que hará el MIDI)
 * La primera tecla tocada es la respuesta (octava exacta). Al acertar se pasa sola a la
 * siguiente nota; al fallar se espera Enter para poder mirar el error.
 */
import { EventBus } from '../../js/events.js';
import {
  Reader, CLEFS, CLEF_NAMES, readingPitches, itemId, describeMiss, pitchText,
} from '../../js/reading.js';
import { displayNote } from '../../js/theory.js';
import { MAX_BOX } from '../../js/srs.js';
import { load, save } from '../../js/storage.js';
import { playNote, stopPlayback } from '../../js/audio.js';
import { createStage, bindShortcuts, onButton, bindSoundToggle } from '../../js/shell.js';
import { MARK } from '../../js/layers/piano.js';
import { ReadingUiLayer } from '../../js/layers/reading-ui.js';

/** Pausa tras un acierto antes de la nota siguiente (se alcanza a ver el verde). */
const AUTO_NEXT_MS = 700;
/** Ventana del teclado que se pone al elegir clave: donde caen casi todas sus notas. */
const HOME_RANGE = { treble: 60, bass: 36, both: 48 };

const $ = (id) => document.getElementById(id);
const els = {
  header: document.querySelector('.site-header'),
  stage: $('stage'),
  canvas: $('screen'),
  controls: $('controls'),
  accBtn: $('acc-btn'),
  namesBtn: $('names-btn'),
  listenBtn: $('listen-btn'),
  mainBtn: $('main-btn'),
  feedback: $('feedback'),
  soundToggle: $('sound-toggle'),
  score: $('stat-score'),
  streak: $('stat-streak'),
  avg: $('stat-avg'),
  legend: $('legend'),
  progressSummary: $('progress-summary'),
  progressMaps: $('progress-maps'),
  resetBtn: $('reset-btn'),
};

/* ---------------- Piezas ---------------- */

const bus = new EventBus();
const reader = new Reader({ bus });
const stage = createStage({
  canvas: els.canvas,
  stage: els.stage,
  reserved: () => els.header.offsetHeight + els.controls.offsetHeight + 40,
  isPaused: () => reader.paused,
  onNote: (midi) => reader.noteOn(midi, 'screen'),
  onRangeChange: updateHint,
});
const { piano, scene } = stage;
scene.set('ui', new ReadingUiLayer(bus, reader));

/* ---------------- Teclado ---------------- */

/**
 * La flecha brilla si la nota pedida no está en la ventana visible (hacia su lado).
 * Solo dice "cámbiate de ventana", no qué tecla es: leer la octava sigue siendo tarea tuya.
 */
function updateHint() {
  const midi = reader.current?.pitch.midi;
  piano.setArrowHint(midi < piano.from, midi > piano.to);
}

bus.on('exercise:new', () => {
  piano.clearMarks();
  updateHint();
});

function showAnswerOnKeys({ pitch, played, playedPitch }, correct) {
  const marks = new Map();
  const labels = new Map();
  if (!correct) {
    marks.set(played, MARK.WRONG);
    labels.set(played, displayNote(playedPitch.name));
  }
  // La correcta: verde si acertó, naranja ("la que faltó") si no.
  marks.set(pitch.midi, correct ? MARK.CORRECT : MARK.MISSING);
  labels.set(pitch.midi, displayNote(pitch.name));
  piano.setMarks(marks, labels);
  updateHint();
}

/* ---------------- Sonido ---------------- */

bus.on('note:on', ({ midi }) => playNote(midi));

function listenAction() {
  if (reader.paused || reader.phase !== 'answered') return; // antes de responder no ayuda al oído
  stopPlayback();
  playNote(reader.current.pitch.midi);
}

/* ---------------- Respuesta y paso a la siguiente ---------------- */

let autoNext = null;
let lastCorrect = false;

function cancelAutoNext() {
  clearTimeout(autoNext);
  autoNext = null;
}

function scheduleAutoNext() {
  cancelAutoNext();
  autoNext = setTimeout(() => {
    autoNext = null;
    if (!reader.paused && reader.phase === 'answered') reader.next();
  }, AUTO_NEXT_MS);
}

function onAnswer(detail, correct) {
  lastCorrect = correct;
  showAnswerOnKeys(detail, correct);
  renderFeedback(detail, correct);
  renderSession(detail.session);
  renderProgress();
  renderButtons();
  if (correct) scheduleAutoNext();
}
bus.on('answer:correct', (d) => onAnswer(d, true));
bus.on('answer:wrong', (d) => onAnswer(d, false));

bus.on('exercise:new', () => {
  cancelAutoNext();
  els.feedback.hidden = true;
  renderButtons();
});

function mainAction() {
  if (reader.paused || reader.phase !== 'answered') return;
  reader.next();
}

/* ---------------- Paneles HTML ---------------- */

const pitchLabel = (p) => displayNote(p.name) + p.octave;

function formatSeconds(ms) {
  const s = (ms / 1000).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${s} s`;
}

/** Explicación solo tras un error (al acertar se pasa sola a la siguiente). */
function renderFeedback({ pitch, playedPitch, clef, timeMs }, correct) {
  if (correct) {
    els.feedback.hidden = true;
    return;
  }
  els.feedback.className = 'panel feedback is-wrong';
  els.feedback.innerHTML = `
    <p class="feedback-title">Era ${pitchLabel(pitch)} <span class="muted small">(clave de ${CLEF_NAMES[clef]})</span></p>
    <p>${describeMiss(pitch, playedPitch)}</p>
    <p class="small muted">Tiempo ${formatSeconds(timeMs)}. Vuelve a la caja 1: aparecerá pronto de nuevo.
      Escucha la correcta con <kbd>Espacio</kbd> y sigue con <kbd>Enter</kbd>.</p>`;
  els.feedback.hidden = false;
}

function renderSession(s = reader.session) {
  els.score.textContent = `${s.correct}/${s.attempts}`;
  els.streak.textContent = s.streak;
  els.avg.textContent = s.correct ? formatSeconds(s.correctMs / s.correct) : '–';
}

function renderButtons() {
  const answered = reader.phase === 'answered';
  els.mainBtn.disabled = reader.paused || !answered;
  els.listenBtn.disabled = reader.paused || !answered;
  for (const b of [els.accBtn, els.namesBtn, ...document.querySelectorAll('[data-clef], [data-ledger]')]) {
    b.disabled = reader.paused;
  }
}

/* ---------------- Configuración ---------------- */

function renderConfig() {
  const { config } = reader;
  document.querySelectorAll('[data-clef]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.clef === config.clef)));
  document.querySelectorAll('[data-ledger]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ledger === String(config.ledger))));
  els.accBtn.setAttribute('aria-pressed', String(config.accidentals));
  els.accBtn.textContent = `Alteraciones: ${config.accidentals ? 'sí' : 'no'}`;
}

function setConfig(change) {
  if (reader.paused) return;
  reader.setConfig({ ...reader.config, ...change });
}

document.querySelectorAll('[data-clef]').forEach((b) => onButton(b, () => {
  if (reader.paused) return;
  piano.setRange(HOME_RANGE[b.dataset.clef]); // elegir clave lleva el teclado a su zona
  setConfig({ clef: b.dataset.clef });
  updateHint();
}));
document.querySelectorAll('[data-ledger]').forEach((b) => onButton(b, () => setConfig({ ledger: b.dataset.ledger === 'true' })));
onButton(els.accBtn, () => setConfig({ accidentals: !reader.config.accidentals }));

bus.on('config:change', () => {
  renderConfig();
  renderProgress();
});

/* ---------------- Nombres en las teclas ---------------- */

let showNames = load('showNames', false) === true;
function renderNamesToggle() {
  piano.setShowNames(showNames);
  els.namesBtn.setAttribute('aria-pressed', String(showNames));
  els.namesBtn.innerHTML = `Nombres: ${showNames ? 'sí' : 'no'} <kbd>N</kbd>`;
}
function toggleNames() {
  if (reader.paused) return;
  showNames = !showNames;
  save('showNames', showNames);
  renderNamesToggle();
}

/* ---------------- Progreso ---------------- */

/** Mapa de una clave: columnas = notas naturales (grave → agudo); filas = ♯, natural, ♭. */
function progressMap(clef, active) {
  const all = readingPitches(clef, { ledger: true, accidentals: true });
  const exists = new Set(all.map(pitchText));
  const naturals = all.filter((p) => p.name.length === 1);
  const rows = [['♯', '#'], ['', ''], ['♭', 'b']];
  let html = `<div class="head"></div>${naturals.map((p) => `<div class="head">${displayNote(p.name)}<sub>${p.octave}</sub></div>`).join('')}`;
  for (const [label, acc] of rows) {
    html += `<div class="head row-head">${label}</div>`;
    for (const n of naturals) {
      const pitch = { name: n.name + acc, octave: n.octave };
      if (!exists.has(pitchText(pitch))) {
        html += '<div class="cell is-none"></div>';
        continue;
      }
      const id = itemId(clef, pitch);
      const item = reader.items[id];
      const box = item ? item.box : 0;
      const off = active.has(id) ? '' : ' is-off';
      const title = item
        ? `${pitchLabel(pitch)} · caja ${box} · ${item.correct}/${item.attempts} aciertos`
          + (item.avgTimeMs ? ` · ${formatSeconds(item.avgTimeMs)}` : '')
        : `${pitchLabel(pitch)} · sin practicar`;
      html += `<div class="cell${off}" data-box="${box}" title="${title}"></div>`;
    }
  }
  return `<h3 class="map-title">Clave de ${CLEF_NAMES[clef]}</h3>
    <div class="progress-scroll"><div class="note-grid" style="--cols:${naturals.length}">${html}</div></div>`;
}

function renderProgress() {
  els.legend.innerHTML = ['Sin practicar', 'Caja 1', 'Caja 2', 'Caja 3', 'Caja 4', 'Caja 5']
    .map((text, box) => `<span><i class="cell" data-box="${box}"></i>${text}</span>`)
    .join('');
  const active = new Set(reader.activeIds());
  els.progressMaps.innerHTML = CLEFS.map((clef) => progressMap(clef, active)).join('');

  let total = 0;
  let practiced = 0;
  let mastered = 0;
  for (const clef of CLEFS) {
    for (const p of readingPitches(clef, { ledger: true, accidentals: true })) {
      total += 1;
      const item = reader.items[itemId(clef, p)];
      if (item) practiced += 1;
      if (item?.box === MAX_BOX) mastered += 1;
    }
  }
  els.progressSummary.textContent = `Practicadas: ${practiced} de ${total} · Dominadas (caja ${MAX_BOX}): ${mastered} · En rotación ahora: ${active.size}`;
}

bus.on('progress:reset', renderProgress);

els.resetBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todo el progreso de lectura? No se puede deshacer.')) reader.resetProgress();
});

/* ---------------- Botones y atajos ---------------- */

bindSoundToggle(els.soundToggle);
onButton(els.mainBtn, mainAction);
onButton(els.listenBtn, listenAction);
onButton(els.namesBtn, toggleNames);

bindShortcuts({
  canvas: els.canvas,
  isPaused: () => reader.paused,
  togglePause: () => reader.togglePause(),
  keys: {
    Enter: mainAction,
    ' ': listenAction,
    n: toggleNames,
    ArrowLeft: () => stage.shiftRange(-1), // ventana de teclas: C2–C4 ← C3–C5 → C4–C6
    ArrowRight: () => stage.shiftRange(1),
  },
});

/* ---------------- Pausa (atajo P, sin botón en pantalla) ---------------- */

bus.on('pause:change', ({ paused }) => {
  if (paused) cancelAutoNext();
  else if (reader.phase === 'answered' && lastCorrect) scheduleAutoNext();
  renderButtons();
});

/* ---------------- Inicio ---------------- */

piano.setRange(HOME_RANGE[reader.config.clef]);
renderNamesToggle();
renderConfig();
renderSession();
renderProgress();
reader.next();
stage.start();
