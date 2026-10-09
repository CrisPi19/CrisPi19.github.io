/*
 * Módulo 1: entrenador de acordes (versión pixel art).
 *
 * Este archivo solo CONECTA piezas:
 *   trainer (lógica) ──eventos──► capas del canvas, sonido y paneles HTML
 *   clic en el canvas ──► trainer.noteOn(midi)   (lo mismo que hará el MIDI)
 * No contiene reglas de teoría ni de dibujo. El canvas, la pausa y los atajos comunes
 * vienen de js/shell.js.
 */
import { EventBus } from '../../js/events.js';
import { Trainer, TYPE_IDS, itemId } from '../../js/trainer.js';
import {
  ROOTS, NATURAL_ROOTS, CHORD_TYPES, CHORD_GROUPS, chordName, spellChord, chordPitchClasses,
  rootPositionVoicing, inversionName, displayNote, displayDegree, midiToName,
} from '../../js/theory.js';
import { MAX_BOX } from '../../js/srs.js';
import { load, save } from '../../js/storage.js';
import { playNote, playChord, stopPlayback } from '../../js/audio.js';
import { createStage, bindShortcuts, onButton, bindSoundToggle, setupSideTools } from '../../js/shell.js';
import { mountCircleOfFifths } from '../../js/fifths.js';
import { computeMarks, KB_FROM } from '../../js/layers/piano.js';
import { UiLayer } from '../../js/layers/ui.js';

const $ = (id) => document.getElementById(id);
const els = {
  header: document.querySelector('.site-header'),
  stage: $('stage'),
  canvas: $('screen'),
  controls: $('controls'),
  clearBtn: $('clear-btn'),
  listenBtn: $('listen-btn'),
  namesBtn: $('names-btn'),
  mainBtn: $('main-btn'),
  feedback: $('feedback'),
  soundToggle: $('sound-toggle'),
  score: $('stat-score'),
  streak: $('stat-streak'),
  avg: $('stat-avg'),
  typeOptions: $('type-options'),
  rootOptions: $('root-options'),
  configCount: $('config-count'),
  legend: $('legend'),
  progressSummary: $('progress-summary'),
  progressGrid: $('progress-grid'),
  resetBtn: $('reset-btn'),
};

/* ---------------- Piezas ---------------- */

mountCircleOfFifths(document.querySelector('.site-header .container'));
const setNamesButton = setupSideTools({ names: els.namesBtn, listen: els.listenBtn });

const bus = new EventBus();
const trainer = new Trainer({ bus });
const stage = createStage({
  canvas: els.canvas,
  stage: els.stage,
  reserved: () => els.header.offsetHeight + els.controls.offsetHeight + 40,
  isPaused: () => trainer.paused,
  onNote: (midi) => trainer.noteOn(midi, 'screen'),
});
const { piano, scene } = stage;
scene.set('ui', new UiLayer(bus, trainer));

/* ---------------- Teclado: qué muestra en cada momento ---------------- */

bus.on('exercise:new', () => piano.clearMarks());
bus.on('selection:change', ({ notes }) => piano.setSelected(notes));
function showAnswerOnKeys({ notes, result, root, type }) {
  const { marks, labels } = computeMarks(notes, result, root, type, piano.from, piano.to);
  piano.setMarks(marks, labels);
}
bus.on('answer:correct', showAnswerOnKeys);
bus.on('answer:wrong', showAnswerOnKeys);

/* ---------------- Sonido (dentro del mismo evento del clic: el bus es síncrono) ---------------- */

const referenceVoicing = ({ root, type }) => rootPositionVoicing(root, type, KB_FROM);

bus.on('note:on', ({ midi }) => playNote(midi));
bus.on('answer:correct', ({ notes }) => playChord(notes)); // su propio voicing, con la inversión
bus.on('answer:wrong', (d) => playChord(referenceVoicing(d)));

/* ---------------- Paneles HTML ---------------- */

const symbolText = (type) => CHORD_TYPES[type].symbol.replace('b', '♭');
const noteOnly = (midi) => displayNote(midiToName(midi).replace(/-?\d+$/, ''));

