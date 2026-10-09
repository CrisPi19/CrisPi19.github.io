/*
 * Módulo 4: Lectura (notas sueltas y acordes escritos, en clave de sol y de fa).
 *
 * Este archivo solo CONECTA piezas:
 *   reader (lógica, js/reading.js) ──eventos──► pizarra del canvas, teclas, sonido y paneles
 *   clic en el canvas ──► reader.noteOn(midi)   (lo mismo que hará el MIDI)
 * Notas: la primera tecla tocada es la respuesta (octava exacta).
 * Acordes: se marcan las teclas y se confirma con Enter (Esc borra); exactamente esas notas.
 * Al acertar se pasa solo al siguiente; al fallar se espera Enter para poder mirar el error.
 */
import { EventBus } from '../../js/events.js';
import {
  Reader, CLEFS, CLEF_NAMES, READING_CHORD_TYPES, readingPitches, itemId, chordItemId,
  describeMiss, pitchText, spellExtras, noteIds, chordIds, sanitizeConfig,
} from '../../js/reading.js';
import {
  ROOTS, CHORD_TYPES, CHORD_GROUPS, displayNote, displayDegree, chordName, slashChordName,
  inversionName, notePc,
} from '../../js/theory.js';
import { MAX_BOX } from '../../js/srs.js';
import { load, save } from '../../js/storage.js';
import { playNote, playChord, stopPlayback } from '../../js/audio.js';
import { createStage, bindShortcuts, onButton, bindSoundToggle, setupSideTools } from '../../js/shell.js';
import { mountCircleOfFifths } from '../../js/fifths.js';
import { MARK } from '../../js/layers/piano.js';
import { ReadingUiLayer } from '../../js/layers/reading-ui.js';

/** Pausa tras un acierto antes del siguiente (se alcanza a ver el verde; en acordes, el nombre). */
const AUTO_NEXT_MS = { notes: 700, chords: 1200 };
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
  clearBtn: $('clear-btn'),
  listenBtn: $('listen-btn'),
  mainBtn: $('main-btn'),
  feedback: $('feedback'),
  soundToggle: $('sound-toggle'),
  score: $('stat-score'),
  streak: $('stat-streak'),
  avg: $('stat-avg'),
  chordPanel: $('chord-panel'),
  chordTypeOptions: $('chord-type-options'),
  chordCount: $('chord-count'),
  legend: $('legend'),
  progressIntro: $('progress-intro'),
  progressSummary: $('progress-summary'),
  progressMaps: $('progress-maps'),
  resetBtn: $('reset-btn'),
};

/* ---------------- Piezas ---------------- */

mountCircleOfFifths(document.querySelector('.site-header .container'));
const setNamesButton = setupSideTools({ names: els.namesBtn, listen: els.listenBtn });

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

const isChords = () => reader.current?.mode === 'chords';
/** Teclas MIDI de lo que está escrito ahora en la pizarra. */
const writtenMidis = () => {
  const c = reader.current;
  if (!c) return [];
  return c.mode === 'chords' ? c.pitches.map((p) => p.midi) : [c.pitch.midi];
};

/* ---------------- Teclado ---------------- */

/**
 * La flecha brilla si lo escrito no está en la ventana visible (hacia su lado). Solo
 * dice "cámbiate de ventana", no qué teclas son: leer la octava sigue siendo tarea tuya.
 * Un acorde siempre cabe entero en una ventana, así que nunca brillan las dos.
 */
function updateHint() {
  const midis = writtenMidis();
  piano.setArrowHint(midis.some((m) => m < piano.from), midis.some((m) => m > piano.to));
}

bus.on('exercise:new', () => {
  piano.clearMarks();
  piano.setSelected([]);
  updateHint();
});
bus.on('selection:change', ({ notes }) => piano.setSelected(notes));

function showNoteOnKeys({ pitch, played, playedPitch }, correct) {
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
}

/** Acordes: las escritas con su función (1, 3, ♭7…), verdes o naranjas; las que sobraron, rojas con su nombre. */
function showChordOnKeys({ pitches, result }) {
  const marks = new Map();
  const labels = new Map();
  const missing = new Set(result.missing.map((p) => p.midi));
  for (const p of pitches) {
    marks.set(p.midi, missing.has(p.midi) ? MARK.MISSING : MARK.CORRECT);
    labels.set(p.midi, displayDegree(p.degree));
  }
  spellExtras(result.extra, pitches).forEach((p) => {
    marks.set(p.midi, MARK.WRONG);
    labels.set(p.midi, displayNote(p.name));
  });
  piano.setMarks(marks, labels);
}

