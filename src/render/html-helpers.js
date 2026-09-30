/**
 * Helper render HTML bersama untuk semua template dokumen.
 * Menghapus duplikasi `esc`/`list`/`table` yang sebelumnya disalin di tiap
 * builder (sumber utama "kode duplikat" di audit).
 *
 * Aturan yang dijaga helper ini:
 *   - Isi dari AI tidak boleh hilang diam-diam (objek dengan key tak terduga,
 *     baris tabel dengan kolom lebih/kurang, sel bersarang).
 *   - Tabel Markdown dikenali di MANA PUN teks dirender (sel, item daftar,
 *     deskripsi aktivitas), bukan hanya di stem soal — sehingga tabel di dalam
 *     lampiran bersarang tetap jadi <table>.
 *   - `<br>` dan baris baru dari AI menjadi pemisah baris, bukan teks "<br>".
 */

import { escapeHtml } from '../core/dom.js';
import { looksLikeMath, normalizeMathText, renderCodeCogs } from '../services/latex.js';

export { escapeHtml };

const BR_TAG = /<br\s*\/?>/gi;

// ---------------------------------------------------------------------------
// Nilai → teks
// ---------------------------------------------------------------------------

function humanize(key) {
  const spaced = String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Ubah nilai apa pun (string, angka, array, objek) menjadi teks tanpa kehilangan isi. */
function stringify(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value
      .map(stringify)
      .filter((v) => v !== '')
      .join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => [k, stringify(v)])
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${humanize(k)}: ${v}`)
      .join('\n');
  }
  return String(value);
}

const hasValue = (v) => stringify(v).trim() !== '';

// ---------------------------------------------------------------------------
// Teks inline & blok
// ---------------------------------------------------------------------------

/** Escape + rumus + `<br>`/baris baru → satu potongan HTML inline. */
function inlineHtml(str) {
  const normalized = normalizeMathText(String(str).replace(BR_TAG, '\n').trim());
  return renderCodeCogs(escapeHtml(normalized)).replace(/\n/g, '<br>');
}

/**
 * Pecah satu baris tabel Markdown menjadi sel.
 * Pipe di dalam rumus (`\( |x| \)`, `$|x|$`) atau yang di-escape (`\|`) bukan pemisah.
 */
function splitRow(line) {
  const t = line.trim();
  const cells = [];
  let cur = '';
  let mathClose = null;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const n = t[i + 1];

    if (c === '\\' && n !== undefined) {
      if (mathClose === null) {
        if (n === '(') mathClose = '\\)';
        else if (n === '[') mathClose = '\\]';
        else if (n === '|') {
          cur += '|'; // pipe yang di-escape = karakter biasa
          i++;
          continue;
        }
      } else if (t.startsWith(mathClose, i)) {
        cur += mathClose;
        i += mathClose.length - 1;
        mathClose = null;
        continue;
      }
      cur += c + n;
      i++;
      continue;
    }

    if (c === '$' && mathClose === null) {
      // `$...$` dianggap rumus hanya bila isinya memang terlihat seperti rumus.
      const end = t.indexOf('$', i + 1);
      const inner = end > i ? t.slice(i + 1, end) : '';
      if (inner && !/^\s|\s$/.test(inner) && looksLikeMath(inner)) {
        cur += t.slice(i, end + 1);
        i = end;
        continue;
      }
    }

    if (c === '|' && mathClose === null) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  cells.push(cur.trim());

  if (t.startsWith('|')) cells.shift();
  if (t.endsWith('|') && !t.endsWith('\\|')) cells.pop();
  return cells;
}

/** Baris pemisah header tabel: hanya sel `---`, `:--`, `--:`, `:-:` (satu strip pun cukup). */
function isSepRow(line) {
  if (!line.includes('|') || !line.includes('-')) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** Apakah `lines[i]` adalah header tabel Markdown (diikuti baris pemisah)? */
function isTableStart(lines, i) {
  return lines[i].includes('|') && i + 1 < lines.length && isSepRow(lines[i + 1]);
}

/** Teks memuat tabel Markdown? (dipakai untuk memilih render blok vs inline) */
export function hasMarkdownTable(value) {
  const lines = String(value ?? '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (isTableStart(lines, i)) return true;
  }
  return false;
}

/** Render blok tabel Markdown menjadi <table>. Sel diproses inline (rumus, <br>). */
function renderMarkdownTable(headers, aligns, rows) {
  const ncols = headers.length;
  const alignStyle = (idx) => {
    const a = aligns[idx];
    return a ? ` style="text-align:${a}"` : '';
  };
  const head = headers.map((c, idx) => `<th${alignStyle(idx)}>${inlineHtml(c)}</th>`).join('');
  const body = rows
    .map((row) => {
      // Sel berlebih (pipe yang lolos) digabung ke sel terakhir supaya isi tidak hilang.
      const cells =
        row.length > ncols
          ? [...row.slice(0, ncols - 1), row.slice(ncols - 1).join(' | ')]
          : row;
      let tds = '';
      for (let k = 0; k < ncols; k++) tds += `<td${alignStyle(k)}>${inlineHtml(cells[k] ?? '')}</td>`;
      return `<tr>${tds}</tr>`;
    })
    .join('');
  return `<div style="overflow-x:auto;margin:8px 0;"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/**
 * Render teks berformat blok: paragraf, baris baru, dan tabel Markdown.
 * Bila hasilnya hanya satu paragraf tanpa tabel, dikembalikan inline (tanpa
 * pembungkus) agar aman dipakai di dalam <span>/<li>.
 */
export function richText(value) {
  const lines = stringify(value).split('\n');
  const segs = [];
  let buf = [];
  const flush = () => {
    if (buf.length) {
      segs.push({ block: false, html: inlineHtml(buf.join('\n')) });
      buf = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isTableStart(lines, i)) {
      const headers = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const left = c.startsWith(':');
        const right = c.endsWith(':');
        return left && right ? 'center' : right ? 'right' : '';
      });
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
      flush();
      segs.push({ block: true, html: renderMarkdownTable(headers, aligns, rows) });
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

  if (segs.length === 1 && !segs[0].block) return segs[0].html;
  return segs
    .map((s) => (s.block ? s.html : `<div style="margin:0 0 6px;">${s.html}</div>`))
    .join('');
}

/**
 * Escape + render rumus untuk teks bebas. Bila teks memuat tabel Markdown,
 * dirender sebagai blok (tabel bersarang di sel/item daftar tetap benar).
 */
export function text(value) {
  const str = stringify(value);
  return hasMarkdownTable(str) ? richText(str) : inlineHtml(str);
}

/** Paragraf: <p> untuk teks biasa, <div> bila memuat tabel (tabel tak boleh di dalam <p>). */
export function para(value) {
  const str = stringify(value);
  if (!str.trim()) return '';
  return hasMarkdownTable(str) ? `<div>${richText(str)}</div>` : `<p>${inlineHtml(str)}</p>`;
}

// ---------------------------------------------------------------------------
// Daftar
// ---------------------------------------------------------------------------

const LABEL_KEYS = [
  'nama',
  'pihak',
  'aspek',
  'tahap',
  'judul',
  'komponen',
  'kegiatan',
  'jenis',
  'kategori',
  'dimensi',
  'topik',
  'istilah',
];
const DETAIL_KEYS = [
  'detail',
  'peran',
  'uraian',
  'deskripsi',
  'penjelasan',
  'keterangan',
  'tools',
  'contoh',
  'isi',
  'definisi',
];
const IGNORED_KEYS = new Set(['nomor', 'no', 'id']);

/** Nilai untuk ditampilkan; array string pendek digabung dengan koma. */
function valueText(v) {
  if (Array.isArray(v) && v.every((x) => typeof x === 'string' && !x.includes('\n'))) {
    return text(v.join(', '));
  }
  return text(v);
}

/**
 * Render satu item daftar apa pun bentuknya menjadi <li>, TANPA membuang isi.
 * Objek dengan key yang dikenal (nama/detail, pihak/peran, aspek/detail,
 * tahap/tools, pertanyaan/jawaban, ...) dirender rapi; key tak dikenal tetap
 * ditampilkan sebagai "Label: nilai".
 */
export function itemHtml(item) {
  if (item === null || item === undefined) return '';
  if (typeof item !== 'object' || Array.isArray(item)) {
    const t = text(item);
    return t ? `<li>${t}</li>` : '';
  }

  if (hasValue(item.pertanyaan)) {
    const answer = hasValue(item.jawaban) ? `<br><em>Jawaban: ${text(item.jawaban)}</em>` : '';
    return `<li><strong>${text(item.pertanyaan)}</strong>${answer}</li>`;
  }

  const labelKey = LABEL_KEYS.find((k) => hasValue(item[k]));
  const detailKeys = DETAIL_KEYS.filter((k) => k !== labelKey && hasValue(item[k]));
  const used = new Set([labelKey, ...detailKeys]);
  const rest = Object.entries(item).filter(
    ([k, v]) => !used.has(k) && !IGNORED_KEYS.has(k) && hasValue(v)
  );

  const parts = detailKeys.map((k) => valueText(item[k]));
  const extras = rest.map(([k, v]) => `<em>${escapeHtml(humanize(k))}</em>: ${valueText(v)}`);

  let html = '';
  if (labelKey) {
    html = `<strong>${text(item[labelKey])}${parts.length ? ':' : ''}</strong>`;
    if (parts.length) html += ` ${parts.join('<br>')}`;
  } else {
    html = parts.join('<br>');
  }
  if (extras.length) html += `${html ? '<br>' : ''}${extras.join('<br>')}`;
  return html ? `<li>${html}</li>` : '';
}

/**
 * Render daftar HTML dengan pemetaan objek → markup yang sesuai.
 * @param {*} items
 * @param {string} [tag]
 * @param {(item: *) => string} [mapItem] renderer per item (default: `itemHtml`)
 */
export function list(items, tag = 'ol', mapItem = itemHtml) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const inner = items.map(mapItem).join('');
  return inner ? `<${tag}>${inner}</${tag}>` : '';
}

