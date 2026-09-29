/**
 * Export HTML mandiri (portfolio-ready).
 *
 * Menyatukan seluruh stylesheet aplikasi + dokumen ke satu file HTML yang
 * bisa dibuka offline dan dicetak langsung dari browser.
 */

import { collectStylesheetText, saveAs } from '../core/dom.js';
import { store } from '../core/store.js';
import { escapeHtml } from '../core/dom.js';

/**
 * Bungkus HTML dokumen menjadi file HTML lengkap.
 * @param {string} bodyHtml
 * @param {string} title
 * @param {boolean} [withViewport]
 */
function buildStandalone(bodyHtml, title, withViewport = true) {
  const style = collectStylesheetText();
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">${
    withViewport ? '<meta name="viewport" content="width=device-width,initial-scale=1.0">' : ''
  }<title>${escapeHtml(title)}</title><style>${style}</style></head><body><div class="rpp-document">${bodyHtml}</div></body></html>`;
}

/** Unduh hasil render satu phase sebagai HTML. */
export function exportPhaseHTML(previewId, filename) {
  const el = document.getElementById(previewId);
  if (!el) return false;
  const doc = el.querySelector('.rpp-document') || el;
  const title = filename.replace('-portfolio.html', '');
  saveAs(new Blob([buildStandalone(doc.innerHTML, title)], { type: 'text/html' }), filename);
  return true;
}

/**
 * Unduh semua phase sebagai satu dokumen HTML dengan page-break di antaranya.
 * @param {Array<{id: string, label: string}>} phases
 * @param {string} [filename]
 */
export function exportCombinedHTML(phases, filename = 'RPP-Complete-portfolio.html') {
  let body = '';
  for (const { id, label } of phases) {
    const el = document.getElementById(id)?.querySelector('.rpp-document');
    if (!el) continue;
    body += `<div class="doc-title page-break" style="padding-top:40px;">${escapeHtml(
      label
    )}</div>${el.innerHTML}`;
  }
  if (!body) return false;
  const title = `RPP Complete Portfolio — ${store.state.input.madrasah || ''}`.trim();
  saveAs(new Blob([buildStandalone(body, title)], { type: 'text/html' }), filename);
  return true;
}
