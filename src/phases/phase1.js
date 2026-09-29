/**
 * Orkestrator Phase 1: RPP + Lampiran (5 sub-phase).
 *
 * Alur generate memakai `runResumableJob`, jadi:
 *   - tiap sub-phase yang sukses langsung di-checkpoint,
 *   - gagal di tengah tidak menghapus progress,
 *   - bisa dilanjutkan dari sub-phase terakhir setelah reload.
 *
 * Kecepatan & keterlihatan proses:
 *   - RPP Core (a) berjalan dulu; LKPD, Evaluasi, Remidial/Rubrik, dan
 *     Diagnostik (b–e) hanya butuh RPP Core sehingga dijalankan PARALEL.
 *   - Progres tampil inline lewat `progress-monitor` (status per bagian,
 *     karakter yang sudah ditulis model, waktu berjalan), bukan overlay.
 *   - Pratinjau muncul bertahap: RPP Core tampil begitu selesai, lampiran
 *     menyusul satu per satu.
 */

import { $, setHidden } from '../core/dom.js';
import { store } from '../core/store.js';
import { enterBusy, releaseBusy } from '../core/busy.js';
import {
  EMPTY_PREVIEW,
  SUBPHASES,
  SUBPHASE_CONCURRENCY,
  SUBPHASE_STAGGER_MS,
  TOKEN_LIMITS,
} from '../config.js';
import { buildSubPhasePrompt } from '../prompts/phase1.js';
import { generateWithFallback, friendlyError } from '../services/ai-client.js';
import { COMPLETENESS_CHECKERS, checkCompletenessEvaluasi } from '../validation/completeness.js';
import { buildRPPHTML } from '../render/phase1-renderer.js';
import { renderCodeCogs } from '../services/latex.js';
import { showToast } from '../ui/toast.js';
import {
  showLoading,
  hideLoading,
  setCancellable,
  updateLoadingFromStatus,
} from '../ui/loading.js';
import {
  setPhaseStatus,
  showExportBar,
  showProgressBar,
  showStep,
  updateProgress,
  updateWizardStep,
} from '../ui/wizard.js';
import { createMonitor, skeletonHTML } from '../ui/progress-monitor.js';
import { collectForm } from '../ui/form.js';
import {
  renderQualityReport,
  renderRecoveryBanner,
  removeRecoveryBanner,
  showResumeToast,
} from '../ui/recovery-ui.js';
import { clearCheckpointFor, getResumeContext, runResumableJob } from '../recovery/job-runner.js';
import { getCheckpoint } from '../recovery/checkpoint.js';
import { exportPhaseDOCX } from '../export/docx.js';
import { printElement } from '../export/pdf.js';
import { exportPhaseHTML } from '../export/html.js';

/** AbortController untuk job yang sedang jalan. */
let currentController = null;

/** Kunci sub-phase id -> key data di record job. */
const UNIT_KEYS = { a: 'rpp', b: 'lkpd', c: 'evaluasi', d: 'lampiranAkhir', e: 'diagnostik' };

/**
 * Bangun unit-unit pekerjaan untuk job runner.
 * Setiap unit menghasilkan potongan data; runner yang mengoordinasikan retry,
 * checkpoint, dan paralelisme.
 */
function buildUnits(getContext) {
  return SUBPHASES.map((sp) => ({
    id: sp.id,
    label: sp.label,
    description: sp.description,
    persistKey: UNIT_KEYS[sp.id],
    run: async ({ signal, report }) => {
      const input = store.state.input;
      const { systemPrompt, userPrompt } = buildSubPhasePrompt(sp.id, input, getContext());

      const { data, meta } = await generateWithFallback(systemPrompt, userPrompt, `1${sp.id}`, {
        maxTokens: TOKEN_LIMITS[`1${sp.id}`] || 8000,
        checkCompleteness: COMPLETENESS_CHECKERS[sp.id] || null,
        signal,
        // Teruskan status AI (streaming, retry JSON, rate-limit, fallback model)
        // ke job runner supaya UI bisa menampilkannya per bagian.
        onStatus: (s) =>
          report({
            state: s.state,
            unit: sp.id,
            label: sp.label,
            modelName: s.label,
            chars: s.chars,
            thinking: s.thinking,
            issues: s.issues,
            seconds: s.seconds,
            retry: s.retry,
          }),
      });
      return { data, meta };
    },
  }));
}

