/*
 * Lógica del entrenador de acordes. Sin DOM ni canvas: solo estado y eventos.
 *
 * Entrada:  next(), noteOn(midi, source), clear(), submit(), setConfig(), resetProgress(),
 *           setPaused(bool) / togglePause()
 * Salida:   eventos en el bus (ver lista abajo). Quien dibuja o suena se suscribe.
 *
 * Eventos:
 *   'exercise:new'      { id, root, type }
 *   'note:on'           { midi, source }          ← cada tecla pulsada (para el sonido)
 *   'selection:change'  { notes, count }          ← NUNCA dice si la selección es correcta
 *   'answer:empty'      {}                        ← se confirmó sin notas
 *   'answer:correct'    { …detalle }              ← ver submit()
 *   'answer:wrong'      { …detalle }
 *   'config:change'     { config }
 *   'progress:reset'    {}
 *   'pause:change'      { paused }
 *
 * Pausa: congela el cronómetro (el tiempo en pausa no cuenta para la repetición espaciada)
 * y bloquea toda entrada de notas y respuestas hasta reanudar.
 */
import { ROOTS, CHORD_TYPES, analyzeAnswer } from './theory.js';
import { createItem, grade, pickNext } from './srs.js';
import { load, save, remove } from './storage.js';

/** Un acierto es "rápido" si tarda como máximo esto por cada nota del acorde. */
export const SLOW_MS_PER_NOTE = 2000;
export const TYPE_IDS = Object.keys(CHORD_TYPES);

export const itemId = (root, type) => `${root}|${type}`;

export function parseId(id) {
  const [root, type] = id.split('|');
  return { id, root, type };
}

export function sanitizeConfig(saved) {
  const types = (saved?.types ?? TYPE_IDS).filter((t) => TYPE_IDS.includes(t));
  const roots = (saved?.roots ?? ROOTS).filter((r) => ROOTS.includes(r));
  return {
    types: types.length ? types : [...TYPE_IDS],
    roots: roots.length ? roots : [...ROOTS],
  };
}

export class Trainer {
  /**
   * @param bus      EventBus donde se publican los eventos
   * @param persist  false en las pruebas: no lee ni escribe localStorage
   * @param now      reloj inyectable (ms)
   * @param random   azar inyectable
   */
  constructor({ bus, persist = true, now = () => performance.now(), random = Math.random }) {
    this.bus = bus;
    this.persist = persist;
    this.now = now;
    this.random = random;

    this.config = sanitizeConfig(persist ? load('acordes.config', null) : null);
    const items = persist ? load('acordes.items', {}) : {};
    this.items = items && typeof items === 'object' ? items : {};

    this.phase = 'idle'; // 'idle' → 'asking' → 'answered' → 'asking' …
    this.current = null;
    this.selected = new Set();
    this.startedAt = 0;
    this.answerTimeMs = 0;
    this.paused = false;
    this.pausedAt = 0;
    this.session = { attempts: 0, correct: 0, streak: 0, correctMs: 0 };
  }

  activeIds() {
    return this.config.roots.flatMap((root) => this.config.types.map((type) => itemId(root, type)));
  }

  /** Plantea el siguiente acorde (elegido por repetición espaciada). */
  next() {
    const id = pickNext(this.activeIds(), this.items, { avoid: this.current?.id, random: this.random });
    this.current = parseId(id);
    this.phase = 'asking';
    this.selected.clear();
    this.startedAt = this.now();
    if (this.paused) this.pausedAt = this.startedAt; // ejercicio nuevo en pausa: empieza en 0
    this.bus.emit('exercise:new', { ...this.current });
    this.emitSelection();
  }

  /**
   * Única puerta de entrada de notas: la usan el teclado en pantalla y, en el módulo 2, el MIDI.
   * Siempre avisa 'note:on' (para que suene); solo cambia la selección mientras se pregunta.
   */
  noteOn(midi, source = 'screen') {
    if (this.paused) return;
    this.bus.emit('note:on', { midi, source });
    if (this.phase !== 'asking') return;
    if (this.selected.has(midi)) this.selected.delete(midi);
    else this.selected.add(midi);
    this.emitSelection();
  }

  /** Fija la selección completa (útil para MIDI: las teclas que están apretadas). */
  setSelection(notes) {
    if (this.paused || this.phase !== 'asking') return;
    this.selected = new Set(notes);
    this.emitSelection();
  }

  clear() {
    if (this.paused || this.phase !== 'asking' || !this.selected.size) return;
    this.selected.clear();
    this.emitSelection();
  }

  getSelected() {
    return [...this.selected].sort((a, b) => a - b);
  }

  emitSelection() {
    const notes = this.getSelected();
    this.bus.emit('selection:change', { notes, count: notes.length });
  }

  /** Milisegundos del ejercicio actual (se congela al responder y durante la pausa). */
  elapsedMs() {
    if (this.phase === 'asking') return (this.paused ? this.pausedAt : this.now()) - this.startedAt;
    if (this.phase === 'answered') return this.answerTimeMs;
    return 0;
  }

  /** Confirma la respuesta. Devuelve el detalle publicado, o null si no correspondía. */
  submit() {
    if (this.paused || this.phase !== 'asking') return null;
    const notes = this.getSelected();
    if (!notes.length) {
      this.bus.emit('answer:empty', {});
      return null;
    }

    const timeMs = this.now() - this.startedAt;
    const { id, root, type } = this.current;
    const result = analyzeAnswer(notes, root, type);
    const slowThresholdMs = SLOW_MS_PER_NOTE * CHORD_TYPES[type].degrees.length;
    const before = this.items[id] ?? createItem();
    const after = grade(before, { correct: result.correct, timeMs, slowThresholdMs });
    this.items[id] = after;
    if (this.persist) save('acordes.items', this.items);

    const s = this.session;
    s.attempts += 1;
    if (result.correct) {
      s.correct += 1;
      s.streak += 1;
      s.correctMs += timeMs;
    } else {
      s.streak = 0;
    }

    this.phase = 'answered';
    this.answerTimeMs = timeMs;
    const detail = {
      id, root, type, notes, result, timeMs, slowThresholdMs, before, after,
      streak: s.streak, session: { ...s },
    };
    this.bus.emit(result.correct ? 'answer:correct' : 'answer:wrong', detail);
    return detail;
  }

  /**
   * Pausa o reanuda. Al reanudar, startedAt se corre hacia adelante lo que duró la pausa:
   * así now() - startedAt sigue midiendo solo el tiempo jugado.
   */
  setPaused(paused) {
    paused = Boolean(paused);
    if (paused === this.paused) return;
    const t = this.now();
    if (paused) this.pausedAt = t;
    else this.startedAt += t - this.pausedAt;
    this.paused = paused;
    this.bus.emit('pause:change', { paused });
  }

  togglePause() {
    this.setPaused(!this.paused);
  }

  setConfig(next) {
    this.config = sanitizeConfig(next);
    if (this.persist) save('acordes.config', this.config);
    this.bus.emit('config:change', { config: this.config });
    if (this.phase === 'asking' && !this.activeIds().includes(this.current?.id)) this.next();
  }

  resetProgress() {
    this.items = {};
    if (this.persist) remove('acordes.items');
    this.bus.emit('progress:reset', {});
    this.next();
  }
}
