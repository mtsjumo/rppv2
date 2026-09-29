/**
 * Event bus sederhana (pub/sub sinkron).
 * Dipakai untuk decoupling: modul render tidak perlu tahu modul mana yang
 * perlu tahu saat state berubah.
 */

const listeners = new Map();

/**
 * Daftar listener untuk sebuah event.
 * @param {string} event
 * @param {(payload: *, meta: object) => void} handler
 * @returns {() => void} fungsi unsubscribe
 */
export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

/** Hapus satu listener. */
export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

/**
 * Emit event. Error di satu handler tidak boleh menghentikan handler lain.
 * @param {string} event
 * @param {*} [payload]
 */
export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of Array.from(set)) {
    try {
      handler(payload, { event });
    } catch (e) {
      console.error(`[events] Handler untuk "${event}" error:`, e);
    }
  }
}

/** Hapus semua listener (dipakai test). */
export function clearAll() {
  listeners.clear();
}