/** Konversi record job → bentuk dokumen Phase 1. */
function toPhase1Shape(data) {
  const d = data || {};
  return {
    rpp: d.rpp?.data?.rpp ?? d.rpp?.rpp ?? d.rpp ?? {},
    lampiran: {
      lkpd: pickPayload(d.lkpd, 'lkpd'),
      evaluasi: pickPayload(d.evaluasi, 'evaluasi'),
      programRemidial: d.lampiranAkhir?.data?.programRemidial ?? null,
      programPengayaan: d.lampiranAkhir?.data?.programPengayaan ?? null,
      rubrikPenilaian: d.lampiranAkhir?.data?.rubrikPenilaian ?? null,
      diagnostik: pickPayload(d.diagnostik, 'diagnostik'),
    },
  };
}

/** Ambil payload di bawah key tertentu, atau objek itu sendiri. */
function pickPayload(value, key) {
  if (!value) return null;
  if (value[key]) return value[key];
  // Bentuk dari `validatePhaseJSON` sudah dibungkus { key: ... }.
  if (value.data?.[key]) return value.data[key];
  return value.data ?? value;
}

/** Reset preview & badge Phase 2/3 saat Phase 1 berubah. */
export function resetDownstreamPhases() {
  store.state.phase2 = null;
  store.state.phase3 = null;
  for (const phase of [2, 3]) {
    setPhaseStatus(phase, 'idle');
    const preview = $(`#phase${phase}-preview`);
    if (preview) {
      const { icon, text } = EMPTY_PREVIEW[`phase${phase}`];
      preview.innerHTML = `<div class="preview-empty"><div class="icon">${icon}</div><p>${text}</p></div>`;
    }
    showExportBar(phase, false);
  }
  setHidden($('#combined-export-card'), true);
}

/** Render preview Phase 1. */
export function renderPhase1(phase1Data, report = null) {
  const container = $('#phase1-preview');
  if (!container) return;
  container.innerHTML = renderCodeCogs(buildRPPHTML(phase1Data));
  renderQualityReport(container, report);
}

/**
 * Pratinjau sementara dari data yang sudah terkumpul (selama generate berjalan).
 * Kegagalan render tidak boleh menghentikan job, jadi error ditelan.
 */
function renderPartialPreview(jobData) {
  const container = $('#phase1-preview');
  if (!container) return;
  try {
    const shape = toPhase1Shape(jobData);
    if (!shape.rpp || !Object.keys(shape.rpp).length) return;
    container.innerHTML = renderCodeCogs(buildRPPHTML(shape));
    container.classList.add('is-partial');
  } catch (e) {
    console.warn('[phase1] Pratinjau sementara gagal dirender:', e.message);
  }
}

/**
 * Generate Phase 1.
 * @param {{resume?: boolean}} [opts] resume: lanjutkan dari checkpoint
 */
