/*
 * Módulo 5: Intervalos y escalas (reconocer en el pentagrama y de oído).
 *
 * Este archivo solo CONECTA piezas:
 *   recognizer (lógica, js/recognize.js) ──eventos──► pizarra, teclas, sonido, botones y paneles
 *   botones de respuesta (js/choices.js) ──► recognizer.choose(id)
 *   clic en el canvas ──► recognizer.noteOn(midi)   (lo mismo que hará el MIDI)
 * Al acertar se pasa solo al siguiente; al fallar se espera Enter para mirar el error.
 */
import { EventBus } from '../../js/events.js';
import {
  Recognizer, RECOGNIZE_INTERVALS, RECOGNIZE_SCALES, INTERVAL_GROUPS, FORMS, SCALE_SHORT,
  intervalShort, intervalName,
  intervalIds, scaleIds, intervalId, scaleId, sanitizeConfig, semitoneName, scaleLabel,
  EAR_FROM,
} from '../../js/recognize.js';
import {
  INTERVALS, SCALE_TYPES, SCALE_GROUPS, ROOTS, displayNote, displayDegree, spellScaleVoicing,
  intervalSemitones,
} from '../../js/theory.js';
import { describeDifferences, compareNotes } from '../../js/explorer.js';
import { spellExtras } from '../../js/reading.js';
import { MAX_BOX } from '../../js/srs.js';
import { load, save } from '../../js/storage.js';
import {
  playNote, playChord, playSequence, stopPlayback, audioRunning,
} from '../../js/audio.js';
import { createStage, bindShortcuts, onButton, bindSoundToggle, setupSideTools } from '../../js/shell.js';
import { mountCircleOfFifths } from '../../js/fifths.js';
import { createChoices } from '../../js/choices.js';
import { MARK, RANGES, KB_SPAN } from '../../js/layers/piano.js';
import { RecognizeUiLayer } from '../../js/layers/recognize-ui.js';

/** Pausa tras un acierto antes del siguiente (se alcanza a ver el verde y el nombre). */
const AUTO_NEXT_MS = { intervals: 1200, scales: 1600 };

const $ = (id) => document.getElementById(id);
const els = {
  header: document.querySelector('.site-header'),
  stage: $('stage'),
  canvas: $('screen'),
  answerBar: $('answer-bar'),
  choices: $('choices'),
  playHint: $('play-hint'),
  controls: $('controls'),
  namesBtn: $('names-btn'),
  clearBtn: $('clear-btn'),
  listenBtn: $('listen-btn'),
  mainBtn: $('main-btn'),
  feedback: $('feedback'),
  soundToggle: $('sound-toggle'),
  score: $('stat-score'),
  streak: $('stat-streak'),
  avg: $('stat-avg'),
  intervalPanel: $('interval-panel'),
  intervalOptions: $('interval-options'),
  intervalCount: $('interval-count'),
  scalePanel: $('scale-panel'),
  scaleOptions: $('scale-options'),
  scaleCount: $('scale-count'),
  legend: $('legend'),
  progressIntro: $('progress-intro'),
  progressSummary: $('progress-summary'),
  progressMaps: $('progress-maps'),
  resetBtn: $('reset-btn'),
};

/* ---------------- Piezas ---------------- */

mountCircleOfFifths(els.header.querySelector('.container'));
const setNamesButton = setupSideTools({ names: els.namesBtn, listen: els.listenBtn });

const bus = new EventBus();
const rec = new Recognizer({ bus });
const stage = createStage({
  canvas: els.canvas,
  stage: els.stage,
  reserved: () => els.header.offsetHeight + els.answerBar.offsetHeight + els.controls.offsetHeight + 40,
  isPaused: () => rec.paused,
  onNote: (midi) => rec.noteOn(midi, 'screen'),
  onRangeChange: updateHint,
});
const { piano, scene } = stage;
scene.set('ui', new RecognizeUiLayer(bus, rec));

const choices = createChoices(els.choices, (id) => {
  if (!rec.paused) rec.choose(id);
});

