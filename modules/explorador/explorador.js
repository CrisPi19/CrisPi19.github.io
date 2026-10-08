/*
 * Módulo 3: Explorador.
 *
 * Eliges un acorde o una escala (tónica + tipo) y se muestran a la vez, con las MISMAS
 * notas: las teclas marcadas con su función, el pentagrama y el sonido.
 * "Comparar con…" pone al lado otro tipo sobre la misma tónica y colorea lo que cambia
 * (p. ej. D lidio frente a D mayor: solo cambia el 4.º grado, G♯ ↔ G).
 *
 * No es un ejercicio: no hay respuestas, cronómetro ni repetición espaciada. Este archivo
 * solo conecta piezas; la lógica está en js/explorer.js.
 */
import { EventBus } from '../../js/events.js';
import {
  ROOTS, CHORD_GROUPS, SCALE_GROUPS, SCALE_TYPES, displayNote, displayDegree,
} from '../../js/theory.js';
import {
  CLEF_RANGE, STATUS, SUGGESTED_COMPARE, typesOf, itemName, itemNotes, compareNotes,
  plainStatus, stepType, describeDifferences,
} from '../../js/explorer.js';
import { load, save } from '../../js/storage.js';
import { playNote, playChord, playSequence, stopPlayback } from '../../js/audio.js';
import { createStage, bindShortcuts, onButton, bindSoundToggle } from '../../js/shell.js';
import { MARK } from '../../js/layers/piano.js';
import { ExplorerUiLayer } from '../../js/layers/explorer-ui.js';
import { Staff } from '../../js/staff.js';
import { C } from '../../js/engine/palette.js';

const $ = (id) => document.getElementById(id);
const els = {
  header: document.querySelector('.site-header'),
  stage: $('stage'),
  canvas: $('screen'),
  controls: $('controls'),
  rootSelect: $('root-select'),
  typeSelect: $('type-select'),
  compareSelect: $('compare-select'),
  namesBtn: $('names-btn'),
  listenBtn: $('listen-btn'),
  soundToggle: $('sound-toggle'),
  staffRow: $('staff-row'),
  cardA: $('card-a'),
  cardB: $('card-b'),
  typeLabel: $('type-label'),
  viewBtn: $('view-btn'),
  captionA: $('caption-a'),
  captionB: $('caption-b'),
  compareInfo: $('compare-info'),
};

/* ---------------- Estado (se recuerda entre visitas) ---------------- */

const DEFAULT_STATE = { kind: 'scale', root: 'D', type: 'lydian', compare: 'major', clef: 'treble' };

function sanitize(s) {
  const st = { ...DEFAULT_STATE, ...(s && typeof s === 'object' ? s : {}) };
  if (!['chord', 'scale'].includes(st.kind)) st.kind = DEFAULT_STATE.kind;
  const types = typesOf(st.kind);
  if (!ROOTS.includes(st.root)) st.root = DEFAULT_STATE.root;
  if (!types[st.type]) st.type = Object.keys(types)[0];
  if (st.compare !== null && (!types[st.compare] || st.compare === st.type)) st.compare = null;
  if (!CLEF_RANGE[st.clef]) st.clef = DEFAULT_STATE.clef;
  return st;
}

let state = sanitize(load('explorador.state', DEFAULT_STATE));
let paused = false;

/* ---------------- Piezas ---------------- */

const bus = new EventBus(); // 'explore:change' y 'pause:change' (para las mascotas, más adelante)
const stage = createStage({
  canvas: els.canvas,
  stage: els.stage,
  reserved: () => els.header.offsetHeight + els.controls.offsetHeight + els.staffRow.offsetHeight + 48,
  isPaused: () => paused,
  onNote: (midi) => playNote(midi),
});
const { piano, scene } = stage;
const ui = new ExplorerUiLayer();
scene.set('ui', ui);
const staffA = new Staff($('staff-a'));
const staffB = new Staff($('staff-b'));

/* ---------------- Qué se muestra ---------------- */

