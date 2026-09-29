/**
 * Export gabungan semua phase yang sudah ter-generate.
 */

import { $ } from '../core/dom.js';
import { store } from '../core/store.js';
import { friendlyError } from '../services/ai-client.js';
import { isDocxAvailable } from './docx.js';
import { exportCombinedDOCX } from './docx.js';
import { exportCombinedHTML } from './html.js';
import { printCombined } from './pdf.js';
import { showToast } from '../ui/toast.js';

/** Phase yang benar-benar punya data, dalam urutan dokumen. */
export function availablePhases() {
  const candidates = [
    { id: 'phase1-preview', label: 'RPP & LAMPIRAN', key: 'phase1' },
    { id: 'phase2-preview', label: 'MODUL AJAR', key: 'phase2' },
    { id: 'phase3-preview', label: 'MEDIA PEMBELAJARAN', key: 'phase3' },
  ];
  return candidates.filter((c) => !!store.state[c.key] && $('#' + c.id)?.textContent?.trim());
}

export function exportCombinedPDF() {
  const phases = availablePhases();
  if (!phases.length) {
    showToast('❌ Belum ada data untuk diekspor', 'error');
    return;
  }
  showToast('🔄 Buka dialog Print → pilih "Save as PDF"', 'info', { duration: 7000 });
  printCombined(phases);
}

export async function exportCombinedDOCXSafe() {
  const phases = availablePhases();
  if (!phases.length) {
    showToast('❌ Belum ada data untuk diekspor', 'error');
    return;
  }
  if (!isDocxAvailable()) {
    showToast('❌ Library DOCX belum siap dimuat', 'error');
    return;
  }
  try {
    showToast('📝 Menyiapkan dokumen gabungan...', 'info');
    await exportCombinedDOCX(phases);
    showToast('✅ Combined DOCX berhasil diunduh!', 'success');
  } catch (e) {
    showToast(`❌ Gagal: ${friendlyError(e.message)}`, 'error');
  }
}

export function exportCombinedHTMLSafe() {
  const phases = availablePhases();
  if (!phases.length) {
    showToast('❌ Belum ada data untuk diekspor', 'error');
    return;
  }
  const name = `RPP-Complete-${(store.state.input.madrasah || 'portfolio')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-portfolio.html`;
  if (exportCombinedHTML(phases, name)) {
    showToast('✅ Combined HTML berhasil diunduh!', 'success');
  }
}