export async function startPhase1(opts = {}) {
  const resumeCtx = getResumeContext('phase1');
  const isResume = opts.resume && resumeCtx;

  if (!isResume) {
    const input = collectForm();
    if (!input) return;
    clearCheckpointFor('phase1');
  } else {
    // Pakai input dari checkpoint supaya prompt konsisten dengan bagian
    // yang sudah selesai.
    store.state.input = { ...store.state.input, ...(resumeCtx.input || {}) };
  }

  if (!enterBusy('phase1')) return;

  showStep(1);
  showProgressBar(true);
  showExportBar(1, false);
  setHidden($('#phase1-regenerate'), true);
  setHidden($('#phase1-back'), true);
  removeRecoveryBanner($('#step-1'));
  setPhaseStatus(1, 'running');

  const genBtn = $('#phase1-gen-btn');
  if (genBtn) genBtn.disabled = true;

  // Phase 1 baru = Phase 2 & 3 lama tidak berlaku lagi.
  if (store.state.phase2 || store.state.phase3) {
    resetDownstreamPhases();
    showToast('Phase 1 digenerate ulang — Modul Ajar & Media lama dikosongkan.', 'warning');
  }

  currentController = new AbortController();
  setCancellable(currentController);

  const monitor = createMonitor({
    units: SUBPHASES,
    doneIds: isResume ? resumeCtx.completed : [],
    onCancel: () => currentController?.abort(),
  });
  monitor.start();

  // Area pratinjau: lanjutan → tampilkan bagian yang sudah ada; baru → kerangka.
  const previewEl = $('#phase1-preview');
  if (previewEl) previewEl.classList.remove('is-partial');
  if (isResume && Object.keys(resumeCtx.data || {}).length) {
    renderPartialPreview(resumeCtx.data);
  } else if (previewEl) {
    previewEl.innerHTML = skeletonHTML();
  }

  // Konteks untuk sub-phase berikutnya: data yang sudah terkumpul.
  //
  // PENTING: `live` menangkap unit yang SELESAI pada run ini (bukan hanya
  // snapshot resume). Tanpa ini, sub-phase yang berjalan di dalam run yang
  // sama akan menerima RPP Core kosong karena `job.data` baru terisi
  // setelah seluruh job selesai.
  const live = { ...(isResume ? resumeCtx.data : {}) };
  const getContext = () => {
    const ctx = live.rpp;
    return { rpp: ctx?.data?.rpp ?? ctx?.rpp ?? ctx ?? null };
  };

  try {
    const job = await runResumableJob({
      phase: 'phase1',
      label: 'RPP + Lampiran',
      units: buildUnits(getContext),
      input: store.state.input,
      checkpointId: isResume ? resumeCtx.checkpoint.id : null,
      resumeDone: isResume ? resumeCtx.completed : [],
      resumeData: isResume ? resumeCtx.data : {},
      signal: currentController.signal,
      concurrency: SUBPHASE_CONCURRENCY,
      staggerMs: SUBPHASE_STAGGER_MS,
      onUnit: (unit, result, allData) => {
        live[unit.persistKey] = result;
        Object.assign(live, allData);
        // Tampilkan hasil begitu tersedia — pengguna tidak perlu menunggu semua bagian.
        renderPartialPreview(allData);
      },
      onStatus: (status) => monitor.handle(status),
    });

    monitor.stop();

    if (job.aborted) {
      monitor.settle();
      setPhaseStatus(1, 'partial');
      updateProgress(
        Math.round((job.doneCount / job.total) * 100),
        'Dibatalkan — progress tersimpan',
        monitor.steps()
      );
      showResumeToast(
        `Generate dibatalkan. ${job.doneCount}/${job.total} bagian selesai & tersimpan.`,
        () => startPhase1({ resume: true })
      );
      return;
    }

    const phase1Data = toPhase1Shape(job.data);

    if (!phase1Data.rpp || !Object.keys(phase1Data.rpp).length) {
      // Jangan hanya menulis "gagal" — `job.error` menyimpan penyebab NYATA
      // (API key ditolak, rate limit, timeout, JSON tidak bisa di-parse, dll).
      const cause = job.error?.message || describeJobFailure(job);
      throw new Error(`RPP Core gagal: ${cause}`);
    }

    // Simpan laporan kualitas gabungan.
    const report = buildCombinedReport(phase1Data);
    store.state.phaseReports[1] = report;
    store.state.phase1 = phase1Data;

    previewEl?.classList.remove('is-partial');
    renderPhase1(phase1Data, report);
    setPhaseStatus(1, job.failed.length ? 'partial' : 'success');
    updateProgress(100, job.failed.length ? 'Sebagian selesai' : 'Selesai', monitor.steps());
    showExportBar(1, true);
    // Bar Regenerate dulu tersembunyi permanen sehingga fitur regenerate per
    // bagian tak terjangkau; sekarang tampil setelah generate selesai.
    setHidden($('#phase1-regenerate'), false);
    setHidden($('#phase1-back'), false);
    updateWizardStep(1, 'done');

    if (job.failed.length) {
      showToast(
        `${job.completed ? 'Phase 1 selesai' : 'Sebagian gagal'}: ${job.total - job.failed.length}/${job.total} bagian. Bagian yang gagal bisa dilengkapi dengan Regenerate.`,
        'warning'
      );
    } else {
      showToast(`RPP + Lampiran berhasil digenerate (${job.total} bagian)!`, 'success');
    }
  } catch (e) {
    monitor.stop();
    monitor.settle();
    setPhaseStatus(1, 'error');
    updateProgress(0, `Gagal: ${friendlyError(e.message)}`, monitor.steps());
    // Kembalikan area pratinjau ke keadaan kosong bila belum ada hasil apa pun.
    if (previewEl && previewEl.querySelector('.skeleton')) {
      const { icon, text } = EMPTY_PREVIEW.phase1;
      previewEl.innerHTML = `<div class="preview-empty"><div class="icon">${icon}</div><p>${text}</p></div>`;
    }
    showToast(friendlyError(e.message), 'error', {
      actionLabel: 'Lanjutkan',
      onAction: () => startPhase1({ resume: true }),
    });
  } finally {
    monitor.stop();
    if (genBtn) genBtn.disabled = false;
    currentController = null;
    hideLoading();
    releaseBusy('phase1');
    showRecoveryBannerIfNeeded();
  }
}

