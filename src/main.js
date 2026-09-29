/**
 * Entry point aplikasi.
 *
 * Tanggung jawab file ini hanya "menyambungkan":
 *   - import seluruh modul,
 *   - pasang listener (event delegation, bukan inline onclick),
 *   - jalankan init (settings, form, wizard, recovery).
 *
 * Logika bisnis tetap tinggal di modulnya masing-masing.
 */

import './styles/app.css';
import './styles/experience.css';
import './styles/document.css';

import { $, $$, delegate, setHidden } from './core/dom.js';
import { store } from './core/store.js';
import { on } from './core/events.js';
import { releaseAll } from './core/busy.js';
import { EMPTY_PREVIEW } from './config.js';

import { showToast } from './ui/toast.js';
import {
  showStep,
  setPhaseStatus,
  showExportBar,
  toggleSettings,
  updateProgress,
} from './ui/wizard.js';
import { handleTestAPI, initSettingsPanel, saveSettings } from './ui/settings-panel.js';
import { clearDraft, initFormAutosave } from './ui/form.js';
import { hideLoading } from './ui/loading.js';
import { cleanupPrintArea } from './export/pdf.js';

import { markOrphansInterrupted } from './recovery/checkpoint.js';
import { showRecoveryBannerIfNeeded as showPhase1Recovery, startPhase1 } from './phases/phase1.js';
import {
  exportPhase1DOCX,
  exportPhase1HTML,
  exportPhase1PDF,
  regeneratePart,
} from './phases/phase1.js';
import {
  showRecoveryBannerIfNeeded as showPhase2Recovery,
  startPhase2,
  exportPhase2DOCX,
  exportPhase2HTML,
  exportPhase2PDF,
} from './phases/phase2.js';
import {
  showRecoveryBannerIfNeeded as showPhase3Recovery,
  startPhase3,
  exportPhase3DOCX,
  exportPhase3HTML,
  exportPhase3PDF,
} from './phases/phase3.js';
import {
  exportCombinedDOCXSafe,
  exportCombinedHTMLSafe,
  exportCombinedPDF,
} from './export/combined.js';

// ---------------------------------------------------------------------------
// Delegasi aksi
// ---------------------------------------------------------------------------

/** Peta `data-action` → handler. */
const ACTIONS = {
  'toggle-settings': () => toggleSettings(),
  'save-settings': () => saveSettings(),
  'test-api': (el) => handleTestAPI(el),
  'reset-all': () => resetAll(),
  'goto-step': (el) => {
    const step = parseInt(el.dataset.stepTarget, 10);
    if (!Number.isNaN(step)) showStep(step);
  },

  'start-phase1': () => startPhase1(),
  'fill-example': () => fillExample(),
  'start-phase2': () => startPhase2(),
  'start-phase3': () => startPhase3(),
  'regenerate-part': (el) => regeneratePart(parseInt(el.dataset.part, 10)),

  'export-phase1-pdf': () => exportPhase1PDF(),
  'export-phase1-docx': () => exportPhase1DOCX(),
  'export-phase1-html': () => exportPhase1HTML(),
  'export-phase2-pdf': () => exportPhase2PDF(),
  'export-phase2-docx': () => exportPhase2DOCX(),
  'export-phase2-html': () => exportPhase2HTML(),
  'export-phase3-pdf': () => exportPhase3PDF(),
  'export-phase3-docx': () => exportPhase3DOCX(),
  'export-phase3-html': () => exportPhase3HTML(),

  'export-combined-pdf': () => exportCombinedPDF(),
  'export-combined-docx': () => exportCombinedDOCXSafe(),
  'export-combined-html': () => exportCombinedHTMLSafe(),
  // Catatan: tombol "Batalkan" sengaja TIDAK memakai data-action — ia dibuat
  // oleh showLoading() dan mengikat callback onCancel-nya sendiri. Menambahkan
  // 'cancel-generate' di sini akan membuat satu klik memicu abort dua kali.
};

// ---------------------------------------------------------------------------
// Data contoh
// ---------------------------------------------------------------------------

/** Data contoh generik agar pengguna baru bisa langsung mencoba alurnya. */
const EXAMPLE_INPUT = {
  'inp-madrasah': 'MTs Contoh Nusantara',
  'inp-mapel': 'Ilmu Pengetahuan Alam (IPA)',
  'inp-materi': 'Sel Hewan dan Sel Tumbuhan',
  'inp-elemen': 'Pemahaman IPA',
  'inp-guru': 'Siti Nafisah, S.Pd.I',
  'inp-fase': 'D/VIII/1',
  'inp-tahun-pelajaran': '2026/2027',
  'inp-alkok': '2 X 40 Menit',
  'inp-kepsek': 'Ahmad Jazuli, S.Pd',
  'inp-tempat': 'Temanggung',
  'inp-cp':
    'Pada akhir fase D, peserta didik mampu mengidentifikasi sel sebagai unit struktural dan fungsional makhluk hidup serta membedakan struktur sel hewan dan sel tumbuhan.',
  'inp-tp':
    '1. Peserta didik mampu mendeskripsikan struktur dan fungsi organel sel.\n2. Peserta didik mampu membedakan sel hewan dan sel tumbuhan melalui pengamatan mikroskop.',
  'inp-atp': 'Pertemuan 1: struktur sel. Pertemuan 2: perbandingan sel hewan dan tumbuhan.',
};

