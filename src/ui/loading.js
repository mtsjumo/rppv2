/**
 * Overlay loading dengan kontrol Batal.
 *
 * Generate bisa berjalan 2–5 menit untuk Phase 1, karena itu overlay
 * menampilkan tombol "Batal" yang meng-abort job — item yang diminta di audit
 * ("mekanisme recovery saat error tengah-proses") dan "toast tidak punya aksi".
 */

import { $ } from '../core/dom.js';

/** Controller generate yang sedang berjalan (di-set oleh phase orchestrator). */
let activeController = null;
/** Timer heartbeat — mendeteksi proses yang menggantung (tidak ada progres). */
let staleTimer = null;
const STALE_AFTER_MS = 150_000;

const SUBS_BY_STATE = {
  calling: 'Mohon tunggu, AI sedang bekerja...',
  'json-retry': 'Format jawaban tidak valid, meminta ulang...',
  completing: 'Melengkapi bagian yang kurang...',
  'rate-limited': 'Kena rate-limit API, menunggu sebelum mencoba lagi...',
  'falling-back': 'Model bermasalah, mencoba model cadangan...',
  'unit-start': 'Memproses bagian berikutnya...',
  cooldown: 'Jeda sesaat agar tidak memicu rate-limit...',
};

/**
 * Tampilkan overlay.
 * @param {string} text judul
 * @param {string} [sub]
 * @param {{onCancel?: AbortSignal['abort'], showCancel?: boolean}} [opts]
 */
export function showLoading(
  text = 'Memproses...',
  sub = 'Mohon tunggu, AI sedang bekerja',
  opts = {}
) {
  const overlay = $('#loading-overlay');
  if (!overlay) return;

  $('#loading-text').textContent = text;
  $('#loading-sub').textContent = sub;
  overlay.classList.remove('hidden', 'is-stale');

  const actions = $('#loading-actions');
  if (actions) {
    actions.innerHTML = '';
    if (opts.showCancel && typeof opts.onCancel === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline btn-sm';
      // Sengaja TIDAK memakai data-action: tombol ini mengikat listener-nya
      // sendiri (callback per-panggilan), sementara delegasi global di main.js
      // juga menangani 'cancel-generate'. Memberi data-action di sini akan
      // membuat satu klik memicu abort dua kali.
      btn.textContent = '✖ Batalkan';
      btn.addEventListener('click', () => opts.onCancel());
      actions.appendChild(btn);
    }
  }

  startStaleWatch();
}

function startStaleWatch() {
  stopStaleWatch();
  staleTimer = setTimeout(() => {
    const overlay = $('#loading-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.add('is-stale');
    const sub = $('#loading-sub');
    if (sub) {
      sub.textContent =
        'Proses ini berjalan lebih lama dari biasa. masih berjalan, atau sudah macet?';
    }
  }, STALE_AFTER_MS);
}

function stopStaleWatch() {
  if (staleTimer) {
    clearTimeout(staleTimer);
    staleTimer = null;
  }
}

/** Sembunyikan overlay. */
export function hideLoading() {
  const overlay = $('#loading-overlay');
  if (overlay) overlay.classList.add('hidden');
  stopStaleWatch();
  activeController = null;
}

/** Pasang AbortController supaya tombol Batal bisa menghentikan proses yang sedang jalan. */
export function setCancellable(controller) {
  activeController = controller;
}

/** Batalkan proses yang sedang berjalan. */
export function cancelActive() {
  if (activeController) {
    activeController.abort();
    return true;
  }
  return false;
}

/**
 * Perbarui teks loading dari event progres AI.
 * @param {{state: string, label?: string, issues?: string[], seconds?: number}} status
 */
export function updateLoadingFromStatus(status) {
  if (!status?.state) return;
  const fallback = SUBS_BY_STATE[status.state];
  if (!fallback) return;

  const sub = $('#loading-sub');
  if (!sub) return;

  if (status.state === 'unit-start' && status.label) {
    sub.textContent = `Memproses: ${status.label}`;
  } else if (status.state === 'cooldown' && status.seconds) {
    sub.textContent = `Jeda ${status.seconds} detik agar tidak memicu rate-limit...`;
  } else if (status.state === 'rate-limit-wait' && status.seconds) {
    sub.textContent = `Kena rate-limit — jeda ${status.seconds} detik sebelum mencoba lagi...`;
  } else if (status.state === 'completing' && status.issues?.length) {
    sub.textContent = `Melengkapi: ${status.issues[0]}`;
  } else {
    sub.textContent = fallback;
  }
}