/**
 * Rangkuman kegagalan yang bisa ditindaklanjuti.
 *
 * Dipakai kalau `job.error` kosong — misalnya unit wajib selesai tapi payload-nya
 * tidak berisi dokumen (kasus "RPP Core kosong"). Sumber kebenaran tetap
 * `lastError` di checkpoint, karena di situ runner menulis pesan sebenarnya.
 */
export function describeJobFailure(job) {
  const cp = job?.checkpointId ? getCheckpoint(job.checkpointId) : null;
  if (cp?.lastError) return cp.lastError;

  const failedNames = (job?.failed || [])
    .map((id) => SUBPHASES.find((sp) => sp.id === id)?.label || id)
    .join(', ');
  if (failedNames) return `bagian gagal: ${failedNames}`;

  return 'respons AI tidak berisi dokumen RPP. Periksa API key, kuota, dan koneksi, lalu coba lagi.';
}

/** Susun laporan kualitas dari data Phase 1 yang sudah ter-shape. */
function buildCombinedReport(phase1Data) {
  const ev = phase1Data?.lampiran?.evaluasi;
  if (!ev?.soal?.length) return null;
  // Validasi ulang di data final supaya laporan selalu cocok dengan yang
  // benar-benar akan ditampilkan pengguna.
  return checkCompletenessEvaluasi({ evaluasi: ev });
}

/** Tampilkan banner pemulihan bila masih ada checkpoint belum selesai. */
export function showRecoveryBannerIfNeeded() {
  const card = $('#step-1');
  if (!card) return;
  const ctx = getResumeContext('phase1');
  if (!ctx || ctx.completed.length === 0) {
    removeRecoveryBanner(card);
    return;
  }
  renderRecoveryBanner(card, ctx.summary, {
    onResume: () => startPhase1({ resume: true }),
    onRestart: () => {
      clearCheckpointFor('phase1');
      startPhase1();
    },
    onDiscard: () => {
      clearCheckpointFor('phase1');
      removeRecoveryBanner(card);
      showToast('Checkpoint dibuang.', 'info');
    },
  });
}

