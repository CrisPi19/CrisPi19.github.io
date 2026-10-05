/*
 * Módulo 1: entrenador de acordes.
 *
 * Ciclo: elegir acorde (repetición espaciada) → el usuario marca teclas → Comprobar
 * → feedback en el teclado y en texto → actualizar caja y estadísticas → Siguiente.
 *
 * Este archivo solo coordina: la teoría está en theory.js, el teclado en keyboard.js,
 * el sorteo en srs.js, el sonido en audio.js y el guardado en storage.js.
 */
import {
  ROOTS, NATURAL_ROOTS, CHORD_TYPES, CHORD_GROUPS, chordName, spellChord, chordPitchClasses,
  analyzeAnswer, rootPositionVoicing, inversionName, displayNote, displayDegree, midiToName,
} from '../../js/theory.js';
import { PianoKeyboard } from '../../js/keyboard.js';
import { createItem, grade, pickNext, MAX_BOX } from '../../js/srs.js';
import { load, save, remove } from '../../js/storage.js';
import { playNote, playChord, isMuted, setMuted } from '../../js/audio.js';

const KB_FROM = 48; // C3
const KB_TO = 72; // C5
/** Un acierto es "rápido" si tarda menos de esto por cada nota del acorde. */
const SLOW_MS_PER_NOTE = 2000;
const TYPE_IDS = Object.keys(CHORD_TYPES);

