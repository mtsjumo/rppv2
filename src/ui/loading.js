/**
 * Panel status proses (loading tray) dengan kontrol Batal.
 *
 * Dipakai Phase 2, Phase 3, dan regenerate per bagian. Phase 1 punya monitor
 * inline sendiri (`progress-monitor.js`) karena ada 5 bagian yang perlu
 * ditampilkan satu per satu.
 *
 * Bukan lagi overlay yang menutup layar: panel melayang di pojok sehingga
 * pengguna tetap bisa membaca hasil yang sudah ada. Yang ditampilkan:
 *   - apa yang sedang dikerjakan (mis. "AI menulis… 4,2 rb karakter"),
 *   - waktu berjalan,
 *   - tombol Batal yang benar-benar meng-abort permintaan.
 */

import { $ } from '../core/dom.js';
import { formatChars, formatElapsed } from './progress-monitor.js';

/** Controller generate yang sedang berjalan (di-set oleh phase orchestrator). */
let activeController = null;
/** Timer heartbeat — mendeteksi proses yang menggantung (tidak ada kabar sama sekali). */
let staleTimer = null;
/** Penghitung waktu berjalan. */
let elapsedTimer = null;
let startedAt = 0;
const STALE_AFTER_MS = 150_000;

const SUBS_BY_STATE = {
  calling: 'Menghubungi AI…',
  'json-retry': 'Format jawaban belum valid, meminta ulang…',
  completing: 'Melengkapi bagian yang kurang…',
  'rate-limited': 'Terkena batas permintaan API, menunggu sebelum mencoba lagi…',
  'falling-back': 'Model bermasalah, mencoba model cadangan…',
  'unit-start': 'Memproses bagian berikutnya…',
};

/**
 * Tampilkan panel.
 * @param {string} text judul
 * @param {string} [sub]
 * @param {{onCancel?: () => void, showCancel?: boolean}} [opts]
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
      // sendiri (callback per-panggilan). Memberi data-action akan membuat
      // satu klik memicu abort dua kali lewat delegasi global di main.js.
      btn.textContent = 'Batalkan';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = 'Membatalkan…';
        opts.onCancel();
      });
      actions.appendChild(btn);
    }
  }

  startedAt = Date.now();
  tickElapsed();
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = setInterval(tickElapsed, 1000);
  startStaleWatch();
}

function tickElapsed() {
  const el = $('#loading-elapsed');
  if (el && startedAt) el.textContent = `⏱ ${formatElapsed(Date.now() - startedAt)}`;
}

/** (Re)start pengawas macet. Dipanggil ulang setiap ada kabar dari AI. */
function startStaleWatch() {
  stopStaleWatch();
  staleTimer = setTimeout(() => {
    const overlay = $('#loading-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    overlay.classList.add('is-stale');
    const sub = $('#loading-sub');
    if (sub) {
      sub.textContent =
        'Sudah lama tidak ada kabar dari model. Bisa jadi hanya lambat — tunggu sebentar, atau batalkan lalu coba lagi.';
    }
  }, STALE_AFTER_MS);
}

function stopStaleWatch() {
  if (staleTimer) {
    clearTimeout(staleTimer);
    staleTimer = null;
  }
}

/** Sembunyikan panel. */
export function hideLoading() {
  const overlay = $('#loading-overlay');
  if (overlay) overlay.classList.add('hidden');
  stopStaleWatch();
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = null;
  startedAt = 0;
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
 * Perbarui teks dari event progres AI / job runner.
 * @param {{state: string, label?: string, chars?: number, thinking?: boolean,
 *          issues?: string[], seconds?: number}} status
 */
export function updateLoadingFromStatus(status) {
  if (!status?.state) return;
  const sub = $('#loading-sub');
  if (!sub) return;

  // Setiap kabar = proses masih hidup → mulai ulang hitungan "macet".
  const overlay = $('#loading-overlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    overlay.classList.remove('is-stale');
    startStaleWatch();
  }

  switch (status.state) {
    case 'streaming':
      sub.textContent = status.thinking
        ? 'Model sedang berpikir…'
        : `AI sedang menulis… ${formatChars(status.chars || 0)} karakter`;
      return;
    case 'unit-start':
      sub.textContent = status.label ? `Memproses: ${status.label}` : SUBS_BY_STATE['unit-start'];
      return;
    case 'rate-limited':
    case 'rate-limit-wait':
      sub.textContent = status.seconds
        ? `Terkena batas permintaan API — jeda ${status.seconds} detik sebelum mencoba lagi…`
        : SUBS_BY_STATE['rate-limited'];
      return;
    case 'completing':
      sub.textContent = status.issues?.length
        ? `Melengkapi: ${status.issues[0]}`
        : SUBS_BY_STATE.completing;
      return;
    default:
      if (SUBS_BY_STATE[status.state]) sub.textContent = SUBS_BY_STATE[status.state];
  }
}