/* ---------------- Sonido ---------------- */

bus.on('note:on', ({ midi }) => playNote(midi));

/** El acorde escrito suena al confirmar (acierto o error): se une lo leído con lo que se oye. */
function playWritten() {
  stopPlayback(); // apretar varias veces no amontona sonidos
  if (isChords()) playChord(writtenMidis());
  else playNote(writtenMidis()[0]);
}

/* ---------------- Respuesta y paso al siguiente ---------------- */

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
  }, AUTO_NEXT_MS[reader.current.mode]);
}

function onAnswer(detail, correct) {
  lastCorrect = correct;
  if (detail.mode === 'chords') {
    showChordOnKeys(detail);
    playWritten();
  } else {
    showNoteOnKeys(detail, correct);
  }
  updateHint();
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

/** Enter: en acordes, comprobar mientras se pregunta; después (los dos modos), siguiente. */
function mainAction() {
  if (reader.paused) return;
  if (reader.phase === 'answered') reader.next();
  else if (isChords()) reader.submit();
}

/* ---------------- Paneles HTML ---------------- */

const pitchLabel = (p) => displayNote(p.name) + p.octave;

function formatSeconds(ms) {
  const s = (ms / 1000).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${s} s`;
}

/** Explicación solo tras un error (al acertar se pasa solo al siguiente). */
function renderFeedback(detail, correct) {
  if (correct) {
    els.feedback.hidden = true;
    return;
  }
  const body = detail.mode === 'chords' ? chordFeedback(detail) : noteFeedback(detail);
  els.feedback.className = 'panel feedback is-wrong';
  els.feedback.innerHTML = `${body}
    <p class="small muted">Tiempo ${formatSeconds(detail.timeMs)}. Vuelve a la caja 1: aparecerá pronto de nuevo.
      Sigue con <kbd>Enter</kbd>.</p>`;
  els.feedback.hidden = false;
}

function noteFeedback({ pitch, playedPitch, clef }) {
  return `
    <p class="feedback-title">Era ${pitchLabel(pitch)} <span class="muted small">(clave de ${CLEF_NAMES[clef]})</span></p>
    <p>${describeMiss(pitch, playedPitch)}</p>`;
}

/**
 * Acordes: las notas escritas (grave → agudo) con su función, lo que faltó y lo que sobró.
 * Si una que faltó y una que sobró son la misma nota, el error fue de octava: se dice así.
 */
function chordFeedback({ clef, root, type, inversion, pitches, result }) {
  const missing = new Set(result.missing.map((p) => p.midi));
  const chips = pitches.map((p) => `<li${missing.has(p.midi) ? ' class="is-missing"' : ''}>
    <span class="note">${pitchLabel(p)}</span><span class="degree">${displayDegree(p.degree)}</span></li>`).join('');

  const extras = spellExtras(result.extra, pitches);
  const lines = [];
  const explained = new Set();
  for (const p of result.missing) {
    const twin = extras.find((e) => !explained.has(e.midi) && notePc(e.name) === notePc(p.name));
    if (!twin) continue;
    explained.add(twin.midi);
    lines.push(`<li>${describeMiss(p, twin).replace(/^Tocaste (\S+):/, `Tocaste $1 en vez de ${pitchLabel(p)}:`)}</li>`);
  }
  if (result.missing.length) lines.push(`<li>Faltó: ${result.missing.map((p) => `${pitchLabel(p)} (${displayDegree(p.degree)})`).join(', ')}.</li>`);
  if (extras.length) lines.push(`<li>Sobró: ${extras.map(pitchLabel).join(', ')}.</li>`);

  const position = inversion ? `${inversionName(inversion)}, ` : '';
  return `
    <p class="feedback-title">Era ${slashChordName(root, type, inversion)}
      <span class="muted small">(${position}clave de ${CLEF_NAMES[clef]})</span></p>
    <ul class="chord-notes">${chips}</ul>
    <ul class="miss-list">${lines.join('')}</ul>`;
}

function renderSession(s = reader.session) {
  els.score.textContent = `${s.correct}/${s.attempts}`;
  els.streak.textContent = s.streak;
  els.avg.textContent = s.correct ? formatSeconds(s.correctMs / s.correct) : '–';
}

function renderButtons() {
  const answered = reader.phase === 'answered';
  const chords = reader.config.mode === 'chords';
  els.mainBtn.innerHTML = `${chords && !answered ? 'Comprobar' : 'Siguiente'} <kbd>Enter</kbd>`;
  els.mainBtn.disabled = reader.paused || (!answered && !chords);
  // Lectura no usa "escuchar": el botón queda en gris para decir que aquí no aplica
  // (los acordes igual suenan solos al confirmar).
  els.listenBtn.disabled = true;
  els.clearBtn.hidden = !chords;
  els.clearBtn.disabled = reader.paused || answered;
  const options = document.querySelectorAll('[data-mode], [data-clef], [data-ledger], [data-roots], [data-inversions]');
  for (const b of [els.accBtn, els.namesBtn, ...options]) b.disabled = reader.paused;
}

/* ---------------- Configuración ---------------- */

const symbolText = (type) => CHORD_TYPES[type].symbol.replace('b', '♭') || 'mayor';

function chip(name, value, label, checked, title = '') {
  return `<label class="chip"${title ? ` title="${title}"` : ''}>
    <input type="checkbox" name="${name}" value="${value}"${checked ? ' checked' : ''}>
    <span>${label}</span></label>`;
}

function pressed(selector, attr, value) {
  document.querySelectorAll(selector).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value))));
}

function renderConfig() {
  const { config } = reader;
  const chords = config.mode === 'chords';
  pressed('[data-mode]', 'mode', config.mode);
  pressed('[data-clef]', 'clef', config.clef);
  pressed('[data-ledger]', 'ledger', config.ledger);
  pressed('[data-roots]', 'roots', config.chordRoots);
  pressed('[data-inversions]', 'inversions', config.inversions);
  els.accBtn.hidden = chords; // en acordes las alteraciones vienen con el acorde
  els.accBtn.setAttribute('aria-pressed', String(config.accidentals));
  els.accBtn.textContent = `Alteraciones: ${config.accidentals ? 'sí' : 'no'}`;
  els.chordPanel.hidden = !chords;

  const groups = [...new Set(READING_CHORD_TYPES.map((t) => CHORD_TYPES[t].group))];
  els.chordTypeOptions.innerHTML = groups.map((group) => {
    const chips = READING_CHORD_TYPES.filter((t) => CHORD_TYPES[t].group === group)
      .map((t) => chip('chord-type', t, symbolText(t), config.chordTypes.includes(t), CHORD_TYPES[t].name))
      .join('');
    return `<fieldset class="option-group"><legend>${CHORD_GROUPS[group]}</legend><div class="chips">${chips}</div></fieldset>`;
  }).join('');
  els.chordCount.textContent = `${chordIds(config).length} acordes en rotación (contando clave e inversión). `
    + 'Solo entran los que caben en la pizarra y en una ventana del teclado.';
}

function setConfig(change) {
  if (reader.paused) return;
  reader.setConfig({ ...reader.config, ...change });
}

document.querySelectorAll('[data-mode]').forEach((b) => onButton(b, () => setConfig({ mode: b.dataset.mode })));
document.querySelectorAll('[data-clef]').forEach((b) => onButton(b, () => {
  if (reader.paused) return;
  piano.setRange(HOME_RANGE[b.dataset.clef]); // elegir clave lleva el teclado a su zona
  setConfig({ clef: b.dataset.clef });
  updateHint();
}));
document.querySelectorAll('[data-ledger]').forEach((b) => onButton(b, () => setConfig({ ledger: b.dataset.ledger === 'true' })));
document.querySelectorAll('[data-roots]').forEach((b) => onButton(b, () => setConfig({ chordRoots: b.dataset.roots })));
document.querySelectorAll('[data-inversions]').forEach((b) => onButton(b, () => setConfig({ inversions: b.dataset.inversions === 'true' })));
onButton(els.accBtn, () => setConfig({ accidentals: !reader.config.accidentals }));

els.chordTypeOptions.addEventListener('change', (event) => {
  const input = event.target;
  if (input.type !== 'checkbox') return;
  const types = [...els.chordTypeOptions.querySelectorAll('input:checked')].map((i) => i.value);
  if (!types.length || reader.paused) {
    input.checked = !input.checked; // al menos un tipo (y nada cambia en pausa)
    return;
  }
  setConfig({ chordTypes: types });
});

bus.on('config:change', () => {
  renderConfig();
  renderProgress();
  renderButtons();
});

/* ---------------- Nombres en las teclas ---------------- */

let showNames = load('showNames', false) === true;
function renderNamesToggle() {
  piano.setShowNames(showNames);
  setNamesButton(showNames);
}
function toggleNames() {
  if (reader.paused) return;
  showNames = !showNames;
  save('showNames', showNames);
  renderNamesToggle();
}

/* ---------------- Progreso ---------------- */

/** Mapa de notas de una clave: columnas = notas naturales (grave → agudo); filas = ♯, natural, ♭. */
function noteMap(clef, active) {
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

/**
 * Mapa de acordes de una clave: filas = tipos, columnas = tónicas. Cada acorde tiene una
 * caja por inversión; la celda muestra la PEOR de las practicadas (lo que falta reforzar).
 */
function chordMap(clef, active) {
  let html = `<div class="head"></div>${ROOTS.map((r) => `<div class="head">${displayNote(r)}</div>`).join('')}`;
  for (const type of READING_CHORD_TYPES) {
    html += `<div class="head row-head" title="${CHORD_TYPES[type].name}">${symbolText(type)}</div>`;
    for (const root of ROOTS) {
      const invs = CHORD_TYPES[type].degrees.map((_, inv) => chordItemId(clef, root, type, inv));
      const practiced = invs.map((id, inv) => [inv, reader.items[id]]).filter(([, item]) => item);
      const box = practiced.length ? Math.min(...practiced.map(([, item]) => item.box)) : 0;
      const off = invs.some((id) => active.has(id)) ? '' : ' is-off';
      const detail = practiced.length
        ? practiced.map(([inv, item]) => `${inv ? `${inv}.ª inv.` : 'fund.'} caja ${item.box} (${item.correct}/${item.attempts})`).join(' · ')
        : 'sin practicar';
      html += `<div class="cell${off}" data-box="${box}" title="${chordName(root, type)} · ${detail}"></div>`;
    }
  }
  return `<h3 class="map-title">Clave de ${CLEF_NAMES[clef]}</h3>
    <div class="progress-scroll"><div class="note-grid chord-grid" style="--cols:${ROOTS.length}">${html}</div></div>`;
}

/** Todo lo que existe en un modo (para contar lo practicado), sea cual sea la configuración. */
function allIds(mode) {
  const everything = sanitizeConfig({
    mode, clef: 'both', ledger: true, accidentals: true,
    chordTypes: READING_CHORD_TYPES, chordRoots: 'all', inversions: true,
  });
  return mode === 'chords' ? chordIds(everything) : noteIds(everything);
}

function renderProgress() {
  const chords = reader.config.mode === 'chords';
  els.progressIntro.textContent = chords
    ? 'Cada celda es un acorde de una clave. El color es su caja de repetición (si practicaste '
      + 'varias inversiones, la más baja): los de la caja 1 aparecen a menudo; los de la caja 5 '
      + 'ya los lees rápido y salen poco. Los apagados no entran con la configuración actual.'
    : 'Cada celda es una nota de una clave. El color indica su caja de repetición: las de la '
      + 'caja 1 aparecen a menudo; las de la caja 5 ya las lees rápido y salen poco. '
      + 'Las apagadas no entran con la configuración actual.';
  els.legend.innerHTML = ['Sin practicar', 'Caja 1', 'Caja 2', 'Caja 3', 'Caja 4', 'Caja 5']
    .map((text, box) => `<span><i class="cell" data-box="${box}"></i>${text}</span>`)
    .join('');
  const active = new Set(reader.activeIds());
  els.progressMaps.innerHTML = CLEFS.map((clef) => (chords ? chordMap : noteMap)(clef, active)).join('');

  const ids = allIds(reader.config.mode);
  const practiced = ids.filter((id) => reader.items[id]).length;
  const mastered = ids.filter((id) => reader.items[id]?.box === MAX_BOX).length;
  const what = chords ? 'Acordes (clave + inversión)' : 'Notas';
  els.progressSummary.textContent = `${what} practicados: ${practiced} de ${ids.length} · `
    + `Dominados (caja ${MAX_BOX}): ${mastered} · En rotación ahora: ${active.size}`;
}

bus.on('progress:reset', renderProgress);

els.resetBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todo el progreso de lectura (notas y acordes)? No se puede deshacer.')) reader.resetProgress();
});

/* ---------------- Botones y atajos ---------------- */

bindSoundToggle(els.soundToggle);
onButton(els.mainBtn, mainAction);
onButton(els.namesBtn, toggleNames);
onButton(els.clearBtn, () => reader.clear());

bindShortcuts({
  canvas: els.canvas,
  isPaused: () => reader.paused,
  togglePause: () => reader.togglePause(),
  keys: {
    Enter: mainAction,
    Escape: () => reader.clear(),
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