const $ = (id) => document.getElementById(id);
const els = {
  chordName: $('chord-name'),
  chordType: $('chord-type'),
  timer: $('timer'),
  keyboard: $('keyboard'),
  clearBtn: $('clear-btn'),
  listenBtn: $('listen-btn'),
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

/* ---------------- Estado ---------------- */

let config = sanitizeConfig(load('acordes.config', null));
let items = load('acordes.items', {});
if (!items || typeof items !== 'object') items = {};

const state = { current: null, phase: 'asking', startedAt: 0, timerId: null };
const session = { attempts: 0, correct: 0, streak: 0, correctMs: 0 };

const kb = new PianoKeyboard(els.keyboard, { from: KB_FROM, to: KB_TO });
kb.addEventListener('noteon', (e) => playNote(e.detail.midi));

/* ---------------- Utilidades ---------------- */

function sanitizeConfig(saved) {
  const types = (saved?.types ?? TYPE_IDS).filter((t) => TYPE_IDS.includes(t));
  const roots = (saved?.roots ?? ROOTS).filter((r) => ROOTS.includes(r));
  return {
    types: types.length ? types : [...TYPE_IDS],
    roots: roots.length ? roots : [...ROOTS],
  };
}

const itemId = (root, type) => `${root}|${type}`;

function parseId(id) {
  const [root, type] = id.split('|');
  return { id, root, type };
}

function activeIds() {
  return config.roots.flatMap((root) => config.types.map((type) => itemId(root, type)));
}

const symbolText = (type) => CHORD_TYPES[type].symbol.replace('b', '♭');

function formatSeconds(ms) {
  const s = (ms / 1000).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${s} s`;
}

/** Voicing del acorde pedido en posición fundamental (para escucharlo). */
const referenceVoicing = ({ root, type }) => rootPositionVoicing(root, type, KB_FROM);

/* ---------------- Ciclo del ejercicio ---------------- */

function nextChord() {
  state.current = parseId(pickNext(activeIds(), items, { avoid: state.current?.id }));
  state.phase = 'asking';

  const { root, type } = state.current;
  els.chordName.textContent = displayNote(root);
  if (symbolText(type)) {
    const quality = document.createElement('span');
    quality.className = 'quality';
    quality.textContent = symbolText(type);
    els.chordName.appendChild(quality);
  }
  els.chordName.classList.remove('is-new');
  void els.chordName.offsetWidth;
  els.chordName.classList.add('is-new');
  els.chordType.textContent = CHORD_TYPES[type].name;

  kb.clearMarks();
  kb.clearSelection();
  kb.setLocked(false);
  hideFeedback();
  setMainButton('Comprobar');
  startTimer();
}

function check() {
  const notes = kb.getSelected();
  if (!notes.length) {
    showMessage('Marca al menos una tecla antes de comprobar.');
    return;
  }

  const timeMs = performance.now() - state.startedAt;
  stopTimer();
  els.timer.textContent = formatSeconds(timeMs);

  const { id, root, type } = state.current;
  const result = analyzeAnswer(notes, root, type);
  const slowThresholdMs = SLOW_MS_PER_NOTE * CHORD_TYPES[type].degrees.length;
  const before = items[id] ?? createItem();
  const after = grade(before, { correct: result.correct, timeMs, slowThresholdMs });
  items[id] = after;
  save('acordes.items', items);

  session.attempts += 1;
  if (result.correct) {
    session.correct += 1;
    session.streak += 1;
    session.correctMs += timeMs;
  } else {
    session.streak = 0;
  }

  state.phase = 'answered';
  kb.setLocked(true);
  showMarks(notes, result);
  renderFeedback(result, { timeMs, slowThresholdMs, before, after });
  setMainButton('Siguiente');
  // Si acertó, escucha SU voicing (incluida la inversión); si no, el acorde correcto.
  playChord(result.correct ? notes : referenceVoicing(state.current));

  renderSession();
  renderProgress();
}

function mainAction() {
  if (state.phase === 'asking') check();
  else nextChord();
}

function clearAction() {
  if (state.phase !== 'asking') return;
  kb.clearSelection();
  hideFeedback();
}

function listenAction() {
  if (state.current) playChord(referenceVoicing(state.current));
}

/* ---------------- Temporizador ---------------- */

function startTimer() {
  stopTimer();
  state.startedAt = performance.now();
  els.timer.textContent = formatSeconds(0);
  state.timerId = setInterval(() => {
    els.timer.textContent = formatSeconds(performance.now() - state.startedAt);
  }, 100);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

/* ---------------- Feedback ---------------- */

/** Colorea el teclado: correctas con su grado, sobrantes con su nombre, faltantes con su grado. */
function showMarks(notes, result) {
  const { root, type } = state.current;
  const degrees = CHORD_TYPES[type].degrees;
  const pcs = chordPitchClasses(root, type);
  const marks = new Map();
  const labels = new Map();

  for (const midi of notes) {
    const degree = result.degreeOf(midi);
    if (degree) {
      marks.set(midi, 'correct');
      labels.set(midi, displayDegree(degree));
    } else {
      marks.set(midi, 'wrong');
      labels.set(midi, displayNote(midiToName(midi).replace(/-?\d+$/, '')));
    }
  }

  // Cada nota que faltó se muestra en la octava justo encima de la nota más grave tocada.
  const low = notes[0];
  for (const pc of result.missing) {
    let midi = low + ((pc - low) % 12 + 12) % 12;
    if (midi > KB_TO) midi -= 12;
    marks.set(midi, 'missing');
    labels.set(midi, displayDegree(degrees[pcs.indexOf(pc)]));
  }

  kb.setMarks(marks, labels);
}

function renderFeedback(result, { timeMs, slowThresholdMs, before, after }) {
  const { root, type } = state.current;
  const degrees = CHORD_TYPES[type].degrees;
  const spelled = spellChord(root, type);
  const pcs = chordPitchClasses(root, type);
  const name = chordName(root, type);

  const chips = spelled.map((note, i) => {
    const missing = result.missing.includes(pcs[i]) ? ' class="is-missing"' : '';
    return `<li${missing}><span class="note">${displayNote(note)}</span><span class="degree">${displayDegree(degrees[i])}</span></li>`;
  }).join('');

  const lines = [];
  if (result.correct) {
    const bass = result.bass;
    if (result.inversion === 0) {
      lines.push(`<p>Posición fundamental: la tónica (1) está en el bajo.</p>`);
    } else {
      lines.push(`<p class="inversion">Lo tocaste en <strong>${inversionName(result.inversion)}</strong>:
        en el bajo está el ${displayDegree(bass.degree)} (${displayNote(spelled[result.inversion])}),
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
      const list = result.extra.map((m) => displayNote(midiToName(m).replace(/-?\d+$/, '')));
      lines.push(`<p>Sobró: ${[...new Set(list)].join(', ')}.</p>`);
    }
  }

  let boxText;
  if (!result.correct) boxText = 'Vuelve a la caja 1: aparecerá pronto de nuevo.';
  else if (after.box > before.box) boxText = `Rápido: sube a la caja ${after.box}.`;
  else if (timeMs <= slowThresholdMs) boxText = `Rápido: se mantiene en la caja ${MAX_BOX} (dominado).`;
  else boxText = `Correcto pero lento: se queda en la caja ${after.box}.`;

  lines.push(`<p class="small muted">Tiempo ${formatSeconds(timeMs)} (rápido si es ≤ ${formatSeconds(slowThresholdMs)}). ${boxText}</p>`);

  els.feedback.className = `feedback ${result.correct ? 'is-correct' : 'is-wrong'}`;
  els.feedback.innerHTML = `
    <p class="feedback-title">${result.correct ? '✓ Correcto' : '✗ No es correcto'}</p>
    <ul class="chord-notes" aria-label="Notas de ${name}">${chips}</ul>
    ${lines.join('')}`;
  els.feedback.hidden = false;
}

