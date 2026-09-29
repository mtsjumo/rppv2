/**
 * Navigasi wizard (4 langkah) & progress bar Phase 1.
 */

import { $, $$, setHidden, setText, scrollIntoViewSafe } from '../core/dom.js';
import { store } from '../core/store.js';
import { emit } from '../core/events.js';
import { SUBPHASES } from '../config.js';

const STEP_IDS = ['step-0', 'step-1', 'step-2', 'step-3'];

/** Pindah ke langkah tertentu. */
export function showStep(step) {
  store.state.currentStep = step;

  STEP_IDS.forEach((id) => setHidden(document.getElementById(id), true));
  $$('.wizard-step').forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.toggle('done', s < step);
    el.classList.toggle('active', s === step);
  });

  const target = document.getElementById(`step-${step}`);
  if (target) {
    setHidden(target, false);
    scrollIntoViewSafe(target, { behavior: 'smooth', block: 'start' });
  }

  if (store.allPhasesReady()) {
    setHidden($('#combined-export-card'), false);
  }
}

/** Tandai satu langkah wizard sebagai selesai. */
export function updateWizardStep(step, status) {
  const el = document.querySelector(`.wizard-step[data-step="${step}"]`);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (status === 'done') el.classList.add('done');
  else if (status === 'active') el.classList.add('active');
}

/** Tampilkan atau sembunyikan panel pengaturan. */
export function toggleSettings(force) {
  const panel = $('#settings-panel');
  const body = $('#settings-body');
  const arrow = $('#settings-arrow');
  if (!panel) return;
  const willShow = force ?? panel.classList.contains('hidden');
  setHidden(panel, !willShow);
  if (body) body.style.display = willShow ? '' : 'none';
  if (arrow) arrow.textContent = willShow ? '▼' : '▲';
}

/** Status badge sebuah phase: 'idle' | 'running' | 'success' | 'error' | 'partial'. */
const STATUS_META = {
  idle: { cls: 'pending', text: '⏳ Belum digenerate' },
  running: { cls: 'loading', text: '⏳ Mengenerate...' },
  success: { cls: 'success', text: '✅ Selesai' },
  partial: { cls: 'loading', text: '⚠️ Sebagian selesai' },
  error: { cls: 'error', text: '❌ Gagal' },
};

/**
 * Perbarui badge status phase.
 * @param {1|2|3} phase
 * @param {keyof STATUS_META|{cls: string, text: string}} status
 */
export function setPhaseStatus(phase, status) {
  const el = $(`#phase${phase}-status`);
  if (!el) return;
  const meta = typeof status === 'string' ? STATUS_META[status] : status;
  el.className = `phase-status ${meta.cls}`;
  el.textContent = meta.text;
  store.state.phaseStatus[phase] = typeof status === 'string' ? status : 'custom';
}

/** Tampilkan bar export sebuah phase. */
export function showExportBar(phase, show) {
  setHidden($(`#phase${phase}-export`), !show);
}

// ---------------------------------------------------------------------------
// Progress bar Phase 1
// ---------------------------------------------------------------------------

/**
 * Perbarui progress bar Phase 1.
 * @param {number} pct 0–100
 * @param {string} label
 * @param {Array<{label: string, description?: string, done?: boolean, active?: boolean}>} [steps]
 */
export function updateProgress(pct, label, steps) {
  const fill = $('#phase1-progress-fill');
  const pctEl = $('#phase1-progress-pct');
  const labelEl = $('#phase1-progress-label');

  if (fill) fill.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (labelEl) labelEl.textContent = label;

  if (steps) {
    const container = $('#phase1-progress-steps');
    if (container) container.replaceChildren(...steps.map(stepNode));
  }
  emit('progress:update', { pct, label, steps });
}

function stepNode(s) {
  const el = document.createElement('div');
  el.className = `progress-step-item ${s.done ? 'done' : s.active ? 'active' : 'pending'}`;

  const icon = document.createElement('span');
  icon.className = 'p-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = s.done ? '✅' : s.active ? '⏳' : '⏺️';

  const label = document.createElement('span');
  label.textContent = s.active && s.description ? `${s.label} — ${s.description}` : s.label;

  el.append(icon, label);
  return el;
}

/** Tampilkan/sembunyikan container progress. */
export function showProgressBar(show) {
  setHidden($('#phase1-progress'), !show);
}

/**
 * Susun daftar status sub-phase untuk ditampilkan.
 * @param {number} activeIndex
 * @param {string[]} [doneUnits] id sub-phase yang sudah selesai (untuk resume)
 * @returns {Array}
 */
export function buildStepList(activeIndex, doneUnits = []) {
  return SUBPHASES.map((s, idx) => ({
    ...s,
    done: doneUnits.includes(s.id) || idx < activeIndex,
    active: idx === activeIndex,
    pending: idx > activeIndex && !doneUnits.includes(s.id),
  }));
}

export { setText };