/*
 * Colores: lo explorado en azul, lo comparado en cian y la tónica en dorado (en las dos).
 * Una tecla que está en los dos va partida (mitad azul, mitad cian). Solo lo explorado
 * lleva números (su función: 1, ♭3, ♯4…); lo comparado se reconoce por el color.
 */
const COLOR_A = C.NIGHT_3;
const COLOR_B = C.FX_CYAN;

/** Función en la tecla: 1, ♭3, ♯4… (la tónica de arriba de una escala también es 1). */
const keyLabel = (degree) => displayDegree(degree === '8' ? '1' : degree);

let current = null; // lo que se ve y suena: { a: { item, notes } | null, b: … | null }
/** Vista al comparar: 'both' (Ambas), 'a' (solo mi escala/acorde) o 'b' (solo lo comparado). */
let view = 'both';
const VIEWS = ['both', 'a', 'b'];

function render() {
  const itemA = { kind: state.kind, root: state.root, type: state.type };
  const notesA = itemNotes(itemA, state.clef);
  const itemB = state.compare ? { ...itemA, type: state.compare } : null;
  const notesB = itemB ? itemNotes(itemB, state.clef) : null;
  const cmp = notesB ? compareNotes(notesA, notesB) : { a: plainStatus(notesA), b: [] };

  // Qué se ve al comparar: los dos, solo "mi escala/acorde" (A) o solo lo comparado (B).
  const v = notesB ? view : 'a';
  const showA = v !== 'b';
  const showB = Boolean(notesB) && v !== 'a';

  // Teclado: primero lo que se ve de B (cian, sin número); después A encima.
  const marks = new Map();
  const labels = new Map();
  if (showB) {
    notesB.forEach((n, i) => {
      if (cmp.b[i] === STATUS.ROOT) marks.set(n.midi, MARK.ROOT);
      else if (!showA || cmp.b[i] === STATUS.ONLY_B) marks.set(n.midi, MARK.OTHER);
    });
  }
  if (showA) {
    notesA.forEach((n, i) => {
      let mark = MARK.TONE;
      if (cmp.a[i] === STATUS.ROOT) mark = MARK.ROOT;
      else if (showB && cmp.a[i] === STATUS.COMMON) mark = MARK.BOTH;
      marks.set(n.midi, mark);
      labels.set(n.midi, keyLabel(n.degree));
    });
  }
  piano.setRange(CLEF_RANGE[state.clef]);
  piano.setMarks(marks, labels);

  // Pentagrama(s): mismas notas que las teclas. Sin comparar, notas en marfil (lo más
  // legible) y tónica dorada; comparando, cada pentagrama con el color de su ítem.
  const mode = state.kind === 'scale' ? 'sequence' : 'chord';
  const colorsOf = (statuses, color) => Object.fromEntries(statuses.flatMap((st, i) => {
    if (st === STATUS.ROOT) return [[i, C.FX_GOLD]];
    return color != null ? [[i, color]] : [];
  }));
  els.cardA.hidden = !showA;
  if (showA) {
    staffA.render({
      notes: notesA, mode, clef: state.clef, labels: mode === 'sequence',
      colors: colorsOf(cmp.a, notesB ? COLOR_A : null),
    });
    els.captionA.textContent = itemName(itemA);
  }
  els.cardB.hidden = !showB;
  if (showB) {
    staffB.render({ notes: notesB, mode, clef: state.clef, labels: false, colors: colorsOf(cmp.b, COLOR_B) });
    els.captionB.textContent = itemName(itemB);
  }

  // En el canvas, una línea dice qué se está viendo cuando se aísla una de las dos.
  const mine = state.kind === 'scale' ? 'mi escala' : 'mi acorde';
  if (v === 'b') ui.set(itemB, notesB, null, { color: COLOR_B, note: 'comparación' });
  else if (notesB && v === 'a') ui.set(itemA, notesA, null, { color: COLOR_A, note: mine });
  else ui.set(itemA, notesA, notesB ? { name: itemName(itemB) } : null);
  current = {
    a: showA ? { item: itemA, notes: notesA } : null,
    b: showB ? { item: itemB, notes: notesB } : null,
  };
  renderCompareInfo(itemA, notesA, itemB, notesB, cmp);
  renderControls();
  save('explorador.state', state);
  stage.fit(); // el alto de los pentagramas cambia lo que queda para el canvas
  bus.emit('explore:change', { a: itemA, b: itemB, clef: state.clef });
}