function showMessage(text) {
  els.feedback.className = 'feedback';
  els.feedback.innerHTML = `<p>${text}</p>`;
  els.feedback.hidden = false;
}

function hideFeedback() {
  els.feedback.hidden = true;
}

function setMainButton(text) {
  els.mainBtn.innerHTML = `${text} <kbd>Enter</kbd>`;
}

function renderSession() {
  els.score.textContent = `${session.correct}/${session.attempts}`;
  els.streak.textContent = session.streak;
  els.avg.textContent = session.correct ? formatSeconds(session.correctMs / session.correct) : '–';
}

/* ---------------- Sonido ---------------- */

function renderSoundToggle() {
  const muted = isMuted();
  els.soundToggle.textContent = muted ? '🔇' : '🔊';
  els.soundToggle.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
  els.soundToggle.title = els.soundToggle.getAttribute('aria-label');
}

els.soundToggle.addEventListener('click', () => {
  setMuted(!isMuted());
  renderSoundToggle();
});

/* ---------------- Configuración ---------------- */

function chip(name, value, label, checked, title = '') {
  return `<label class="chip"${title ? ` title="${title}"` : ''}>
    <input type="checkbox" name="${name}" value="${value}"${checked ? ' checked' : ''}>
    <span>${label}</span></label>`;
}

function renderConfig() {
  els.typeOptions.innerHTML = Object.entries(CHORD_GROUPS).map(([group, groupName]) => {
    const chips = TYPE_IDS.filter((t) => CHORD_TYPES[t].group === group)
      .map((t) => chip('type', t, symbolText(t) || 'mayor', config.types.includes(t), CHORD_TYPES[t].name))
      .join('');
    return `<fieldset class="option-group"><legend>${groupName}</legend><div class="chips">${chips}</div></fieldset>`;
  }).join('');

  els.rootOptions.innerHTML = ROOTS.map((r) => chip('root', r, displayNote(r), config.roots.includes(r))).join('');
  els.configCount.textContent = `${activeIds().length} acordes en rotación.`;
}

function applyConfig(next) {
  config = sanitizeConfig(next);
  save('acordes.config', config);
  renderConfig();
  renderProgress();
  // Si el acorde actual ya no está en la selección, pasar a uno que sí.
  if (state.phase === 'asking' && !activeIds().includes(state.current?.id)) nextChord();
}

document.getElementById('config-panel').addEventListener('change', (event) => {
  const input = event.target;
  if (input.type !== 'checkbox') return;
  const checked = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
  const next = { types: checked('type'), roots: checked('root') };
  if (!next.types.length || !next.roots.length) {
    input.checked = true; // al menos un tipo y una tónica
    return;
  }
  applyConfig(next);
});

document.querySelectorAll('[data-roots]').forEach((button) => {
  button.addEventListener('click', () => {
    const roots = button.dataset.roots === 'naturals' ? NATURAL_ROOTS : ROOTS;
    applyConfig({ ...config, roots: [...roots] });
  });
});

/* ---------------- Progreso ---------------- */

function renderProgress() {
  els.legend.innerHTML = ['Sin practicar', 'Caja 1', 'Caja 2', 'Caja 3', 'Caja 4', 'Caja 5']
    .map((text, box) => `<span><i style="background: var(--box-${box})"></i>${text}</span>`)
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

els.resetBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todo el progreso de acordes? No se puede deshacer.')) return;
  items = {};
  remove('acordes.items');
  renderProgress();
  nextChord();
});

/* ---------------- Botones y atajos ---------------- */

function onButton(button, action) {
  button.addEventListener('click', (event) => {
    action();
    // Tras un clic con mouse, quitar el foco para que Enter/Espacio vayan a los atajos.
    if (event.detail > 0) button.blur();
  });
}

onButton(els.mainBtn, mainAction);
onButton(els.clearBtn, clearAction);
onButton(els.listenBtn, listenAction);

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  // Atajos solo cuando el foco está en la página o en una tecla del piano,
  // para no interferir con casillas, enlaces o botones enfocados con teclado.
  const target = event.target;
  const free = target === document.body || target.closest?.('.key');
  if (!free) return;

  if (event.key === 'Enter') mainAction();
  else if (event.key === 'Escape') clearAction();
  else if (event.key === ' ') listenAction();
  else return;
  event.preventDefault();
});

/* ---------------- Inicio ---------------- */

renderSoundToggle();
renderConfig();
renderSession();
renderProgress();
nextChord();
