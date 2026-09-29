/**
 * Export PDF/Print.
 *
 * Menggunakan dialog print browser ("Save as PDF") — jauh lebih andal &
 * ringan daripada html2pdf.js yang sering gagal untuk dokumen 25+ halaman
 * (tabel besar, LaTeX, page-break). Semua styling dokumen sudah di
 * `@media print`.
 */

import { $$ } from '../core/dom.js';

/** Area cetak yang sedang aktif, untuk dibersihkan setelah selesai. */
let activePrintArea = null;

/**
 * Cetak satu elemen preview sebagai PDF.
 * @param {string} elementId id container preview
 * @param {string} [label] nama untuk pesan toast
 */
export function printElement(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return false;
  el.classList.add('print-area');
  runPrint(() => el.classList.remove('print-area'));
  return true;
}

/**
 * Cetak beberapa phase sebagai satu PDF (dengan page-break di antaranya).
 * @param {Array<{id: string, label: string}>} phases
 */
export function printCombined(phases) {
  const temp = document.createElement('div');
  temp.className = 'print-area';
  temp.style.cssText = 'position:absolute;left:0;top:0;width:100%;z-index:9999;background:#fff;';

  let appended = 0;
  for (const { id, label } of phases) {
    const el = document.getElementById(id)?.querySelector('.rpp-document');
    if (!el) continue;
    if (appended > 0) {
      const br = document.createElement('div');
      br.className = 'page-break';
      temp.appendChild(br);
    }
    if (label) {
      const heading = document.createElement('div');
      heading.className = 'doc-title';
      heading.style.cssText = 'page-break-before:always;padding-top:40px;';
      heading.textContent = label;
      temp.appendChild(heading);
    }
    temp.appendChild(el.cloneNode(true));
    appended++;
  }

  if (!appended) return false;

  document.body.appendChild(temp);
  activePrintArea = temp;
  runPrint(() => {
    if (temp.parentNode) temp.parentNode.removeChild(temp);
    activePrintArea = null;
  });
  return true;
}

function runPrint(cleanup) {
  // Beri browser satu frame untuk menerapkan layout sebelum dialog print.
  requestAnimationFrame(() => {
    window.print();
    if (typeof window.onafterprint !== 'undefined') {
      window.onafterprint = cleanup;
      // Jaring pengaman: beberapa browser tidak memanggil onafterprint.
      setTimeout(cleanup, 5000);
    } else {
      setTimeout(cleanup, 3000);
    }
  });
}

/** Bersihkan area cetak yang tertinggal (mis. setelah navigating). */
export function cleanupPrintArea() {
  $$('.print-area').forEach((el) => el.classList.remove('print-area'));
  if (activePrintArea?.parentNode) {
    activePrintArea.parentNode.removeChild(activePrintArea);
    activePrintArea = null;
  }
}
