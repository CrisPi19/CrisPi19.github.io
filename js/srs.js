/*
 * Repetición espaciada con un sistema Leitner simplificado.
 *
 * Cada ítem (por ejemplo un acorde) vive en una "caja" del 1 al 5:
 *   - fallo            → vuelve a la caja 1
 *   - acierto lento    → se queda en su caja
 *   - acierto rápido   → sube una caja (máximo 5)
 * Al elegir el siguiente ítem, las cajas bajas pesan más, así que lo que
 * cuesta aparece más seguido. Todo es puro (sin DOM ni almacenamiento) para poder probarlo.
 */

export const MAX_BOX = 5;

/** Peso de sorteo de cada caja: caja 1 → 16, caja 2 → 8 … caja 5 → 1. */
export function boxWeight(box) {
  return 2 ** (MAX_BOX - box);
}

export function createItem() {
  return { box: 1, attempts: 0, correct: 0, lastTimeMs: null, avgTimeMs: null, lastSeen: 0 };
}

/**
 * Registra una respuesta y devuelve el ítem actualizado (no modifica el original).
 * avgTimeMs es un promedio móvil exponencial de los aciertos: pesa más lo reciente.
 */
export function grade(item, { correct, timeMs, slowThresholdMs, now = Date.now() }) {
  const next = { ...createItem(), ...item };
  next.attempts += 1;
  next.lastTimeMs = timeMs;
  next.lastSeen = now;

  if (!correct) {
    next.box = 1;
    return next;
  }

  next.correct += 1;
  next.avgTimeMs = next.avgTimeMs == null ? timeMs : Math.round(0.7 * next.avgTimeMs + 0.3 * timeMs);
  if (timeMs <= slowThresholdMs) next.box = Math.min(MAX_BOX, next.box + 1);
  return next;
}

/**
 * Elige el siguiente id con sorteo ponderado por caja.
 * - items: objeto id → ítem (los ids sin ítem cuentan como nuevos, caja 1)
 * - avoid: id que no debe repetirse (el anterior), si hay alternativas
 * - random: inyectable para pruebas
 */
export function pickNext(ids, items, { avoid = null, random = Math.random } = {}) {
  if (!ids.length) return null;
  const candidates = ids.length > 1 ? ids.filter((id) => id !== avoid) : ids;
  const weights = candidates.map((id) => boxWeight(items[id]?.box ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
