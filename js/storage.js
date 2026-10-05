/*
 * Envoltorio de localStorage.
 *
 * - Todas las claves llevan el prefijo "pianoTrainer.v1." para no chocar con otros
 *   sitios del mismo dominio y poder migrar si cambia el formato (v2…).
 * - Todo va en try/catch: en modo incógnito o con el almacenamiento bloqueado
 *   la app sigue funcionando, solo que no recuerda el progreso.
 */

const PREFIX = 'pianoTrainer.v1.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* nada que hacer */
  }
}
