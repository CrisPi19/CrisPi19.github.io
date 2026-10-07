/*
 * Base común de los ejercicios (acordes, lectura, intervalos, escalas…). Sin DOM.
 *
 * Se encarga de lo que todos comparten:
 *   - fases: 'idle' → 'asking' → 'answered' → 'asking' …
 *   - cronómetro que se congela al responder y durante la pausa
 *   - repetición espaciada (cajas Leitner) guardada en localStorage bajo `${storageKey}.items`
 *   - estadísticas de la sesión e historial (js/history.js)
 * Cada tipo de ejercicio es una subclase que decide QUÉ se pregunta y CÓMO se valida
 * (por ejemplo Trainer, en js/trainer.js, para acordes).
 *
 * Eventos comunes (todos llevan `kind`, el tipo de ejercicio):
 *   'exercise:new'   { kind, …ejercicio }
 *   'answer:correct' { kind, …detalle }   'answer:wrong' { kind, …detalle }
 *   'pause:change'   { paused }
 *   'progress:reset' {}
 */
import { createItem, grade, pickNext } from './srs.js';
import { load, save, remove } from './storage.js';
import { record } from './history.js';

export class Session {
  /**
   * @param bus         EventBus donde se publican los eventos
   * @param kind        tipo de ejercicio ('chord', 'note'…): va en los eventos y en el historial
   * @param storageKey  prefijo en localStorage ('acordes' → 'acordes.items')
   * @param persist     false en las pruebas: no lee ni escribe localStorage
   * @param now         reloj inyectable (ms)
   * @param random      azar inyectable
   */
  constructor({ bus, kind, storageKey, persist = true, now = () => performance.now(), random = Math.random }) {
    this.bus = bus;
    this.kind = kind;
    this.storageKey = storageKey;
    this.persist = persist;
    this.now = now;
    this.random = random;

    const items = persist ? load(`${storageKey}.items`, {}) : {};
    this.items = items && typeof items === 'object' ? items : {};

    this.phase = 'idle';
    this.current = null;
    this.startedAt = 0;
    this.answerTimeMs = 0;
    this.paused = false;
    this.pausedAt = 0;
    this.session = { attempts: 0, correct: 0, streak: 0, correctMs: 0 };
  }

  /** Lee la configuración guardada del módulo (o `fallback`). */
  loadConfig(fallback) {
    return this.persist ? load(`${this.storageKey}.config`, fallback) : fallback;
  }

  saveConfig(config) {
    if (this.persist) save(`${this.storageKey}.config`, config);
  }

  /** Sorteo ponderado por caja entre `ids`, sin repetir el ejercicio actual si hay alternativas. */
  pickId(ids) {
    return pickNext(ids, this.items, { avoid: this.current?.id, random: this.random });
  }

  /** Empieza un ejercicio: lo deja como actual, arranca el cronómetro y lo anuncia. */
  begin(current) {
    this.current = current;
    this.phase = 'asking';
    this.startedAt = this.now();
    if (this.paused) this.pausedAt = this.startedAt; // ejercicio nuevo en pausa: empieza en 0
    this.bus.emit('exercise:new', { kind: this.kind, ...current });
  }

  /** ¿Se pueden recibir respuestas ahora? */
  canAnswer() {
    return !this.paused && this.phase === 'asking';
  }

  /** Milisegundos del ejercicio actual (se congela al responder y durante la pausa). */
  elapsedMs() {
    if (this.phase === 'asking') return (this.paused ? this.pausedAt : this.now()) - this.startedAt;
    if (this.phase === 'answered') return this.answerTimeMs;
    return 0;
  }

  /**
   * Cierra el ejercicio actual: actualiza su caja, la sesión y el historial, y publica
   * 'answer:correct' o 'answer:wrong' con `detail` + los datos comunes.
   * @param correct          ¿acertó?
   * @param slowThresholdMs  hasta cuántos ms cuenta como "rápido" (sube de caja)
   * @param detail           datos propios del ejercicio para los oyentes
   * @param historyExtra     datos propios que se guardan en el historial
   */
  finish({ correct, slowThresholdMs, detail = {}, historyExtra = {} }) {
    const timeMs = this.now() - this.startedAt;
    const { id } = this.current;
    const before = this.items[id] ?? createItem();
    const after = grade(before, { correct, timeMs, slowThresholdMs });
    this.items[id] = after;
    if (this.persist) save(`${this.storageKey}.items`, this.items);

    const s = this.session;
    s.attempts += 1;
    if (correct) {
      s.correct += 1;
      s.streak += 1;
      s.correctMs += timeMs;
    } else {
      s.streak = 0;
    }

    record({ module: this.kind, item: id, correct, timeMs, ...historyExtra });

    this.phase = 'answered';
    this.answerTimeMs = timeMs;
    const full = {
      kind: this.kind, ...this.current, ...detail,
      timeMs, slowThresholdMs, before, after, streak: s.streak, session: { ...s },
    };
    this.bus.emit(correct ? 'answer:correct' : 'answer:wrong', full);
    return full;
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

  /** Borra las cajas del módulo y plantea un ejercicio nuevo. */
  resetProgress() {
    this.items = {};
    if (this.persist) remove(`${this.storageKey}.items`);
    this.bus.emit('progress:reset', {});
    this.next();
  }

  /** La subclase plantea el siguiente ejercicio (y llama a begin()). */
  next() {
    throw new Error('next() no implementado');
  }
}
