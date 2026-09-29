/**
 * Orkestrator Phase 3: Media Pembelajaran.
 */

import { $, setHidden } from '../core/dom.js';
import { store } from '../core/store.js';
import { enterBusy, releaseBusy } from '../core/busy.js';
import { TOKEN_LIMITS } from '../config.js';
import { buildMediaPrompt } from '../prompts/phase3.js';
import { generateWithFallback, friendlyError } from '../services/ai-client.js';
import { checkCompletenessMedia } from '../validation/completeness.js';
import { buildMediaHTML } from '../render/phase3-renderer.js';
import { renderCodeCogs } from '../services/latex.js';
import { showToast } from '../ui/toast.js';
import {
  showLoading,
  hideLoading,
  setCancellable,
  updateLoadingFromStatus,
} from '../ui/loading.js';
import { setPhaseStatus, showExportBar, updateWizardStep } from '../ui/wizard.js';
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

const PHASE = 'phase3';
const UNIT_ID = 'media';

let currentController = null;

/** Render preview Phase 3. */
export function renderPhase3(data, report = null) {
  const container = $('#phase3-preview');
  if (!container) return;
  container.innerHTML = renderCodeCogs(buildMediaHTML(data));
  renderQualityReport(container, report);
}

/**
 * Generate Media Pembelajaran.
 * @param {{resume?: boolean}} [opts]
 */
export async function startPhase3(opts = {}) {
  if (!store.state.phase1) {
    showToast('Generate RPP (Phase 1) dulu!', 'warning');
    return;
  }

  const resumeCtx = opts.resume ? getResumeContext(PHASE) : null;
  const isResume = !!resumeCtx;

  if (!isResume) clearCheckpointFor(PHASE);
  if (!enterBusy('phase3')) return;

  const btn = $('#phase3-gen-btn');
  const card = $('#step-3');
  if (btn) btn.disabled = true;
  removeRecoveryBanner(card);
  setPhaseStatus(3, 'running');
  showExportBar(3, false);

  currentController = new AbortController();
  setCancellable(currentController);
  showLoading('Generate Phase 3: Media Pembelajaran', 'Mohon tunggu, biasanya 1–2 menit', {
    showCancel: true,
    onCancel: () => currentController?.abort(),
  });

  try {
    const job = await runResumableJob({
      phase: PHASE,
      label: 'Media Pembelajaran',
      units: [
        {
          id: UNIT_ID,
          label: 'Media Pembelajaran',
          persistKey: UNIT_ID,
          run: async ({ signal, report }) => {
            report({ state: 'unit-start', unit: UNIT_ID, label: 'Media Pembelajaran' });
            const { systemPrompt, userPrompt } = buildMediaPrompt(
              store.state.input,
              store.state.phase1
            );
            const { data, meta } = await generateWithFallback(systemPrompt, userPrompt, '3', {
              maxTokens: TOKEN_LIMITS[3],
              checkCompleteness: checkCompletenessMedia,
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
      setPhaseStatus(3, 'partial');
      showResumeToast('⏹ Generate Media Pembelajaran dibatalkan.', () =>
        startPhase3({ resume: true })
      );
      return;
    }

    const payload = job.data[UNIT_ID]?.data ?? job.data[UNIT_ID];
    if (!payload) throw new Error('Media Pembelajaran gagal digenerate');

    const report = checkCompletenessMedia(payload);
    store.state.phase3 = payload;
    store.state.phaseReports[3] = report;

    renderPhase3(payload, report);
    setPhaseStatus(3, report.ok ? 'success' : 'partial');
    showExportBar(3, true);
    setHidden($('#combined-export-card'), false);
    updateWizardStep(3, 'done');
    showToast(
      report.ok
        ? '✅ Media Pembelajaran berhasil digenerate!'
        : `⚠️ Media digenerate dengan catatan: ${report.issues[0]}`,
      report.ok ? 'success' : 'warning'
    );
  } catch (e) {
    setPhaseStatus(3, 'error');
    showToast(`❌ ${friendlyError(e.message)}`, 'error', {
      actionLabel: 'Coba Lagi',
      onAction: () => startPhase3(),
    });
  } finally {
    if (btn) btn.disabled = false;
    currentController = null;
    hideLoading();
    releaseBusy(PHASE);
    showRecoveryBannerIfNeeded();
  }
}

/** Banner pemulihan Phase 3. */
export function showRecoveryBannerIfNeeded() {
  const card = $('#step-3');
  if (!card) return;
  const ctx = getResumeContext(PHASE);
  if (!ctx) {
    removeRecoveryBanner(card);
    return;
  }
  renderRecoveryBanner(card, ctx.summary, {
    onResume: () => startPhase3({ resume: true }),
    onRestart: () => {
      clearCheckpointFor(PHASE);
      startPhase3();
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

export function exportPhase3PDF() {
  printElement('phase3-preview', 'Media Pembelajaran');
}

export async function exportPhase3DOCX() {
  try {
    await exportPhaseDOCX('phase3-preview', 'MediaPembelajaran.docx');
    showToast('✅ DOCX berhasil diunduh!', 'success');
  } catch (e) {
    showToast(`❌ Gagal export DOCX: ${friendlyError(e.message)}`, 'error');
  }
}

export function exportPhase3HTML() {
  const base = `MediaPembelajaran-${slug(store.state.input.madrasah || 'materi')}`;
  if (exportPhaseHTML('phase3-preview', `${base}-portfolio.html`)) {
    showToast('✅ HTML berhasil diunduh!', 'success');
  }
}