const noteText = (n) => `${displayDegree(n.degree)} (${displayNote(n.name)})`;
const list = (notes) => notes.map(noteText).join(', ');

function renderCompareInfo(itemA, notesA, itemB, notesB, cmp) {
  els.compareInfo.hidden = !itemB;
  if (!itemB) return;
  const nameA = `<span class="tag-a">${itemName(itemA)}</span>`;
  const nameB = `<span class="tag-b">${itemName(itemB)}</span>`;
  const { swaps, onlyA, onlyB } = describeDifferences(notesA, notesB, cmp);

  const lines = swaps.map(({ a, b }) => `<p>${nameA} tiene ${noteText(a)} donde ${nameB} tiene ${noteText(b)}.</p>`);
  if (onlyA.length) lines.push(`<p>Solo ${nameA} tiene ${list(onlyA)}.</p>`);
  if (onlyB.length) lines.push(`<p>Solo ${nameB} tiene ${list(onlyB)}.</p>`);
  if (!lines.length) lines.push('<p>Tienen las mismas notas.</p>');

  els.compareInfo.innerHTML = `
    <div class="legend">
      <span><i class="swatch a"></i>${itemName(itemA)}</span>
      <span><i class="swatch b"></i>${itemName(itemB)}</span>
      <span><i class="swatch both"></i>en los dos</span>
      <span><i class="swatch root"></i>tónica</span>
    </div>
    ${lines.join('')}`;
}

/* ---------------- Controles ---------------- */

function groupedOptions(kind, selected, exclude = null) {
  const types = typesOf(kind);
  const groups = kind === 'scale' ? SCALE_GROUPS : CHORD_GROUPS;
  return Object.entries(groups).map(([group, label]) => {
    const options = Object.entries(types)
      .filter(([id, t]) => t.group === group && id !== exclude)
      .map(([id, t]) => {
        const text = kind === 'scale' ? t.name : `${t.symbol.replace('b', '♭') || 'mayor'} · ${t.name}`;
        return `<option value="${id}"${id === selected ? ' selected' : ''}>${text}</option>`;
      }).join('');
    return `<optgroup label="${label}">${options}</optgroup>`;
  }).join('');
}

function renderControls() {
  els.rootSelect.innerHTML = ROOTS.map((r) => `<option value="${r}"${r === state.root ? ' selected' : ''}>${displayNote(r)}</option>`).join('');
  els.typeSelect.innerHTML = groupedOptions(state.kind, state.type);
  const suggested = SUGGESTED_COMPARE[state.kind][state.type];
  els.compareSelect.innerHTML = `<option value="">— nada —</option>${groupedOptions(state.kind, state.compare, state.type)}`;
  // Marca la comparación sugerida (la que más enseña) sin cambiar su orden.
  const opt = els.compareSelect.querySelector(`option[value="${suggested}"]`);
  if (opt) opt.textContent += ' ★';
  document.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === state.kind)));
  document.querySelectorAll('[data-clef]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.clef === state.clef)));
  els.typeLabel.textContent = state.kind === 'scale' ? 'Mi escala' : 'Mi acorde';

  // Botón de vista: "Ambas" → mi escala/acorde → lo comparado → "Ambas"…
  els.viewBtn.hidden = !state.compare;
  if (state.compare) {
    const short = (type) => (state.kind === 'scale'
      ? SCALE_TYPES[type].name
      : itemName({ kind: 'chord', root: state.root, type }));
    const text = { both: 'Ambas', a: short(state.type), b: short(state.compare) }[view];
    els.viewBtn.innerHTML = `${text} <kbd>V</kbd>`;
    els.viewBtn.dataset.view = view;
    els.viewBtn.title = 'Cambia entre ver las dos, solo la tuya o solo la comparada';
  }
}