function formatSeconds(ms) {
  const s = (ms / 1000).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${s} s`;
}

function setMainButton(text) {
  els.mainBtn.innerHTML = `${text} <kbd>Enter</kbd>`;
}

bus.on('exercise:new', () => {
  els.feedback.hidden = true;
  setMainButton('Comprobar');
});

function onAnswer(detail) {
  renderFeedback(detail);
  renderSession(detail.session);
  renderProgress();
  setMainButton('Siguiente');
}
bus.on('answer:correct', onAnswer);
bus.on('answer:wrong', onAnswer);

/** Explicación larga (no cabe en el canvas): notas con su función, inversión, tiempo y caja. */
function renderFeedback({ root, type, result, timeMs, slowThresholdMs, before, after }) {
  const degrees = CHORD_TYPES[type].degrees;
  const spelled = spellChord(root, type);
  const pcs = chordPitchClasses(root, type);

  const chips = spelled.map((note, i) => {
    const missing = result.missing.includes(pcs[i]) ? ' class="is-missing"' : '';
    return `<li${missing}><span class="note">${displayNote(note)}</span><span class="degree">${displayDegree(degrees[i])}</span></li>`;
  }).join('');

  const lines = [];
  if (result.correct) {
    if (result.inversion === 0) {
      lines.push('<p>Posición fundamental: la tónica (1) está en el bajo.</p>');
    } else {
      lines.push(`<p class="inversion">Lo tocaste en <strong>${inversionName(result.inversion)}</strong>:
        en el bajo está el ${displayDegree(result.bass.degree)} (${displayNote(spelled[result.inversion])}),
        o sea <strong>${result.slashName}</strong>. Se pedía en posición fundamental:
        cuenta como correcto, pero fíjate en qué nota pones abajo.</p>`);
    }
  } else {
    if (result.missing.length) {
      const list = result.missing.map((pc) => {
        const i = pcs.indexOf(pc);
        return `${displayNote(spelled[i])} (${displayDegree(degrees[i])})`;
      });
      lines.push(`<p>Faltó: ${list.join(', ')}.</p>`);
    }
    if (result.extra.length) {
      lines.push(`<p>Sobró: ${[...new Set(result.extra.map(noteOnly))].join(', ')}.</p>`);
    }
  }

  let boxText;
  if (!result.correct) boxText = 'Vuelve a la caja 1: aparecerá pronto de nuevo.';
  else if (after.box > before.box) boxText = `Rápido: sube a la caja ${after.box}.`;
  else if (timeMs <= slowThresholdMs) boxText = `Rápido: se mantiene en la caja ${MAX_BOX} (dominado).`;
  else boxText = `Correcto pero lento: se queda en la caja ${after.box}.`;
  lines.push(`<p class="small muted">Tiempo ${formatSeconds(timeMs)} (rápido si es ≤ ${formatSeconds(slowThresholdMs)}). ${boxText}</p>`);

  els.feedback.className = `panel feedback ${result.correct ? 'is-correct' : 'is-wrong'}`;
  els.feedback.innerHTML = `
    <p class="feedback-title">${chordName(root, type)}</p>
    <ul class="chord-notes">${chips}</ul>
    ${lines.join('')}`;
  els.feedback.hidden = false;
}

function renderSession(s = trainer.session) {
  els.score.textContent = `${s.correct}/${s.attempts}`;
  els.streak.textContent = s.streak;
  els.avg.textContent = s.correct ? formatSeconds(s.correctMs / s.correct) : '–';
}

/* ---------------- Sonido y nombres de notas ---------------- */

bindSoundToggle(els.soundToggle);

let showNames = load('showNames', false) === true;
function renderNamesToggle() {
  piano.setShowNames(showNames);
  setNamesButton(showNames);
}
function toggleNames() {
  if (trainer.paused) return;
  showNames = !showNames;
  save('showNames', showNames);
  renderNamesToggle();
}

/* ---------------- Configuración ---------------- */

function chip(name, value, label, checked, title = '') {
  return `<label class="chip"${title ? ` title="${title}"` : ''}>
    <input type="checkbox" name="${name}" value="${value}"${checked ? ' checked' : ''}>
    <span>${label}</span></label>`;
}

function renderConfig() {
  const { config } = trainer;
  els.typeOptions.innerHTML = Object.entries(CHORD_GROUPS).map(([group, groupName]) => {
    const chips = TYPE_IDS.filter((t) => CHORD_TYPES[t].group === group)
      .map((t) => chip('type', t, symbolText(t) || 'mayor', config.types.includes(t), CHORD_TYPES[t].name))
      .join('');
    return `<fieldset class="option-group"><legend>${groupName}</legend><div class="chips">${chips}</div></fieldset>`;
  }).join('');
  els.rootOptions.innerHTML = ROOTS.map((r) => chip('root', r, displayNote(r), config.roots.includes(r))).join('');
  els.configCount.textContent = `${trainer.activeIds().length} acordes en rotación.`;
}

$('config-panel').addEventListener('change', (event) => {
  const input = event.target;
  if (input.type !== 'checkbox') return;
  const checked = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
  const next = { types: checked('type'), roots: checked('root') };
  if (!next.types.length || !next.roots.length) {
    input.checked = true; // al menos un tipo y una tónica
    return;
  }
  trainer.setConfig(next);
});

document.querySelectorAll('[data-roots]').forEach((button) => {
  button.addEventListener('click', () => {
    const roots = button.dataset.roots === 'naturals' ? NATURAL_ROOTS : ROOTS;
    trainer.setConfig({ ...trainer.config, roots: [...roots] });
  });
});

bus.on('config:change', () => {
  renderConfig();
  renderProgress();
});

/* ---------------- Progreso ---------------- */

function renderProgress() {
  const { items, config } = trainer;
  els.legend.innerHTML = ['Sin practicar', 'Caja 1', 'Caja 2', 'Caja 3', 'Caja 4', 'Caja 5']
    .map((text, box) => `<span><i class="cell" data-box="${box}"></i>${text}</span>`)
    .join('');

  let html = '<div class="head"></div>' + ROOTS.map((r) => `<div class="head">${displayNote(r)}</div>`).join('');
  let practiced = 0;
  let mastered = 0;
  for (const type of TYPE_IDS) {
    html += `<div class="head row-head" title="${CHORD_TYPES[type].name}">${symbolText(type) || 'mayor'}</div>`;
    for (const root of ROOTS) {
      const item = items[itemId(root, type)];
      const box = item ? item.box : 0;
      if (item) practiced += 1;
      if (box === MAX_BOX) mastered += 1;
      const off = config.types.includes(type) && config.roots.includes(root) ? '' : ' is-off';
      const title = item
        ? `${chordName(root, type)} · caja ${box} · ${item.correct}/${item.attempts} aciertos`
          + (item.avgTimeMs ? ` · ${formatSeconds(item.avgTimeMs)}` : '')
        : `${chordName(root, type)} · sin practicar`;
      html += `<div class="cell${off}" data-box="${box}" title="${title}"></div>`;
    }
  }
  els.progressGrid.innerHTML = html;
  const total = ROOTS.length * TYPE_IDS.length;
  els.progressSummary.textContent = `Practicados: ${practiced} de ${total} · Dominados (caja ${MAX_BOX}): ${mastered}`;
}

bus.on('progress:reset', renderProgress);

els.resetBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todo el progreso de acordes? No se puede deshacer.')) trainer.resetProgress();
});

/* ---------------- Botones y atajos ---------------- */

function mainAction() {
  if (trainer.paused) return;
  if (trainer.phase === 'asking') trainer.submit();
  else trainer.next();
}

function listenAction() {
  if (trainer.paused || !trainer.current) return;
  stopPlayback(); // apretar varias veces no amontona acordes
  playChord(referenceVoicing(trainer.current));
}

onButton(els.mainBtn, mainAction);
onButton(els.clearBtn, () => trainer.clear());
onButton(els.listenBtn, listenAction);
onButton(els.namesBtn, toggleNames);

bindShortcuts({
  canvas: els.canvas,
  isPaused: () => trainer.paused,
  togglePause: () => trainer.togglePause(),
  keys: {
    Enter: mainAction,
    Escape: () => trainer.clear(),
    ' ': listenAction,
    n: toggleNames,
    ArrowLeft: () => stage.shiftRange(-1), // ventana de teclas: C2–C4 ← C3–C5 → C4–C6
    ArrowRight: () => stage.shiftRange(1),
  },
});

/* ---------------- Pausa (atajo P, sin botón en pantalla) ---------------- */

const controlButtons = [els.clearBtn, els.listenBtn, els.namesBtn, els.mainBtn];
bus.on('pause:change', ({ paused }) => {
  for (const button of controlButtons) button.disabled = paused;
});

/* ---------------- Inicio ---------------- */

renderNamesToggle();
renderConfig();
renderSession();
renderProgress();
trainer.next();
stage.start();
