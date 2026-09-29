/**
 * Monitor progres generate Phase 1.
 *
 * Masalah yang dipecahkan: sebelumnya progres hanya berupa overlay layar penuh
 * bertuliskan "Mohon tunggu", padahal event detail (streaming, retry, rate-limit)
 * sebenarnya ada. Monitor ini menerjemahkan event job runner + AI menjadi:
 *   - status per bagian (menunggu / berjalan / selesai / gagal / jeda),
 *   - catatan hidup per bagian ("Menulis… 4,2 rb karakter"),
 *   - progress bar keseluruhan yang bergerak halus selama streaming,
 *   - penghitung waktu berjalan + tombol Batal yang tetap terlihat.
 *
 * Tampilannya inline di card Phase 1 (bukan overlay), jadi pratinjau hasil bisa
 * muncul di bawahnya sementara bagian lain masih dikerjakan.
 */

import { $ } from '../core/dom.js';
import { SUBPHASE_EXPECTED_CHARS } from '../config.js';
import { friendlyError } from '../services/json.js';
import { updateProgress } from './wizard.js';

/** Progress satu bagian tidak pernah melewati angka ini sebelum benar-benar selesai. */
const MAX_PARTIAL = 0.92;
const DEFAULT_EXPECTED_CHARS = 9000;

/** Format jumlah karakter ringkas: 4200 -> "4,2 rb". */
export function formatChars(n) {
  if (n < 1000) return `${n}`;
  return `${(Math.round(n / 100) / 10).toString().replace('.', ',')} rb`;
}

/** Format detik -> "1m 05s". */
export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

/** Kerangka abu-abu berkilau untuk area pratinjau selama menunggu bagian pertama. */
export function skeletonHTML() {
  const line = (w) => `<div class="skeleton-line" style="width:${w}%"></div>`;
  return `
    <div class="skeleton" aria-hidden="true">
      <div class="skeleton-title"></div>
      ${[92, 84, 96, 70].map(line).join('')}
      <div class="skeleton-block"></div>
      ${[88, 94, 62].map(line).join('')}
    </div>`;
}

/**
 * @param {object} options
 * @param {Array<{id: string, label: string, description?: string}>} options.units
 * @param {string[]} [options.doneIds] bagian yang sudah selesai (resume)
 * @param {() => void} [options.onCancel]
 */
