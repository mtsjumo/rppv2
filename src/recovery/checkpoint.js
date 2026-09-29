/**
 * Penyimpanan checkpoint untuk pemulihan generate yang terputus.
 *
 * Masalah yang diselesaikan: pada versi lama, kalau generate Phase 1 gagal di
 * tengah (sub-phase 3 dari 5), seluruh progress hilang — user harus mengulang
 * dari awal dan membayar API quota dua kali.
 *
 * Strategi: setiap sub-phase yang berhasil langsung disimpan ke localStorage
 * bersama input form-nya. Kalau proses terputus (error, tab ditutup, browser
 * crash, refresh), checkpoint terakhir masih ada dan bisa dilanjutkan dari
 * titik yang sama.
 *
 * Semua fungsi murni terhadap DOM dan aman dipanggil walau localStorage mati.
 */

import { STORAGE_KEYS, readJson, writeJson, remove, estimateSize } from '../core/storage.js';
import { CHECKPOINT_TTL_MS, CHECKPOINT_MAX_ENTRIES } from '../config.js';

/** @typedef {'running'|'failed'|'interrupted'|'complete'} CheckpointStatus */

/**
 * @typedef {object} Checkpoint
 * @property {string}   id
 * @property {'phase1'|'phase2'|'phase3'} phase
 * @property {string}   label
 * @property {CheckpointStatus} status
 * @property {string[]} completed  id sub-phase/unit yang sudah sukses
 * @property {object}   data       hasil parsial yang sudah terkumpul
 * @property {object}   input      salinan input form saat job dimulai
 * @property {number}   createdAt
 * @property {number}   updatedAt
 * @property {number}   total      jumlah unit pekerjaan
 * @property {string|null} lastError
 * @property {number}   attempts   berapa kali job ini dicoba
 */

/** Buat id checkpoint unik tanpa crypto dependency. */
function makeId() {
  return `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Buang checkpoint kedaluwarsa / terlalu banyak, urut terbaru dulu. */
function prune(list) {
  const now = Date.now();
  return list
    .filter((cp) => now - (cp?.updatedAt || 0) <= CHECKPOINT_TTL_MS)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, CHECKPOINT_MAX_ENTRIES);
}

function readAll() {
  const list = readJson(STORAGE_KEYS.checkpoints, []);
  return Array.isArray(list) ? prune(list) : [];
}

function writeAll(list) {
  return writeJson(STORAGE_KEYS.checkpoints, prune(list));
}

/**
 * Buat checkpoint baru.
 * @param {{phase: string, label: string, total: number, input?: object, data?: object}} init
 * @returns {Checkpoint}
 */
export function createCheckpoint(init) {
  const now = Date.now();
  return {
    id: makeId(),
    phase: init.phase,
    label: init.label || init.phase,
    status: 'running',
    completed: [],
    data: init.data || {},
    input: init.input || {},
    createdAt: now,
    updatedAt: now,
    total: init.total ?? 0,
    lastError: null,
    attempts: 1,
  };
}

/**
 * Simpan/memperbarui checkpoint.
 * @param {Checkpoint} checkpoint
 * @returns {Checkpoint} checkpoint yang tersimpan
 */
export function saveCheckpoint(checkpoint) {
  if (!checkpoint?.id) return checkpoint;
  const list = readAll();
  const next = { ...checkpoint, updatedAt: Date.now() };
  const index = list.findIndex((cp) => cp.id === next.id);
  if (index >= 0) {
    list[index] = next;
  } else {
    list.push(next);
  }
  const ok = writeAll(list);
  if (!ok) {
    // Kemungkinan besar localStorage penuh (hasil generate besar).
    console.warn('[checkpoint] Gagal menyimpan — localStorage mungkin penuh.');
  }
  return next;
}

/**
 * Patch sebagian checkpoint.
 * @param {string} id
 * @param {Partial<Checkpoint>} patch
 * @returns {Checkpoint|null}
 */
export function patchCheckpoint(id, patch) {
  const list = readAll();
  const index = list.findIndex((cp) => cp.id === id);
  if (index < 0) return null;
  const next = { ...list[index], ...patch, updatedAt: Date.now() };
  list[index] = next;
  writeAll(list);
  return next;
}

/** Tandai satu unit pekerjaan selesai dan simpan datanya. */
export function markUnitComplete(id, unitId, dataChunk) {
  const cp = getCheckpoint(id);
  if (!cp) return null;
  return patchCheckpoint(id, {
    completed: cp.completed.includes(unitId) ? cp.completed : [...cp.completed, unitId],
    data: { ...cp.data, ...(dataChunk || {}) },
  });
}

/** Tandai job selesai. */
export function markComplete(id) {
  return patchCheckpoint(id, { status: 'complete', lastError: null });
}

/** Tandai job gagal, beserta pesan errornya. */
export function markFailed(id, error) {
  return patchCheckpoint(id, {
    status: 'failed',
    lastError: String(error?.message || error || 'Error tidak diketahui'),
  });
}

/**
 * Tandai checkpoint yang masih `running` sebagai `interrupted`.
 * Dipanggil saat app start: kalau ada checkpoint `running` dari sesi lalu,
 * berarti prosesnya terputus (tab ditutup / crash).
 * @returns {Checkpoint[]} checkpoint yang ditandai terputus
 */
export function markOrphansInterrupted() {
  const list = readAll();
  const orphans = list.filter((cp) => cp.status === 'running');
  if (!orphans.length) return [];
  const now = Date.now();
  writeAll(
    list.map((cp) =>
      cp.status === 'running' ? { ...cp, status: 'interrupted', updatedAt: now } : cp
    )
  );
  return orphans;
}

/** @returns {Checkpoint|null} */
export function getCheckpoint(id) {
  return readAll().find((cp) => cp.id === id) ?? null;
}

/** @returns {Checkpoint[]} semua checkpoint, terbaru dulu. */
export function listCheckpoints() {
  return readAll();
}

/**
 * Checkpoint yang bisa dilanjutkan: belum `complete`.
 * @returns {Checkpoint[]}
 */
export function listResumable() {
  return readAll().filter((cp) => cp.status !== 'complete');
}

/** Hapus satu checkpoint. */
export function discardCheckpoint(id) {
  writeAll(readAll().filter((cp) => cp.id !== id));
}

/** Hapus semua checkpoint. */
export function clearCheckpoints() {
  remove(STORAGE_KEYS.checkpoints);
}

/**
 * Checkpoint terbaru untuk sebuah phase yang belum selesai.
 * @param {string} phase
 * @returns {Checkpoint|null}
 */
export function findResumableFor(phase) {
  return readAll().find((cp) => cp.phase === phase && cp.status !== 'complete') ?? null;
}

/** Ringkasan untuk ditampilkan di banner pemulihan. */
export function describeCheckpoint(cp) {
  if (!cp) return null;
  const done = cp.completed?.length || 0;
  const total = cp.total || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return {
    id: cp.id,
    phase: cp.phase,
    label: cp.label,
    status: cp.status,
    done,
    total,
    pct,
    lastError: cp.lastError,
    attempts: cp.attempts || 1,
    updatedAt: cp.updatedAt,
    ageMs: Date.now() - (cp.updatedAt || 0),
    sizeBytes: estimateSize(cp),
  };
}
