/**
 * UI pemulihan: banner "generate terputus" & laporan kualitas soal.
 */

import { escapeHtml } from '../core/dom.js';
import {
  COGNITIVE_LEVELS,
  LEVEL_DEFINITIONS,
  summarizeLevels,
} from '../validation/cognitive-level.js';
import { showToast } from './toast.js';

/**
 * Tampilkan banner pemulihan di sebuah card.
 *
 * @param {HTMLElement} container card phase
 * @param {object|null} summary hasil `describeCheckpoint()`
 * @param {{onResume: Function, onDiscard: Function, onRestart?: Function}} handlers
 */
export function renderRecoveryBanner(container, summary, handlers = {}) {
  removeRecoveryBanner(container);
  if (!summary) return null;

  const banner = document.createElement('div');
  banner.className = 'recovery-banner';
  banner.id = 'recovery-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Generate yang terputus sebelumnya');

  const icon = document.createElement('span');
  icon.className = 'recovery-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '♻️';

  const body = document.createElement('div');
  body.className = 'recovery-body';

  const title = document.createElement('div');
  title.className = 'recovery-title';
  title.textContent =
    summary.status === 'interrupted'
      ? 'Generate sebelumnya terputus'
      : 'Ada generate yang belum selesai';

  const detail = document.createElement('div');
  detail.className = 'recovery-detail';
  detail.textContent =
    `${summary.label}: ${summary.done}/${summary.total} bagian selesai` +
    (summary.lastError ? ` — berhenti karena: ${summary.lastError}` : '') +
    ` (${formatAge(summary.ageMs)} lalu)`;

  body.append(title, detail);

  const actions = document.createElement('div');
  actions.className = 'recovery-actions';

  const resumeBtn = document.createElement('button');
  resumeBtn.type = 'button';
  resumeBtn.className = 'btn btn-green btn-sm';
  resumeBtn.textContent =
    summary.done > 0 ? `▶ Lanjutkan (${summary.done} selesai)` : '▶ Lanjutkan';
  resumeBtn.addEventListener('click', () => handlers.onResume?.());

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'btn btn-outline btn-sm';
  restartBtn.textContent = '↺ Mulai ulang';
  restartBtn.addEventListener('click', () => handlers.onRestart?.());

  const discardBtn = document.createElement('button');
  discardBtn.type = 'button';
  discardBtn.className = 'btn btn-outline btn-sm';
  discardBtn.textContent = '🗑 Buang';
  discardBtn.addEventListener('click', () => handlers.onDiscard?.());

  actions.append(resumeBtn, restartBtn, discardBtn);
  banner.append(icon, body, actions);

  // Sisipkan setelah judul card, sebelum progress/actions.
  const anchor = container.querySelector('.card-title');
  if (anchor && anchor.nextSibling) container.insertBefore(banner, anchor.nextSibling);
  else container.prepend(banner);

  return banner;
}

/** Hapus banner pemulihan dari sebuah card. */
export function removeRecoveryBanner(container) {
  container?.querySelector('#recovery-banner')?.remove();
}

/** Format umur checkpoint untuk ditampilkan. */
export function formatAge(ms) {
  if (!ms || ms < 0) return 'baru saja';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

/**
 * Render laporan kualitas soal (distribusi level kognitif + issues).
 *
 * @param {HTMLElement} container preview container
 * @param {object|null} report hasil `checkCompletenessEvaluasi` / Diagnostik
 */
export function renderQualityReport(container, report) {
  container?.querySelector('#quality-report')?.remove();
  if (!report) return null;

  const errors = report.issues || [];
  const warnings = report.warnings || [];
  if (!errors.length && !warnings.length && !report.cognitiveSummary) return null;

  const box = document.createElement('div');
  // Laporan ini untuk peninjauan di layar, bukan isi dokumen RPP.
  box.className = 'issue-report no-print';
  box.id = 'quality-report';

  const sev = document.createElement('span');
  sev.className = `issue-severity ${errors.length ? 'error' : 'warn'}`;
  sev.textContent = errors.length ? `${errors.length} masalah kualitas` : 'Catatan kualitas';
  box.appendChild(sev);

  const title = document.createElement('div');
  title.className = 'issue-title';
  title.textContent = report.cognitiveSummary
    ? 'Analisis kualitas soal evaluasi'
    : 'Catatan kelengkapan';
  box.appendChild(title);

  if (report.cognitiveSummary) {
    box.appendChild(renderDistribution(report.cognitiveSummary));
  }

  const all = [...errors, ...warnings];
  if (all.length) {
    const ul = document.createElement('ul');
    for (const msg of all.slice(0, 12)) {
      const li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
    }
    box.appendChild(ul);
    if (all.length > 12) {
      const more = document.createElement('li');
      more.textContent = `…dan ${all.length - 12} catatan lain.`;
      ul.appendChild(more);
    }
  }

  container?.prepend(box);
  return box;
}

/** Ringkasan distribusi level C1–C6 sebagai bar statistik. */
function renderDistribution(summary) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin:6px 0 8px;';

  const total = summary.total || 0;
  const dist = summary.distribution || summarizeLevels([]).distribution;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;';
  for (const code of COGNITIVE_LEVELS) {
    const n = dist[code] || 0;
    const def = LEVEL_DEFINITIONS[code];
    const chip = document.createElement('span');
    chip.className = 'cognitive-badge';
    chip.dataset.level = code;
    chip.title = `${def.code} — ${def.nama} (${def.bloom}): ${def.deskripsi}`;
    chip.textContent = `${code} ${def.nama} × ${n}`;
    row.appendChild(chip);
  }
  wrap.appendChild(row);

  const meta = document.createElement('div');
  meta.style.cssText = 'font-size:0.78rem;';
  const pct = total ? Math.round((summary.highOrderRatio || 0) * 100) : 0;
  meta.textContent =
    `Total ${total} soal · ${summary.highOrderCount || 0} soal level C3+ (${pct}%)` +
    (summary.inferredCount
      ? ` · ${summary.inferredCount} level diinferensi otomatis dari teks soal (perlu ditinjau guru)`
      : '');
  wrap.appendChild(meta);

  return wrap;
}

/**
 * Toast dengan aksi "Lanjutkan" untuk hasil generate yang gagal sebagian.
 * @param {string} message
 * @param {Function} onResume
 */
export function showResumeToast(message, onResume) {
  return showToast(message, 'warning', {
    actionLabel: 'Lanjutkan',
    onAction: onResume,
    duration: 15000,
  });
}

export { escapeHtml };
