/*
 * Historial de ejercicios: un registro por respuesta (módulo, ítem, acierto, tiempo y
 * detalles propios de cada módulo, como notas que faltaron o la inversión tocada).
 *
 * Por ahora vive SOLO EN MEMORIA: dura lo que dura la página abierta y se pierde al
 * refrescar o reabrir. Cuando el maestro presente estadísticas se guardará en
 * localStorage (mismo formato, tope MAX_RECORDS) cambiando solo este archivo.
 */
export const MAX_RECORDS = 2000;

const records = [];

/** Agrega un registro (se le pone la hora) y descarta los más viejos si se pasa del tope. */
export function record(entry) {
  records.push({ at: Date.now(), ...entry });
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
}

/** Copia de los registros, opcionalmente solo los de un módulo. */
export function getHistory(module = null) {
  return module ? records.filter((r) => r.module === module) : [...records];
}

export function clearHistory() {
  records.length = 0;
}