const current = () => rec.current;
const isScalePlay = () => rec.isScalePlay();

/* ---------------- Teclado ---------------- */

/** Notas dadas (doradas) mientras se pregunta en la prueba 'play'. */
function givenMidis() {
  const c = current();
  if (!c || c.test !== 'play') return [];
  return c.family === 'scales' ? [c.given.midi, c.target.midi] : [c.given.midi];
}

/** La flecha brilla si una nota dada está en otra ventana (antes de responder no hay más pistas). */
function updateHint() {
  const midis = rec.phase === 'answered' ? [] : givenMidis();
  piano.setArrowHint(midis.some((m) => m < piano.from), midis.some((m) => m > piano.to));
}

/** Ventana del teclado donde caben todas estas notas (la actual si ya caben). */
function showWindowFor(midis) {
  if (!midis.length) return;
  const fits = (from) => midis.every((m) => m >= from && m <= from + KB_SPAN);
  if (fits(piano.from)) return;
  const from = RANGES.find(fits);
  if (from != null) piano.setRange(from);
}

bus.on('exercise:new', () => {
  piano.setSelected([]);
  const marks = new Map(givenMidis().map((m) => [m, MARK.ROOT]));
  piano.setMarks(marks);
  updateHint();
});
bus.on('selection:change', ({ notes }) => piano.setSelected(notes));

/** Tras responder: lo que sonó en las teclas (nombres en intervalos, funciones en escalas). */
function showOnKeys(d, correct) {
  const marks = new Map();
  const labels = new Map();
  if (d.family === 'intervals') {
    marks.set(d.given.midi, MARK.ROOT);
    labels.set(d.given.midi, displayNote(d.given.name));
    if (d.test === 'play' && !correct) {
      marks.set(d.played, MARK.WRONG);
      labels.set(d.played, displayNote(d.playedPitch.name));
    }
    marks.set(d.target.midi, correct ? MARK.CORRECT : MARK.MISSING);
    labels.set(d.target.midi, displayNote(d.target.name));
  } else {
    const missing = new Set(d.test === 'play' ? d.result.missing.map((p) => p.midi) : []);
    d.pitches.forEach((p, i) => {
      const edge = i === 0 || i === d.pitches.length - 1;
      let mark = MARK.CORRECT;
      if (edge) mark = MARK.ROOT;
      else if (missing.has(p.midi) || (d.test !== 'play' && !correct)) mark = MARK.MISSING;
      marks.set(p.midi, mark);
      labels.set(p.midi, displayDegree(p.degree === '8' ? '1' : p.degree));
    });
    if (d.test === 'play') {
      spellExtras(d.result.extra, d.pitches).forEach((p) => {
        marks.set(p.midi, MARK.WRONG);
        labels.set(p.midi, displayNote(p.name));
      });
    }
  }
  piano.setSelected([]);
  showWindowFor([...marks.keys()]);
  piano.setMarks(marks, labels);
}

/* ---------------- Sonido ---------------- */

bus.on('note:on', ({ midi }) => playNote(midi));

/** Toca lo del ejercicio actual: el intervalo (seguido o junto) o la escala subiendo. */
function playCurrent() {
  const c = current();
  if (!c) return;
  stopPlayback(); // apretar varias veces no amontona sonidos
  const midis = c.pitches.map((p) => p.midi);
  if (c.family === 'scales') playSequence(midis, { step: 0.35, duration: 0.7 });
  else if (c.form === 'harm') playChord(midis, { strum: 0, duration: 1.8 });
  else playSequence(midis, { step: 0.75, duration: 1.1 });
}

/**
 * Espacio: lo que se oye se puede repetir siempre; lo escrito solo después de responder
 * (antes, oírlo ayudaría a reconocerlo sin leerlo).
 */
function listenAction() {
  const c = current();
  if (rec.paused || !c) return;
  if (c.test === 'staff' && rec.phase !== 'answered') return;
  playCurrent();
}

