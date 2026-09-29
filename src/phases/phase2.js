/**
 * Orkestrator Phase 2: Modul Ajar.
 * Satu unit kerja, tapi tetap lewat job runner supaya konsisten dengan
 * Phase 1 (checkpoint, batal, banner pemulihan).
 */

import { $ } from '../core/dom.js';
import { store } from '../core/store.js';
import { enterBusy, releaseBusy } from '../core/busy.js';
import { TOKEN_LIMITS } from '../config.js';
import { buildModulAjarPrompt } from '../prompts/phase2.js';
import { generateWithFallback, friendlyError } from '../services/ai-client.js';
import { checkCompletenessModulAjar } from '../validation/completeness.js';
import { buildModulAjarHTML } from '../render/phase2-renderer.js';
import { renderCodeCogs } from '../services/latex.js';
import { showToast } from '../ui/toast.js';
import {
  showLoading,
  hideLoading,
  setCancellable,
  updateLoadingFromStatus,
} from '../ui/loading.js';
import { setPhaseStatus, showExportBar, showStep, updateWizardStep } from '../ui/wizard.js';
import {
  renderQualityReport,
  renderRecoveryBanner,
  removeRecoveryBanner,
  showResumeToast,
} from '../ui/recovery-ui.js';
import { clearCheckpointFor, getResumeContext, runResumableJob } from '../recovery/job-runner.js';
import { exportPhaseDOCX } from '../export/docx.js';
import { printElement } from '../export/pdf.js';
import { exportPhaseHTML } from '../export/html.js';
import { slug } from './phase1.js';

const PHASE = 'phase2';
const UNIT_ID = 'modul';

let currentController = null;

/** Render preview Phase 2. */
export function renderPhase2(data, report = null) {
  const container = $('#phase2-preview');
  if (!container) return;
  container.innerHTML = renderCodeCogs(buildModulAjarHTML(data));
  renderQualityReport(container, report);
}

/**
 * Generate Modul Ajar.
 * @param {{resume?: boolean}} [opts]
 */
export async function startPhase2(opts = {}) {
  if (!store.state.phase1) {
    showToast('Generate RPP (Phase 1) dulu!', 'warning');
    return;
  }

  const resumeCtx = opts.resume ? getResumeContext(PHASE) : null;
  const isResume = !!resumeCtx;

  if (!isResume) clearCheckpointFor(PHASE);
  if (!enterBusy('phase2')) return;

  const btn = $('#phase2-gen-btn');
  const card = $('#step-2');
  if (btn) btn.disabled = true;
  removeRecoveryBanner(card);
  setPhaseStatus(2, 'running');
  showExportBar(2, false);

  currentController = new AbortController();
  setCancellable(currentController);
  showLoading('Generate Phase 2: Modul Ajar', 'Mohon tunggu, biasanya 1–2 menit', {
    showCancel: true,
    onCancel: () => currentController?.abort(),
  });

  try {
    const job = await runResumableJob({
      phase: PHASE,
      label: 'Modul Ajar',
      units: [
        {
          id: UNIT_ID,
          label: 'Modul Ajar',
          persistKey: UNIT_ID,
          run: async ({ signal, report }) => {
            report({ state: 'unit-start', unit: UNIT_ID, label: 'Modul Ajar' });
            const { systemPrompt, userPrompt } = buildModulAjarPrompt(
              store.state.input,
              store.state.phase1
            );
            const { data, meta } = await generateWithFallback(systemPrompt, userPrompt, '2', {
              maxTokens: TOKEN_LIMITS[2],
              checkCompleteness: checkCompletenessModulAjar,
              signal,
              onStatus: (s) => updateLoadingFromStatus(s),
            });
            return { data, meta };
          },
        },
      ],
      input: store.state.input,
      checkpointId: isResume ? resumeCtx.checkpoint.id : null,
      resumeDone: isResume ? resumeCtx.completed : [],
      resumeData: isResume ? resumeCtx.data : {},
      signal: currentController.signal,
      onStatus: (status) => updateLoadingFromStatus(status),
    });

    if (job.aborted) {
      setPhaseStatus(2, 'partial');
      showResumeToast('⏹ Generate Modul Ajar dibatalkan.', () => startPhase2({ resume: true }));
      return;
    }

    const payload = job.data[UNIT_ID]?.data ?? job.data[UNIT_ID];
    if (!payload) throw new Error('Modul Ajar gagal digenerate');

    const report = checkCompletenessModulAjar(payload);
    store.state.phase2 = payload;
    store.state.phaseReports[2] = report;

    renderPhase2(payload, report);
    setPhaseStatus(2, report.ok ? 'success' : 'partial');
    showExportBar(2, true);
    updateWizardStep(2, 'done');
    showToast(
      report.ok
        ? '✅ Modul Ajar berhasil digenerate!'
        : `⚠️ Modul Ajar digenerate dengan catatan: ${report.issues[0]}`,
      report.ok ? 'success' : 'warning'
    );
  } catch (e) {
    setPhaseStatus(2, 'error');
    showToast(`❌ ${friendlyError(e.message)}`, 'error', {
      actionLabel: 'Coba Lagi',
      onAction: () => startPhase2(),
    });
  } finally {
    if (btn) btn.disabled = false;
    currentController = null;
    hideLoading();
    releaseBusy(PHASE);
    showRecoveryBannerIfNeeded();
  }
}

/** Banner pemulihan Phase 2. */
export function showRecoveryBannerIfNeeded() {
  const card = $('#step-2');
  if (!card) return;
  const ctx = getResumeContext(PHASE);
  if (!ctx) {
    removeRecoveryBanner(card);
    return;
  }
  renderRecoveryBanner(card, ctx.summary, {
    onResume: () => startPhase2({ resume: true }),
    onRestart: () => {
      clearCheckpointFor(PHASE);
      startPhase2();
    },
    onDiscard: () => {
      clearCheckpointFor(PHASE);
      removeRecoveryBanner(card);
      showToast('Checkpoint dibuang.', 'info');
    },
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportPhase2PDF() {
  printElement('phase2-preview', 'Modul Ajar');
}

export async function exportPhase2DOCX() {
  try {
    await exportPhaseDOCX('phase2-preview', 'ModulAjar.docx');
    showToast('✅ DOCX berhasil diunduh!', 'success');
  } catch (e) {
    showToast(`❌ Gagal export DOCX: ${friendlyError(e.message)}`, 'error');
  }
}

export function exportPhase2HTML() {
  const base = `ModulAjar-${slug(store.state.input.madrasah || 'materi')}`;
  if (exportPhaseHTML('phase2-preview', `${base}-portfolio.html`)) {
    showToast('✅ HTML berhasil diunduh!', 'success');
  }
}

export { showStep };
