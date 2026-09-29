/**
 * Helper render HTML bersama untuk semua template dokumen.
 * Menghapus duplikasi `esc`/`list`/`table` yang sebelumnya disalin di tiap
 * builder (sumber utama "kode duplikat" di audit).
 */

import { escapeHtml } from '../core/dom.js';
import { normalizeMathText, renderCodeCogs } from '../services/latex.js';

export { escapeHtml };

/** Escape + render LaTeX sekaligus (untuk teks bebas). */
export function text(s) {
  return renderCodeCogs(escapeHtml(normalizeMathText(s)));
}

/**
 * Escape + render LaTeX pada teks soal/stem yang boleh berisi tabel markdown.
 */
export function richText(s) {
  return renderCodeCogs(richTextEscape(normalizeMathText(s)));
}

/** Escape + render blok tabel markdown (`| a | b |`) menjadi <table>. */
function richTextEscape(s) {
  const lines = String(s ?? '').split('\n');

  const splitRow = (line) => {
    let t = line.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    return t.split('|').map((c) => c.trim());
  };
  const isSepRow = (line) => {
    if (!line.includes('|')) return false;
    const cells = splitRow(line);
    return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
  };

  const segs = [];
  let buf = [];
  const flush = () => {
    if (buf.length) {
      segs.push(buf.map(escapeHtml).join('<br>'));
      buf = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('|') && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2;
      const rows = [];
      while (
        i < lines.length &&
        lines[i].includes('|') &&
        lines[i].trim() !== '' &&
        !isSepRow(lines[i])
      ) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const ncols = headers.length;
      const head = headers.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
      const body = rows
        .map((row) => {
          let cells = '';
          for (let k = 0; k < ncols; k++) cells += `<td>${escapeHtml(row[k] ?? '')}</td>`;
          return `<tr>${cells}</tr>`;
        })
        .join('');
      flush();
      segs.push(
        `<div style="overflow-x:auto;margin:8px 0;"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
      );
      continue;
    }
    if (line.trim() === '') {
      flush();
      i++;
      continue;
    }
    buf.push(line);
    i++;
  }
  flush();
  return segs.join('');
}

/**
 * Render daftar HTML dengan pemetaan objek → markup yang sesuai.
 * @param {*} items
 * @param {string} [tag]
 * @param {(item: *) => string} [mapItem] renderer per item
 */
export function list(items, tag = 'ol', mapItem) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const render = mapItem ?? ((i) => (typeof i === 'string' ? `<li>${text(i)}</li>` : ''));
  const inner = items.map(render).join('');
  return inner ? `<${tag}>${inner}</${tag}>` : '';
}

/**
 * Render <table> dari header + baris.
 * Baris boleh berupa array (urutan = urutan header) atau object (dicocokkan
 * fuzzy ke header, untuk toleransi variasi nama key dari AI).
 */
export function table(headers, rows, { className = '' } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const cls = className ? ` class="${className}"` : '';
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = Array.isArray(row)
        ? headers.map((_, idx) => `<td>${escapeHtml(row[idx] ?? '')}</td>`).join('')
        : headers.map((h) => `<td>${escapeHtml(matchKey(row, h) ?? '')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table${cls}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Cocokkan nama key object ke header dengan toleransi normalisasi. */
function matchKey(row, header) {
  if (!row || typeof row !== 'object') return row ?? '';
  if (row[header] !== undefined) return row[header];
  const target = normalizeKey(header);
  const found = Object.keys(row).find((k) => {
    const key = normalizeKey(k);
    return key === target || key.includes(target) || target.includes(key);
  });
  return found !== undefined ? row[found] : '';
}

function normalizeKey(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Render tabel label→nilai (dipakai blok identitas, desain, asesmen).
 * @param {Array<[string, string|false]>} rows pasangan [label, htmlNilai]
 *   Nilai `false` berarti lewati baris ini.
 * @param {number} [labelWidth]
 */
export function kvTable(rows, labelWidth = 200) {
  const visible = rows.filter(
    ([, value]) => value !== false && value !== null && value !== undefined && value !== ''
  );
  const body = visible
    .map(([label, value], idx) => {
      const width = idx === 0 ? ` style="width:${labelWidth}px"` : '';
      return `<tr><td${width}><strong>${escapeHtml(label)}</strong></td><td>${value}</td></tr>`;
    })
    .join('');
  return body ? `<table>${body}</table>` : '';
}

/** Render blok "soal + opsi + kunci" yang dipakai Evaluasi & Diagnostik. */
export function renderSoalBlock(soal, { showLevel = false, showKunci = true } = {}) {
  const labels = ['A', 'B', 'C', 'D', 'E'];
  let html = `<div class="soal-nomor"><strong>${escapeHtml(soal.nomor ?? '')}.</strong> <span>${richText(
    soal.pertanyaan
  )}</span>`;
  if (showLevel && soal.level) {
    const cls = soal.levelSource === 'explicit' ? 'cognitive-badge' : 'cognitive-badge inferred';
    html += ` <span class="${cls}" data-level="${escapeHtml(soal.level)}" title="Level kognitif ${escapeHtml(
      soal.level
    )}">${escapeHtml(soal.level)}</span>`;
  }
  html += `</div>`;

  if (Array.isArray(soal.opsi) && soal.opsi.length) {
    for (let i = 0; i < soal.opsi.length; i++) {
      const raw = String(soal.opsi[i] ?? '').replace(/^[A-Ea-e][.\s)]+\s*/, '');
      html += `<div class="soal-opsi">${labels[i] ?? i + 1}. ${richText(raw)}</div>`;
    }
  }
  if (showKunci && soal.kunci) {
    html += `<div class="soal-opsi kunci-jawaban">Kunci: ${escapeHtml(soal.kunci)}</div>`;
  }
  return html;
}