bus.on('exercise:new', (c) => {
  stopPlayback();
  // Lo que se oye suena solo al plantearse (si el audio ya se encendió con algún clic).
  if (c.test !== 'staff' && audioRunning()) playCurrent();
});

/* ---------------- Respuesta y paso al siguiente ---------------- */

let autoNext = null;
let lastCorrect = false;
let autoNextMs = 0;

function cancelAutoNext() {
  clearTimeout(autoNext);
  autoNext = null;
}

function scheduleAutoNext() {
  cancelAutoNext();
  autoNext = setTimeout(() => {
    autoNext = null;
    if (!rec.paused && rec.phase === 'answered') rec.next();
  }, autoNextMs);
}

/** Respuesta correcta para los botones. */
function correctAnswers(d) {
  return [d.family === 'scales' ? d.scale : d.interval];
}

function onAnswer(d, correct) {
  lastCorrect = correct;
  showOnKeys(d, correct);
  if (d.test !== 'play') choices.reveal(correctAnswers(d), d.answer);
  // Lo escrito suena al responder (se une lo leído con lo que se oye); lo oído, si se falló.
  const sound = d.test === 'staff' || !correct;
  if (sound) playCurrent();
  autoNextMs = AUTO_NEXT_MS[d.family] + (sound && d.family === 'scales' ? 1400 : 0);
  updateHint();
  renderFeedback(d, correct);
  renderSession(d.session);
  renderProgress();
  renderButtons();
  if (correct) scheduleAutoNext();
}
bus.on('answer:correct', (d) => onAnswer(d, true));
bus.on('answer:wrong', (d) => onAnswer(d, false));

bus.on('exercise:new', () => {
  cancelAutoNext();
  els.feedback.hidden = true;
  renderChoices();
  renderButtons();
});

/** Enter: en una escala tocada, comprobar; después de responder, siguiente. */
function mainAction() {
  if (rec.paused) return;
  if (rec.phase === 'answered') rec.next();
  else if (isScalePlay()) rec.submit();
}

/* ---------------- Botones de respuesta ---------------- */

const intervalLabel = intervalShort;
const capital = (text) => text[0].toUpperCase() + text.slice(1);

/**
 * Siempre las 12 opciones (2 filas de 6), en el orden de la teoría, aunque no todas estén
 * en rotación: las respuestas no cambian de lugar entre ejercicios ni al configurar.
 */
function renderChoices() {
  const c = current();
  const byName = c && c.test !== 'play';
  els.choices.hidden = !byName;
  els.playHint.hidden = byName;
  if (!byName) {
    els.playHint.innerHTML = c?.family === 'scales'
      ? 'Marca en el piano las notas entre las dos doradas y confirma con <kbd>Enter</kbd>.'
      : 'Toca en el piano la otra nota del intervalo (la dorada es la primera).';
    return;
  }
  const { config } = rec;
  const options = config.family === 'scales'
    ? RECOGNIZE_SCALES.map((id) => ({ id, label: capital(SCALE_SHORT[id]), title: SCALE_TYPES[id].name }))
    : RECOGNIZE_INTERVALS.map((id) => ({ id, label: intervalLabel(id), title: intervalName(id) }));
  choices.set(options);
  choices.setDisabled(rec.paused || rec.phase === 'answered');
}

/* ---------------- Paneles HTML ---------------- */

const pitchLabel = (p) => displayNote(p.name) + p.octave;
const semis = (a, b) => Math.abs(b.midi - a.midi);