function update(changes) {
  if (paused) return;
  const next = { ...state, ...changes };
  // Si la comparación está activa y cambia lo explorado, pasa a la sugerida para el tipo
  // nuevo (B9 frente a Bm no enseña nada; B9 frente a B7 sí). Para comparar con otra
  // cosa, se elige después en la lista.
  const itemChanged = next.kind !== state.kind || next.type !== state.type;
  if (state.compare !== null && itemChanged && !('compare' in changes)) {
    next.compare = SUGGESTED_COMPARE[next.kind][next.type];
  }
  const prevCompare = state.compare;
  state = sanitize(next);
  if (state.compare !== prevCompare) view = 'both'; // otra comparación: se vuelve a ver todo
  render();
}

function cycleView() {
  if (paused || !state.compare) return;
  view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
  render();
}

function toggleCompare() {
  update({ compare: state.compare ? null : SUGGESTED_COMPARE[state.kind][state.type] });
}

document.querySelectorAll('[data-kind]').forEach((b) => onButton(b, () => {
  if (b.dataset.kind === state.kind) return;
  update({ kind: b.dataset.kind, type: Object.keys(typesOf(b.dataset.kind))[0] });
}));
document.querySelectorAll('[data-clef]').forEach((b) => onButton(b, () => update({ clef: b.dataset.clef })));

// Las listas sueltan el foco al cambiar, para que los atajos (Espacio, ↑↓…) sigan funcionando.
const onSelect = (select, fn) => select.addEventListener('change', () => {
  fn(select.value);
  select.blur();
});
onSelect(els.rootSelect, (root) => update({ root }));
onSelect(els.typeSelect, (type) => update({ type }));
onSelect(els.compareSelect, (value) => update({ compare: value || null }));

/* ---------------- Sonido ---------------- */

function listen() {
  if (paused || !current) return;
  stopPlayback(); // cada vez empieza de cero: apretar seguido no amontona reproducciones
  // Suena lo que se ve: A, B, o A y luego B.
  const parts = [current.a, current.b].filter(Boolean).map((part) => part.notes.map((n) => n.midi));
  let delay = 0;
  for (const midis of parts) {
    if (state.kind === 'scale') delay += playSequence(midis, { delay }) + 0.6;
    else {
      playChord(midis, { delay });
      delay += 2;
    }
  }
}

/* ---------------- Nombres de notas ---------------- */

let showNames = load('showNames', false) === true;
function renderNamesToggle() {
  piano.setShowNames(showNames);
  els.namesBtn.setAttribute('aria-pressed', String(showNames));
  els.namesBtn.innerHTML = `Nombres: ${showNames ? 'sí' : 'no'} <kbd>N</kbd>`;
}
function toggleNames() {
  if (paused) return;
  showNames = !showNames;
  save('showNames', showNames);
  renderNamesToggle();
}

/* ---------------- Botones, atajos y pausa ---------------- */

bindSoundToggle(els.soundToggle);
onButton(els.listenBtn, listen);
onButton(els.namesBtn, toggleNames);
onButton(els.viewBtn, cycleView);

function togglePause() {
  paused = !paused;
  for (const el of els.controls.querySelectorAll('button, select')) el.disabled = paused;
  bus.emit('pause:change', { paused });
}

bindShortcuts({
  canvas: els.canvas,
  isPaused: () => paused,
  togglePause,
  keys: {
    ' ': listen,
    n: toggleNames,
    c: toggleCompare,
    v: cycleView,
    ArrowUp: () => update({ type: stepType(state.kind, state.type, -1) }),
    ArrowDown: () => update({ type: stepType(state.kind, state.type, 1) }),
    ArrowLeft: () => stage.shiftRange(-1),
    ArrowRight: () => stage.shiftRange(1),
  },
});

/* ---------------- Inicio ---------------- */

renderNamesToggle();
render();
stage.start();