// ---------------------------------------------------------------------------
// Regenerate per bagian
// ---------------------------------------------------------------------------

/**
 * Generate ulang satu bagian Phase 1 tanpa mengulang bagian lain.
 * @param {number} partIndex 0–4 sesuai SUBPHASES
 */
export async function regeneratePart(partIndex) {
  if (!store.state.phase1) {
    showToast('Belum ada data Phase 1!', 'warning');
    return;
  }
  const sp = SUBPHASES[partIndex];
  if (!sp) return;

  const confirmed = window.confirm(
    `Generate ulang "${sp.label}"? Bagian ini akan diganti dengan hasil baru.`
  );
  if (!confirmed) return;
  if (!enterBusy('regen')) return;

  const controller = new AbortController();
  setCancellable(controller);
  showLoading(`Membuat ulang ${sp.label}…`, 'Bagian lain tidak berubah', {
    showCancel: true,
    onCancel: () => controller.abort(),
  });
  try {
    const { systemPrompt, userPrompt } = buildSubPhasePrompt(sp.id, store.state.input, {
      rpp: store.state.phase1.rpp,
    });
    const { data, meta } = await generateWithFallback(systemPrompt, userPrompt, `1${sp.id}`, {
      maxTokens: TOKEN_LIMITS[`1${sp.id}`] || 8000,
      checkCompleteness: COMPLETENESS_CHECKERS[sp.id] || null,
      signal: controller.signal,
      onStatus: (s) => updateLoadingFromStatus({ ...s, label: sp.label }),
    });
    applyPartToPhase1(store.state.phase1, partIndex, data);
    store.state.phaseReports[1] = meta;
    renderPhase1(store.state.phase1, meta);
    showToast(`${sp.label} berhasil dibuat ulang!`, 'success');
  } catch (e) {
    if (e?.name === 'AbortError') {
      showToast(`Pembuatan ulang ${sp.label} dibatalkan.`, 'info');
    } else {
      showToast(`Gagal membuat ulang ${sp.label}: ${friendlyError(e.message)}`, 'error');
    }
  } finally {
    hideLoading();
    releaseBusy('regen');
  }
}

/** Terapkan hasil sub-phase ke struktur Phase 1. */
function applyPartToPhase1(phase1, partIndex, data) {
  switch (partIndex) {
    case 0:
      phase1.rpp = data.rpp?.rpp ?? data.rpp ?? {};
      break;
    case 1:
      phase1.lampiran.lkpd = pickPayload(data, 'lkpd');
      break;
    case 2:
      phase1.lampiran.evaluasi = pickPayload(data, 'evaluasi');
      break;
    case 3:
      phase1.lampiran.programRemidial = data.programRemidial ?? null;
      phase1.lampiran.programPengayaan = data.programPengayaan ?? null;
      phase1.lampiran.rubrikPenilaian = data.rubrikPenilaian ?? null;
      break;
    case 4:
      phase1.lampiran.diagnostik = pickPayload(data, 'diagnostik');
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportPhase1PDF() {
  printElement('phase1-preview', 'RPP');
}

export async function exportPhase1DOCX() {
  try {
    await exportPhaseDOCX('phase1-preview', 'RPP.docx');
    showToast('DOCX berhasil diunduh!', 'success');
  } catch (e) {
    showToast(`Gagal export DOCX: ${friendlyError(e.message)}`, 'error');
  }
}

export function exportPhase1HTML() {
  const madrasah = store.state.input.madrasah || 'RPP';
  if (exportPhaseHTML('phase1-preview', `RPP-${slug(madrasah)}-portfolio.html`)) {
    showToast('HTML berhasil diunduh!', 'success');
  }
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