function formatSeconds(ms) {
  const s = (ms / 1000).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${s} s`;
}

/** Explicación solo tras un error (al acertar se pasa solo al siguiente). */
function renderFeedback(d, correct) {
  if (correct) {
    els.feedback.hidden = true;
    return;
  }
  const body = d.family === 'scales' ? scaleFeedback(d) : intervalFeedback(d);
  els.feedback.className = 'panel feedback is-wrong';
  els.feedback.innerHTML = `${body}
    <p class="small muted">Tiempo ${formatSeconds(d.timeMs)}. Vuelve a la caja 1: aparecerá pronto de nuevo.
      Escúchalo otra vez con <kbd>Espacio</kbd> y sigue con <kbd>Enter</kbd>.</p>`;
  els.feedback.hidden = false;
}

function intervalFeedback(d) {
  const { name, short } = INTERVALS[d.spelled];
  const [first, second] = d.pitches;
  const lines = [`<li>De ${pitchLabel(first)} a ${pitchLabel(second)}: ${semis(first, second)} semitonos.</li>`];
  if (d.test === 'play') {
    const dir = d.played > d.given.midi ? 'arriba' : 'abajo';
    lines.push(`<li>Tocaste ${pitchLabel(d.playedPitch)}: desde ${pitchLabel(d.given)} eso es
      ${semitoneName(d.played - d.given.midi)} hacia ${dir} (${Math.abs(d.played - d.given.midi)} semitonos).</li>`);
    if (d.played % 12 === d.target.midi % 12) lines.push('<li>Era la nota correcta, pero en otra octava.</li>');
  } else {
    const semitones = intervalSemitones(d.answer === 'TT' ? 'A4' : d.answer);
    lines.push(`<li>Elegiste ${intervalShort(d.answer)} (${intervalName(d.answer).toLowerCase()}): ${semitones} semitonos.</li>`);
  }
  if (d.interval === 'TT') {
    lines.push('<li>Es el tritono: se escribe como 4A (C–F♯) o como 5d (C–G♭), suena igual y es el mismo botón.</li>');
  }
  return `
    <p class="feedback-title">Era ${short} <span class="muted small">(${name.toLowerCase()})</span></p>
    <ul class="miss-list">${lines.join('')}</ul>`;
}

function noteChips(pitches, missing = new Set()) {
  return pitches.map((p) => `<li${missing.has(p.midi) ? ' class="is-missing"' : ''}>
    <span class="note">${pitchLabel(p)}</span><span class="degree">${displayDegree(p.degree === '8' ? '1' : p.degree)}</span></li>`).join('');
}

function scaleFeedback(d) {
  const title = `<p class="feedback-title">Era ${scaleLabel(d.root, d.scale)}
    <span class="muted small">(${SCALE_TYPES[d.scale].name.toLowerCase()})</span></p>`;
  if (d.test === 'play') {
    const missing = new Set(d.result.missing.map((p) => p.midi));
    const extras = spellExtras(d.result.extra, d.pitches);
    const lines = [];
    if (d.result.missing.length) lines.push(`<li>Faltó: ${d.result.missing.map((p) => `${pitchLabel(p)} (${displayDegree(p.degree)})`).join(', ')}.</li>`);
    if (extras.length) lines.push(`<li>Sobró: ${extras.map(pitchLabel).join(', ')}.</li>`);
    return `${title}<ul class="chord-notes">${noteChips(d.pitches, missing)}</ul><ul class="miss-list">${lines.join('')}</ul>`;
  }
  // Por nombre: en qué se diferencia de la elegida (sobre la misma tónica), como en el Explorador.
  const a = d.pitches;
  const b = spellScaleVoicing(d.root, d.answer, a[0].midi);
  const diff = describeDifferences(a, b, compareNotes(a, b));
  const nameA = SCALE_SHORT[d.scale];
  const nameB = SCALE_SHORT[d.answer];
  const deg = (n) => displayDegree(n.degree);
  const lines = [];
  if (diff.swaps.length) {
    lines.push(`<li>${capital(nameA)} tiene ${diff.swaps.map((s) => deg(s.a)).join(', ')} donde ${nameB} tiene ${diff.swaps.map((s) => deg(s.b)).join(', ')}.</li>`);
  }
  if (diff.onlyA.length) lines.push(`<li>${capital(nameA)} tiene además ${diff.onlyA.map(deg).join(', ')}.</li>`);
  if (diff.onlyB.length) lines.push(`<li>${capital(nameB)} tiene además ${diff.onlyB.map(deg).join(', ')}.</li>`);
  return `${title}<ul class="chord-notes">${noteChips(a)}</ul>
    <p class="small">Elegiste ${nameB}.</p><ul class="miss-list">${lines.join('')}</ul>`;
}

function renderSession(s = rec.session) {
  els.score.textContent = `${s.correct}/${s.attempts}`;
  els.streak.textContent = s.streak;
  els.avg.textContent = s.correct ? formatSeconds(s.correctMs / s.correct) : '–';
}

function renderButtons() {
  const answered = rec.phase === 'answered';
  const scalePlay = isScalePlay();
  els.mainBtn.innerHTML = `${scalePlay && !answered ? 'Comprobar' : 'Siguiente'} <kbd>Enter</kbd>`;
  els.mainBtn.disabled = rec.paused || (!answered && !scalePlay);
  els.listenBtn.disabled = rec.paused || !current() || (current().test === 'staff' && !answered);
  els.clearBtn.hidden = !scalePlay;
  els.clearBtn.disabled = rec.paused || answered;
  choices.setDisabled(rec.paused || answered);
  const options = document.querySelectorAll('[data-family], [data-source], [data-answer-mode], [data-form], [data-accidentals], [data-roots], [data-clef]');
  for (const b of [els.namesBtn, ...options]) b.disabled = rec.paused;
}

/* ---------------- Configuración ---------------- */

function chip(name, value, label, checked, title = '') {
  return `<label class="chip"${title ? ` title="${title}"` : ''}>
    <input type="checkbox" name="${name}" value="${value}"${checked ? ' checked' : ''}>
    <span>${label}</span></label>`;
}

function pressed(selector, attr, value) {
  document.querySelectorAll(selector).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value))));
}

function renderConfig() {
  const { config } = rec;
  const scales = config.family === 'scales';
  pressed('[data-family]', 'family', config.family);
  pressed('[data-source]', 'source', config.source);
  pressed('[data-answer-mode]', 'answerMode', config.answer);
  pressed('[data-form]', 'form', config.form);
  pressed('[data-accidentals]', 'accidentals', config.accidentals);
  pressed('[data-roots]', 'roots', config.roots);
  pressed('[data-clef]', 'clef', config.clef);
  // Sin oído, elegir cómo responder lo que se oye no tiene efecto.
  document.querySelectorAll('[data-answer-mode]').forEach((b) => { b.hidden = config.source === 'staff'; });
  els.intervalPanel.hidden = scales;
  els.scalePanel.hidden = !scales;

  els.intervalOptions.innerHTML = Object.entries(INTERVAL_GROUPS).map(([group, ids]) => {
    const chips = ids.map((id) => chip('interval', id, intervalLabel(id), config.intervals.includes(id), intervalName(id))).join('');
    return `<fieldset class="option-group"><legend>${group}</legend><div class="chips">${chips}</div></fieldset>`;
  }).join('');
  els.intervalCount.textContent = `${intervalIds(config).length} ejercicios en rotación (intervalo × forma × prueba).`;

  const groups = [...new Set(RECOGNIZE_SCALES.map((t) => SCALE_TYPES[t].group))];
  els.scaleOptions.innerHTML = groups.map((group) => {
    const chips = RECOGNIZE_SCALES.filter((t) => SCALE_TYPES[t].group === group)
      .map((t) => chip('scale', t, capital(SCALE_SHORT[t]), config.scales.includes(t), SCALE_TYPES[t].name))
      .join('');
    return `<fieldset class="option-group"><legend>${SCALE_GROUPS[group]}</legend><div class="chips">${chips}</div></fieldset>`;
  }).join('');
  els.scaleCount.textContent = `${scaleIds(config).length} ejercicios en rotación (en el pentagrama, cada tónica cuenta aparte). `
    + 'Solo entran las que se escriben sin dobles alteraciones (D♭ menor no: tendría B𝄫).';
}

function setConfig(change) {
  if (rec.paused) return;
  rec.setConfig({ ...rec.config, ...change });
}

document.querySelectorAll('[data-family]').forEach((b) => onButton(b, () => setConfig({ family: b.dataset.family })));
document.querySelectorAll('[data-source]').forEach((b) => onButton(b, () => setConfig({ source: b.dataset.source })));
document.querySelectorAll('[data-answer-mode]').forEach((b) => onButton(b, () => setConfig({ answer: b.dataset.answerMode })));
document.querySelectorAll('[data-form]').forEach((b) => onButton(b, () => setConfig({ form: b.dataset.form })));
document.querySelectorAll('[data-accidentals]').forEach((b) => onButton(b, () => setConfig({ accidentals: b.dataset.accidentals === 'true' })));
document.querySelectorAll('[data-roots]').forEach((b) => onButton(b, () => setConfig({ roots: b.dataset.roots })));
document.querySelectorAll('[data-clef]').forEach((b) => onButton(b, () => setConfig({ clef: b.dataset.clef })));

/** Casillas de qué entra: al menos una marcada (y nada cambia en pausa). */
function bindChecklist(container, key) {
  container.addEventListener('change', (event) => {
    const input = event.target;
    if (input.type !== 'checkbox') return;
    const values = [...container.querySelectorAll('input:checked')].map((i) => i.value);
    if (!values.length || rec.paused) {
      input.checked = !input.checked;
      return;
    }
    setConfig({ [key]: values });
  });
}
bindChecklist(els.intervalOptions, 'intervals');
bindChecklist(els.scaleOptions, 'scales');

bus.on('config:change', () => {
  renderConfig();
  renderChoices();
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
  if (rec.paused) return;
  showNames = !showNames;
  save('showNames', showNames);
  renderNamesToggle();
}

/* ---------------- Progreso ---------------- */

const TESTS = [
  ['staff', 'Pentagrama'],
  ['ear', 'Oído (nombrar)'],
  ['play', 'Oído (tocar)'],
];
const FORM_LABEL = { asc: '↑', desc: '↓', harm: 'juntas' };

function cell(ids, title, active) {
  const practiced = ids.map((id) => rec.items[id]).filter(Boolean);
  const box = practiced.length ? Math.min(...practiced.map((item) => item.box)) : 0;
  const off = ids.some((id) => active.has(id)) ? '' : ' is-off';
  const detail = practiced.length
    ? `caja ${box} · ${practiced.reduce((n, i) => n + i.correct, 0)}/${practiced.reduce((n, i) => n + i.attempts, 0)} aciertos`
    : 'sin practicar';
  return `<div class="cell${off}" data-box="${box}" title="${title} · ${detail}"></div>`;
}

/** Intervalos: una cuadrícula por prueba; filas = forma, columnas = intervalos. */
function intervalMaps(active) {
  return TESTS.map(([test, label]) => {
    let html = `<div class="head"></div>${RECOGNIZE_INTERVALS.map((id) => `<div class="head">${intervalLabel(id)}</div>`).join('')}`;
    for (const form of FORMS) {
      html += `<div class="head row-head">${FORM_LABEL[form]}</div>`;
      for (const id of RECOGNIZE_INTERVALS) html += cell([intervalId(test, id, form)], `${intervalLabel(id)} ${FORM_LABEL[form]}`, active);
    }
    return `<h3 class="map-title">${label}</h3>
      <div class="progress-scroll"><div class="note-grid interval-grid" style="--cols:${RECOGNIZE_INTERVALS.length}">${html}</div></div>`;
  }).join('');
}

/** Escalas: en el pentagrama, filas = escalas y columnas = tónicas; de oído, una fila por prueba. */
function scaleMaps(active) {
  let staff = `<div class="head"></div>${ROOTS.map((r) => `<div class="head">${displayNote(r)}</div>`).join('')}`;
  for (const scale of RECOGNIZE_SCALES) {
    staff += `<div class="head row-head" title="${SCALE_TYPES[scale].name}">${capital(SCALE_SHORT[scale])}</div>`;
    for (const root of ROOTS) staff += cell([scaleId('staff', scale, root)], scaleLabel(root, scale), active);
  }
  let ear = `<div class="head"></div>${['Nombrar', 'Tocar'].map((t) => `<div class="head">${t}</div>`).join('')}`;
  for (const scale of RECOGNIZE_SCALES) {
    ear += `<div class="head row-head">${capital(SCALE_SHORT[scale])}</div>`;
    for (const test of ['ear', 'play']) ear += cell([scaleId(test, scale)], `${SCALE_SHORT[scale]} de oído`, active);
  }
  return `<h3 class="map-title">Pentagrama</h3>
    <div class="progress-scroll"><div class="note-grid scale-grid" style="--cols:${ROOTS.length}">${staff}</div></div>
    <h3 class="map-title">Oído</h3>
    <div class="progress-scroll"><div class="note-grid scale-grid ear-grid" style="--cols:2">${ear}</div></div>`;
}

/** Todo lo que existe en la familia (para contar lo practicado), sea cual sea la configuración. */
function allIds(family) {
  const ids = [];
  for (const answer of ['name', 'play']) {
    const everything = sanitizeConfig({
      family, source: 'both', answer, form: 'mix', clef: 'both', accidentals: true,
      intervals: RECOGNIZE_INTERVALS, scales: RECOGNIZE_SCALES, roots: 'all',
    });
    ids.push(...(family === 'scales' ? scaleIds(everything) : intervalIds(everything)));
  }
  return [...new Set(ids)];
}

function renderProgress() {
  const scales = rec.config.family === 'scales';
  els.progressIntro.textContent = 'Cada celda es un ejercicio; el color es su caja de repetición: los de la '
    + 'caja 1 aparecen a menudo; los de la caja 5 ya los reconoces rápido y salen poco. '
    + 'Los apagados no entran con la configuración actual.';
  els.legend.innerHTML = ['Sin practicar', 'Caja 1', 'Caja 2', 'Caja 3', 'Caja 4', 'Caja 5']
    .map((text, box) => `<span><i class="cell" data-box="${box}"></i>${text}</span>`)
    .join('');
  const active = new Set(rec.activeIds());
  els.progressMaps.innerHTML = scales ? scaleMaps(active) : intervalMaps(active);

  const ids = allIds(rec.config.family);
  const practiced = ids.filter((id) => rec.items[id]).length;
  const mastered = ids.filter((id) => rec.items[id]?.box === MAX_BOX).length;
  els.progressSummary.textContent = `${scales ? 'Escalas' : 'Intervalos'}: practicados ${practiced} de ${ids.length} · `
    + `Dominados (caja ${MAX_BOX}): ${mastered} · En rotación ahora: ${active.size}`;
}

bus.on('progress:reset', renderProgress);

els.resetBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todo el progreso de intervalos y escalas? No se puede deshacer.')) rec.resetProgress();
});

/* ---------------- Botones y atajos ---------------- */

bindSoundToggle(els.soundToggle);
onButton(els.mainBtn, mainAction);
onButton(els.listenBtn, listenAction);
onButton(els.namesBtn, toggleNames);
onButton(els.clearBtn, () => rec.clear());

// Las respuestas no tienen atajos de teclado: se eligen con clic.
const keys = {
  Enter: mainAction,
  Escape: () => rec.clear(),
  ' ': listenAction,
  n: toggleNames,
  ArrowLeft: () => stage.shiftRange(-1),
  ArrowRight: () => stage.shiftRange(1),
};

bindShortcuts({
  canvas: els.canvas,
  isPaused: () => rec.paused,
  togglePause: () => rec.togglePause(),
  keys,
});

/* ---------------- Pausa (atajo P, sin botón en pantalla) ---------------- */

bus.on('pause:change', ({ paused }) => {
  if (paused) {
    cancelAutoNext();
    stopPlayback();
  } else if (rec.phase === 'answered' && lastCorrect) {
    scheduleAutoNext();
  }
  renderButtons();
});

/* ---------------- Inicio ---------------- */

piano.setRange(EAR_FROM); // lo que se oye está en C4–C6
renderNamesToggle();
renderConfig();
renderSession();
renderProgress();
rec.next();
stage.start();
