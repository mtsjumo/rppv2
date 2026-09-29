/**
 * Kunci anti-ganda (busy lock).
 *
 * Mencegah dua proses generate berjalan bersamaan — klik ganda, atau dipanggil
 * dari console — yang membanjiri API dan memicu rate-limit.
 *
 * Kunci bersifat "dilepas otomatis": setiap operasi yang memegang kunci harus
 * memanggil `release()` di blok `finally`.
 */

import { store } from './store.js';
import { emit } from './events.js';

const DEFAULT_MESSAGE = '⏳ Masih memproses, tunggu sampai selesai dulu...';

/**
 * Ambil kunci. Kembalikan `false` bila sudah dipegang.
 * @param {string} key nama operasi, mis. 'phase1'
 * @param {{message?: string}} [opts]
 */
export function enterBusy(key, opts = {}) {
  store.state._busy = store.state._busy || {};
  if (store.state._busy[key]) {
    emit('busy:rejected', { key, message: opts.message || DEFAULT_MESSAGE });
    return false;
  }
  store.state._busy[key] = true;
  emit('busy:changed', { key, busy: true });
  return true;
}

/** Lepas kunci. Aman dipanggil berkali-kali. */
export function releaseBusy(key) {
  store.state._busy = store.state._busy || {};
  if (store.state._busy[key]) {
    store.state._busy[key] = false;
    delete store.state._busy[key];
    emit('busy:changed', { key, busy: false });
  }
}

/** Kunci sedang dipegang? */
export function isBusy(key) {
  return !!store.state._busy?.[key];
}

/** Ada operasi apa pun yang sedang berjalan? */
export function anyBusy() {
  return Object.keys(store.state._busy || {}).length > 0;
}

/** Lepas semua kunci (dipakai saat reset / inisialisasi ulang). */
export function releaseAll() {
  store.state._busy = {};
  emit('busy:changed', { key: null, busy: false });
}