// ---------------------------------------------------------------------------
// Tabel
// ---------------------------------------------------------------------------

function normalizeKey(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Susun sel dari baris berbentuk object sesuai urutan header.
 * Urutan pencocokan: nama sama → nama mirip → posisi (key yang tersisa mengisi
 * kolom yang belum terisi). Dengan begitu isi tidak hilang walau AI memakai
 * nama key yang berbeda dari nama kolom.
 */
function cellsFromObject(row, headers) {
  const keys = Object.keys(row);
  const used = new Set();
  const out = new Array(headers.length).fill(undefined);
  const nh = headers.map(normalizeKey);

  headers.forEach((h, i) => {
    const k = keys.find((key) => !used.has(key) && (key === h || normalizeKey(key) === nh[i]));
    if (k !== undefined) {
      used.add(k);
      out[i] = row[k];
    }
  });
  headers.forEach((_, i) => {
    if (out[i] !== undefined) return;
    const k = keys.find((key) => {
      if (used.has(key)) return false;
      const nk = normalizeKey(key);
      return nk && nh[i] && (nk.includes(nh[i]) || nh[i].includes(nk));
    });
    if (k !== undefined) {
      used.add(k);
      out[i] = row[k];
    }
  });

  const leftover = keys.filter((key) => !used.has(key));
  let next = 0;
  for (let i = 0; i < out.length && next < leftover.length; i++) {
    if (out[i] === undefined) out[i] = row[leftover[next++]];
  }
  return out.map((v) => v ?? '');
}

/** Sel dari baris berbentuk array; sel berlebih digabung ke kolom terakhir. */
function cellsFromArray(row, headers) {
  if (row.length <= headers.length) return headers.map((_, i) => row[i] ?? '');
  const head = row.slice(0, headers.length - 1);
  return [...head, row.slice(headers.length - 1).map(stringify).join(' ')];
}

const isNumberColumn = (header) => ['no', 'nomor'].includes(normalizeKey(header));

/**
 * Tentukan kolom dari data bila AI tidak menyediakan `kolom`.
 * @param {Array} rows
 * @returns {string[]}
 */
export function deriveColumns(rows) {
  const first = Array.isArray(rows) ? rows.find((r) => r && typeof r === 'object') : null;
  if (!first) return [];
  if (Array.isArray(first)) return first.map((_, i) => (i === 0 ? 'No' : `Kolom ${i + 1}`));
  return Object.keys(first).map(humanize);
}

/**
 * Render <table> dari header + baris.
 * Baris boleh berupa array (urutan = urutan header) atau object (dicocokkan
 * ke header, untuk toleransi variasi nama key dari AI). Kolom nomor yang
 * kosong diisi otomatis.
 */
export function table(headers, rows, { className = '' } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const cols = headers?.length ? headers : deriveColumns(rows);
  if (!cols.length) return '';

  const cls = className ? ` class="${className}"` : '';
  const head = cols.map((h) => `<th>${text(h)}</th>`).join('');
  const body = rows
    .map((row, rowIdx) => {
      let cells;
      if (Array.isArray(row)) cells = cellsFromArray(row, cols);
      else if (row && typeof row === 'object') cells = cellsFromObject(row, cols);
      else cells = cols.map((_, i) => (i === 0 ? row : ''));
      if (isNumberColumn(cols[0]) && !hasValue(cells[0])) cells[0] = String(rowIdx + 1);
      return `<tr>${cells.map((c) => `<td>${text(c)}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<table${cls}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
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

// ---------------------------------------------------------------------------
// Soal
// ---------------------------------------------------------------------------

/**
 * Buang label opsi ("A.", "B)", "(c)") di awal teks opsi — tetapi HANYA bila
 * memang label. Opsi seperti "a = 2" atau "e. coli" tidak boleh kehilangan huruf
 * pertamanya.
 */
function stripOptionLabel(raw) {
  return String(raw ?? '').replace(/^\s*\(?(?:[A-E][.)]\s*|[a-e][.)]\s+)/, '');
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
      html += `<div class="soal-opsi">${labels[i] ?? i + 1}. ${richText(stripOptionLabel(soal.opsi[i]))}</div>`;
    }
  }
  if (showKunci && soal.kunci) {
    html += `<div class="soal-opsi kunci-jawaban">Kunci: ${escapeHtml(soal.kunci)}</div>`;
  }
  return html;
}
