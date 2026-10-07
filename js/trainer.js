/*
 * Ejercicio de acordes (módulo 1). Sin DOM ni canvas: solo estado y eventos.
 * Lo común (fases, cronómetro, pausa, cajas Leitner, historial) está en js/session.js.
 *
 * Entrada:  next(), noteOn(midi, source), setSelection(notes), clear(), submit(),
 *           setConfig(), resetProgress(), setPaused(bool) / togglePause()
 * Salida:   eventos en el bus. Quien dibuja o suena se suscribe.
 *
 * Eventos (además de los comunes de Session):
 *   'exercise:new'      { kind: 'chord', id, root, type }
 *   'note:on'           { midi, source }          ← cada tecla pulsada (para el sonido)
 *   'selection:change'  { notes, count }          ← NUNCA dice si la selección es correcta
 *   'answer:empty'      {}                        ← se confirmó sin notas
 *   'answer:correct'    { …detalle }              ← ver submit()
 *   'answer:wrong'      { …detalle }
 *   'config:change'     { config }
 *
 * Pausa: congela el cronómetro (el tiempo en pausa no cuenta para la repetición espaciada)
 * y bloquea toda entrada de notas y respuestas hasta reanudar.
 */
import { ROOTS, CHORD_TYPES, analyzeAnswer, spellChord, chordPitchClasses } from './theory.js';
import { Session } from './session.js';

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

export class Trainer extends Session {
  /** Mismas opciones que Session (bus, persist, now, random). */
  constructor(options) {
    super({ ...options, kind: 'chord', storageKey: 'acordes' });
    this.config = sanitizeConfig(this.loadConfig(null));
    this.selected = new Set();
  }

  activeIds() {
    return this.config.roots.flatMap((root) => this.config.types.map((type) => itemId(root, type)));
  }

  /** Plantea el siguiente acorde (elegido por repetición espaciada). */
  next() {
    this.selected.clear();
    this.begin(parseId(this.pickId(this.activeIds())));
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
    if (!this.canAnswer()) return;
    this.selected = new Set(notes);
    this.emitSelection();
  }

  clear() {
    if (!this.canAnswer() || !this.selected.size) return;
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

  /** Confirma la respuesta. Devuelve el detalle publicado, o null si no correspondía. */
  submit() {
    if (!this.canAnswer()) return null;
    const notes = this.getSelected();
    if (!notes.length) {
      this.bus.emit('answer:empty', {});
      return null;
    }

    const { root, type } = this.current;
    const result = analyzeAnswer(notes, root, type);
    const spelled = spellChord(root, type);
    const pcs = chordPitchClasses(root, type);
    return this.finish({
      correct: result.correct,
      slowThresholdMs: SLOW_MS_PER_NOTE * CHORD_TYPES[type].degrees.length,
      detail: { notes, result },
      historyExtra: {
        missing: result.missing.map((pc) => spelled[pcs.indexOf(pc)]),
        extra: result.extra,
        inversion: result.inversion,
      },
    });
  }

  setConfig(next) {
    this.config = sanitizeConfig(next);
    this.saveConfig(this.config);
    this.bus.emit('config:change', { config: this.config });
    if (this.phase === 'asking' && !this.activeIds().includes(this.current?.id)) this.next();
  }
}