/** Isi form dengan data contoh (hanya field yang masih kosong, atau setelah konfirmasi). */
function fillExample() {
  const filled = Object.keys(EXAMPLE_INPUT).some((id) => $(`#${id}`)?.value?.trim());
  if (filled && !window.confirm('Isian yang sudah ada akan ditimpa data contoh. Lanjutkan?')) return;

  for (const [id, value] of Object.entries(EXAMPLE_INPUT)) {
    const el = $(`#${id}`);
    if (!el) continue;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true })); // picu autosave draft
  }
  const tanggal = $('#inp-tanggal');
  if (tanggal) {
    tanggal.value = new Date().toISOString().slice(0, 10);
    tanggal.dispatchEvent(new Event('input', { bubbles: true }));
  }
  showToast('Data contoh terisi. Ubah sesuai kebutuhan, lalu klik Generate.', 'info');
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/** Kembalikan aplikasi ke kondisi awal. */
function resetAll() {
  if (!window.confirm('Reset semua data? Data yang belum disimpan akan hilang.')) return;

  releaseAll();
  hideLoading();
  cleanupPrintArea();
  store.resetAll();

  $('#rpp-form')?.reset();
  clearDraft();

  for (const phase of [1, 2, 3]) {
    const preview = $(`#phase${phase}-preview`);
    if (preview) {
      const { icon, text } = EMPTY_PREVIEW[`phase${phase}`];
      preview.innerHTML = `<div class="preview-empty"><div class="icon">${icon}</div><p>${text}</p></div>`;
    }
    setPhaseStatus(phase, 'idle');
    showExportBar(phase, false);
  }

  setHidden($('#phase1-back'), true);
  setHidden($('#phase1-regenerate'), true);
  setHidden($('#phase1-progress'), true);
  setHidden($('#combined-export-card'), true);
  const fill = $('#phase1-progress-fill');
  if (fill) fill.style.width = '0%';
  const steps = $('#phase1-progress-steps');
  if (steps) steps.innerHTML = '';
  updateProgress(0, 'Memulai...', null);

  showStep(0);
  showToast('↺ Reset berhasil', 'info');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  // 1. Pengaturan (load + isi form pengaturan).
  initSettingsPanel();

  // 2. Autosave form + pemulihan isian.
  const draftRestored = initFormAutosave();
  if (draftRestored) {
    showToast('📋 Isian form dipulihkan dari sesi sebelumnya.', 'info');
  }

  // 3. Delegasi aksi global (menggantikan inline onclick).
  delegate('click', ACTIONS);
  // Wizard step: `<li>` bukan button, jadi pastikan bisa difokus & diaktifkan
  // lewat keyboard untuk aksesibilitas.
  $$('.wizard-step[data-action]').forEach((el) => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  // 4. Checkpoint `running` dari sesi lalu = prosesnya terputus.
  const orphans = markOrphansInterrupted();
  if (orphans.length) {
    const done = orphans.reduce((n, cp) => n + (cp.completed?.length || 0), 0);
    showToast(
      `♻️ Ditemukan ${orphans.length} generate yang terputus (${done} bagian sudah selesai). Buka langkahnya untuk melanjutkan.`,
      'warning',
      { duration: 10000 }
    );
  }

  // 5. Tampilkan banner pemulihan di card yang relevan.
  //    Semua phase diperiksa, bukan cuma Phase 1: checkpoint Phase 2/3 bisa
  //    tersisa dari sesi sebelumnya kalau tab tertutup saat generate berjalan.
  showPhase1Recovery();
  showPhase2Recovery();
  showPhase3Recovery();

  // 6. Navigasi awal.
  showStep(0);

  // 7. Reaksi event: busy lock & error global.
  on('busy:rejected', ({ message }) => showToast(message, 'warning'));

  // 8. Peringatan sebelum menutup tab saat ada job berjalan — supaya user
  //    tidak kehilangan progress tanpa sengaja.
  window.addEventListener('beforeunload', (e) => {
    if (store.state.activeJob) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // 9. Deteksi proses yang menggantung (tab di-throttle/hibernasi).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && store.state.activeJob) {
      showToast('⏳ Generate masih berjalan di latar belakang...', 'info', { duration: 3000 });
    }
  });
}

// Jalankan setelah DOM siap (script/module selalu defer, tapi tetap aman).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
