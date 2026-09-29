/**
 * Pembungkus localStorage yang aman.
 *
 * localStorage bisa tidak tersedia (mode privat sebagian browser, iframe
 * sandbox) atau berisi JSON rusak. Semua akses di aplikasi ini lewat modul ini
 * supaya tidak ada satu pun call site yang melempar exception.
 */

const NAMESPACE = 'rpp_generator';

export const STORAGE_KEYS = {
  settings: `${NAMESPACE}_settings`,
  formDraft: `${NAMESPACE}_form_draft`,
  checkpoints: `${NAMESPACE}_checkpoints`,
  lastError: `${NAMESPACE}_last_error`,
};

function getStore() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    // Uji tulis: beberapa browser mengekspos object tapi melempar saat dipakai.
    const probe = `${NAMESPACE}__probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** True bila localStorage bisa dipakai. */
export function isStorageAvailable() {
  return getStore() !== null;
}

/**
 * Baca + parse JSON dari storage.
 * @returns {*} nilai tersimpan, atau `fallback` bila tidak ada / rusak.
 */
export function readJson(key, fallback = null) {
  const store = getStore();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[storage] Gagal parse "${key}", memakai fallback:`, e);
    return fallback;
  }
}

/** Tulis JSON. Mengembalikan true bila berhasil disimpan. */
export function writeJson(key, value) {
  const store = getStore();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    // QuotaExceededError paling sering: hasil generate terlalu besar.
    console.warn(`[storage] Gagal simpan "${key}":`, e);
    return false;
  }
}

/** Baca string mentah (tanpa parse). */
export function readRaw(key, fallback = null) {
  const store = getStore();
  if (!store) return fallback;
  try {
    return store.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Tulis string mentah. */
export function writeRaw(key, value) {
  const store = getStore();
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Hapus satu key. */
export function remove(key) {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* diamkan */
  }
}

/** Hapus seluruh key milik aplikasi ini (tidak menyentuh key lain). */
export function clearNamespace() {
  const store = getStore();
  if (!store) return;
  try {
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(NAMESPACE)) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  } catch {
    /* diamkan */
  }
}

/**
 * Perkiraan ukuran payload dalam byte sebelum menulis.
 * Dipakai untuk memberi peringatan dini saat quota localStorage hampir penuh.
 */
export function estimateSize(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return JSON.stringify(value).length * 2;
  }
}