export function createMonitor({ units, doneIds = [], onCancel = null }) {
  /** id -> state tampilan. */
  const items = new Map(
    units.map((u) => [
      u.id,
      {
        id: u.id,
        label: u.label,
        description: u.description,
        status: doneIds.includes(u.id) ? 'done' : 'pending',
        chars: 0,
        detail: doneIds.includes(u.id) ? 'Dilanjutkan dari sesi sebelumnya' : '',
      },
    ])
  );

  let startedAt = 0;
  let ticker = null;
  let cancelBtn = null;
  let lastHeadline = '';

  const doneCount = () => [...items.values()].filter((i) => i.status === 'done').length;

  function fraction(item) {
    if (item.status === 'done') return 1;
    if (item.status !== 'active' && item.status !== 'waiting') return 0;
    const expected = SUBPHASE_EXPECTED_CHARS[item.id] || DEFAULT_EXPECTED_CHARS;
    return Math.min(MAX_PARTIAL, item.chars / expected);
  }

  const overallPct = () => {
    const all = [...items.values()];
    if (!all.length) return 0;
    const sum = all.reduce((acc, i) => acc + fraction(i), 0);
    return Math.min(99, Math.round((sum / all.length) * 100));
  };

  function steps() {
    return [...items.values()].map((i) => ({
      label: i.label,
      description: i.description,
      status: i.status,
      detail: i.detail,
      fraction: fraction(i),
    }));
  }

  function headline() {
    const active = [...items.values()].filter((i) => i.status === 'active');
    if (active.length === 1) return `Mengerjakan ${active[0].label}…`;
    if (active.length > 1) return `Mengerjakan ${active.length} bagian sekaligus…`;
    const waiting = [...items.values()].some((i) => i.status === 'waiting');
    if (waiting) return 'Menunggu jeda dari server…';
    return `${doneCount()} dari ${items.size} bagian selesai`;
  }

  function render() {
    lastHeadline = headline();
    updateProgress(overallPct(), lastHeadline, steps());
  }

  function tickElapsed() {
    const el = $('#phase1-progress-elapsed');
    if (el && startedAt) el.textContent = `⏱ ${formatElapsed(Date.now() - startedAt)}`;
  }

  function mountCancel() {
    const host = $('#phase1-progress-actions');
    if (!host || typeof onCancel !== 'function') return;
    host.replaceChildren();
    cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-outline btn-sm';
    // Sengaja TANPA data-action: tombol ini mengikat listener sendiri. Memberi
    // data-action akan membuat satu klik dieksekusi dua kali (lihat main.js).
    cancelBtn.textContent = 'Batalkan';
    cancelBtn.addEventListener('click', () => {
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Membatalkan…';
      onCancel();
    });
    host.appendChild(cancelBtn);
  }

  function announce(text) {
    const sr = $('#sr-progress');
    if (sr) sr.textContent = text;
  }

  /** Mulai: tampilkan panel, jalankan penghitung waktu, pasang tombol Batal. */
  function start() {
    startedAt = Date.now();
    $('#phase1-progress')?.classList.add('is-running');
    mountCancel();
    tickElapsed();
    ticker = setInterval(tickElapsed, 1000);
    render();
  }

  /** Hentikan penghitung & lepas tombol Batal (aman dipanggil berulang). */
  function stop() {
    if (ticker) clearInterval(ticker);
    ticker = null;
    $('#phase1-progress')?.classList.remove('is-running');
    $('#phase1-progress-actions')?.replaceChildren();
    cancelBtn = null;
    tickElapsed();
  }

  /** Terjemahkan satu event job runner / AI menjadi perubahan tampilan. */
  function handle(status) {
    const item = status?.unit ? items.get(status.unit) : null;
    if (!item) return;

    switch (status.state) {
      case 'unit-start':
        item.status = 'active';
        item.chars = 0;
        item.detail = 'Menyiapkan permintaan…';
        break;
      case 'calling':
        item.status = 'active';
        item.detail = status.retry
          ? `Mencoba lagi dengan ${status.modelName || 'model'}…`
          : `Menghubungi ${status.modelName || 'model'}…`;
        break;
      case 'streaming':
        item.status = 'active';
        item.chars = status.chars || 0;
        item.detail = status.thinking
          ? 'Model sedang berpikir…'
          : `Menulis… ${formatChars(item.chars)} karakter`;
        break;
      case 'json-retry':
        item.status = 'active';
        item.detail = 'Format jawaban belum valid, meminta ulang…';
        break;
      case 'completing':
        item.status = 'active';
        item.detail = status.issues?.length
          ? `Melengkapi: ${status.issues[0]}`
          : 'Melengkapi bagian yang kurang…';
        break;
      case 'rate-limited':
      case 'rate-limit-wait':
        item.status = 'waiting';
        item.detail = `Terkena batas permintaan, jeda ${status.seconds || 20} detik…`;
        break;
      case 'falling-back':
        item.status = 'active';
        item.detail = 'Model bermasalah, beralih ke model cadangan…';
        break;
      case 'unit-retry':
        item.status = 'active';
        item.chars = 0;
        item.detail = `Percobaan ${status.attempt}/${status.maxAttempts} gagal, mengulang…`;
        break;
      case 'unit-done':
        item.status = 'done';
        item.detail = item.chars ? `Selesai (${formatChars(item.chars)} karakter)` : 'Selesai';
        announce(`${item.label} selesai`);
        break;
      case 'unit-skipped':
        item.status = 'done';
        item.detail = 'Dilanjutkan dari sesi sebelumnya';
        break;
      case 'unit-failed':
      case 'unit-failed-skipped':
        // 'unit-failed-skipped' menyusul 'unit-failed' — jangan timpa pesan penyebabnya.
        if (status.state === 'unit-failed-skipped' && item.status === 'failed') break;
        item.status = 'failed';
        item.detail = status.error
          ? friendlyError(status.error)
          : 'Gagal — bisa dibuat ulang lewat tombol Regenerate';
        announce(`${item.label} gagal`);
        break;
      default:
        return; // event lain (cooldown, done AI) tidak mengubah tampilan
    }
    render();
  }

  /** Daftar langkah saat ini (untuk render akhir). */
  const snapshot = () => steps();

  /** Tandai bagian yang masih menggantung sebagai gagal (mis. saat dibatalkan). */
  function settle() {
    for (const item of items.values()) {
      if (item.status === 'active' || item.status === 'waiting') {
        item.status = 'pending';
        item.detail = 'Dihentikan — bisa dilanjutkan';
      }
    }
  }

  return { start, stop, handle, render, settle, steps: snapshot, headline: () => lastHeadline };
}
