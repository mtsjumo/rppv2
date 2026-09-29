/**
 * Toast notification dengan aksi opsional.
 * Mendukung tombol "Coba Lagi" / "Lanjutkan" — salah satu item di audit UX.
 */

import { $ } from '../core/dom.js';

const DEFAULT_DURATION = 5000;
/** Toast penting (error dengan aksi) tidak hilang sendiri terlalu cepat. */
const STICKY_DURATION = 12000;

const TYPE_ICON = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

/**
 * Tampilkan toast.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type]
 * @param {object} [opts]
 * @param {string} [opts.actionLabel] teks tombol aksi
 * @param {() => void} [opts.onAction] callback saat tombol diklik
 * @param {number} [opts.duration] ms; 0 = tidak auto-hide
 * @returns {HTMLElement} elemen toast
 */
export function showToast(message, type = 'info', opts = {}) {
  const container = $('#toast-container');
  if (!container) return null;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = TYPE_ICON[type] ?? TYPE_ICON.info;

  const body = document.createElement('span');
  body.className = 'toast-body';
  // Pesan selalu lewat textContent: bisa berisi output AI, jadi jangan pernah
  // di-parse sebagai HTML.
  body.textContent = message;

  toast.append(icon, body);

  if (opts.actionLabel && typeof opts.onAction === 'function') {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'toast-action';
    action.textContent = opts.actionLabel;
    action.addEventListener('click', () => {
      dismiss();
      opts.onAction();
    });
    toast.appendChild(action);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Tutup notifikasi');
  close.textContent = '×';
  close.addEventListener('click', () => dismiss());
  toast.appendChild(close);

  container.appendChild(toast);

  let timer = null;
  const duration = opts.duration ?? (type === 'error' ? STICKY_DURATION : DEFAULT_DURATION);
  function dismiss() {
    if (timer) clearTimeout(timer);
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }
  if (duration > 0) timer = setTimeout(dismiss, duration);

  return toast;
}

export const toastSuccess = (m, o) => showToast(m, 'success', o);
export const toastError = (m, o) => showToast(m, 'error', o);
export const toastWarning = (m, o) => showToast(m, 'warning', o);
export const toastInfo = (m, o) => showToast(m, 'info', o);
