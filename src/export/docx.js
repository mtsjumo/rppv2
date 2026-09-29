/**
 * Export DOCX memakai docx.js (UMD, dimuat via CDN di index.html).
 *
 * Perbaikan dibanding versi lama (audit: "DOCX accuracy masih bermasalah"):
 *   - List berurutan memakai `numbering` yang benar, bukan paragraf polos.
 *   - List bersarang memakai indentasi bertingkat.
 *   - Block-level walk: tabel/daftar/heading tidak lagi saling menimpa.
 *   - Elemen yang hanya membungkus blok lain di-unwind, bukan digepeng jadi
 *     satu paragraf panjang.
 *   - Rumus LaTeX (<img>) disisipkan sebagai teks LaTeX, bukan gambar —
 *     jauh lebih andal & tetap bisa diedit di Word.
 *   - `<br>` menghasilkan line break asli, bukan hilang.
 *   - Tanda tangan pengesahan jadi tabel dua kolom tanpa border.
 *
 * Satu pipeline (`buildBlocks`) dipakai bersama oleh export per-phase maupun
 * export gabungan, jadi keduanya tidak bisa berbeda perilaku.
 */

import { saveAs } from '../core/dom.js';

const FONT = 'Times New Roman';
const MARGIN = { top: 1440, right: 1440, bottom: 1440, left: 1440 };
/** Lebar halaman usable dalam twip (8.5" - 2" margin = 6.5" = 9360 twip). */
const USABLE_WIDTH_TWIP = 9020;

/** true bila library docx termuat. */
export function isDocxAvailable() {
  return typeof globalThis.docx !== 'undefined' && !!globalThis.docx?.Document;
}

function requireDocx() {
  if (!isDocxAvailable()) throw new Error('Library DOCX belum siap dimuat');
  return globalThis.docx;
}

const listItems = (el) =>
  Array.from(el.children || []).filter((c) => c.tagName?.toLowerCase() === 'li');

const textContent = (node) => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  return Array.from(node.childNodes || [])
    .map(textContent)
    .join('');
};

const isBoldElement = (el) => {
  const tag = el.tagName?.toLowerCase();
  if (tag === 'strong' || tag === 'b' || tag === 'th') return true;
  const w = (el.style?.fontWeight || '').toString();
  return w === '700' || w === 'bold';
};

/** Ubah CSS hex ke format docx (tanpa #). */
function cssColorToDocx(value) {
  const c = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? c.slice(1).toUpperCase() : undefined;
}

/**
 * Konversi HTML → array blok docx (Paragraph | Table).
 * @param {string} html
 * @param {object} lib destructured dari globalThis.docx
 * @returns {Array}
 */
export function buildBlocks(html, lib) {
  const {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    WidthType,
    convertInchesToTwip,
  } = lib;

  const container = document.createElement('div');
  container.innerHTML = html;
  const blocks = [];

  // ---- Run inline --------------------------------------------------------
  const makeRun = (text, opts = {}) =>
    new TextRun({
      text,
      bold: !!opts.bold,
      italics: !!opts.italics,
      color: opts.color,
      break: opts.break,
      size: opts.size ?? 22,
      font: FONT,
    });

  /** Walk inline: menghasilkan TextRun[], menghormati bold/italic/warna/<br>. */
  function inlineRuns(el, inherited = {}) {
    const runs = [];
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent;
        if (t) runs.push(makeRun(t, { ...inherited }));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const style = { ...inherited };
      const tag = node.tagName.toLowerCase();

      if (tag === 'strong' || tag === 'b' || node.style?.fontWeight === '700') style.bold = true;
      if (tag === 'i' || tag === 'em') style.italics = true;
      if (node.classList?.contains('kunci-jawaban')) {
        style.bold = true;
        style.color = 'C62828';
      }
      const inlineColor = cssColorToDocx(node.style?.color);
      if (inlineColor) style.color = inlineColor;

      if (tag === 'br') {
        runs.push(makeRun('', { ...style, break: 1 }));
        return;
      }
      if (tag === 'img') {
        // Rumus LaTeX → teks (docx butuh binary embed; teks jauh lebih andal).
        if (node.alt) runs.push(makeRun(node.alt, { ...style, italics: true }));
        return;
      }
      for (const child of Array.from(node.childNodes)) walk(child);
    };
    for (const child of Array.from(el.childNodes)) walk(child);
    return runs;
  }

  const para = (runs, options = {}) => {
    if (!runs.length) return null;
    return new Paragraph({
      children: runs,
      alignment: options.alignment,
      heading: options.heading,
      spacing: options.spacing ?? { before: 60, after: 60 },
      indent: options.indent,
      border: options.border,
      shading: options.shading,
      numbering: options.numbering,
    });
  };

  const sizeAll = (runs, size) =>
    runs.map((r) => {
      const o = r.options ?? {};
      return makeRun(o.text ?? '', { ...o, size });
    });

  // ---- Tabel -------------------------------------------------------------
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: 'BDBDBD' };
  const tableBorders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
    insideHorizontal: thinBorder,
    insideVertical: thinBorder,
  };

  function convertTable(tblEl) {
    const rows = Array.from(tblEl.querySelectorAll('tr'));
    if (!rows.length) return null;

    const colCount = Math.max(...rows.map((tr) => tr.querySelectorAll('td, th').length), 1);
    const colWidth = Math.floor(USABLE_WIDTH_TWIP / colCount);

    const tableRows = rows.map((tr) => {
      const isHeaderRow = tr.querySelector('th') !== null;
      const cells = Array.from(tr.querySelectorAll('td, th'));
      return new TableRow({
        children: cells.map((cell) => {
          const runs = sizeAll(inlineRuns(cell), 20);
          const shading = isHeaderRow ? { fill: 'FCE4EC' } : undefined;
          return new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            shading,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                children: sizeAll(
                  runs.map((r) =>
                    makeRun(r.options?.text ?? '', {
                      ...r.options,
                      bold: isHeaderRow || isBoldElement(cell),
                    })
                  ),
                  20
                ),
              }),
            ],
          });
        }),
      });
    });

    return new Table({
      rows: tableRows,
      borders: tableBorders,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
  }

  // ---- Tanda tangan pengesahan -----------------------------------------
  function convertSignatureTable(tblEl) {
    const row = tblEl.querySelector('tr');
    if (!row) return [];
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const cell = (td) => {
      // Pecah berdasarkan <br> supaya ada baris kosong untuk tanda tangan.
      const fragments = td.innerHTML.split(/<br\s*\/?>/i);
      const paragraphs = fragments.map((frag) => {
        const tmp = document.createElement('div');
        tmp.innerHTML = frag;
        const runs = sizeAll(inlineRuns(tmp), 22);
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 20 },
          children: runs.length ? runs : [new TextRun({ text: '', size: 22, font: FONT })],
        });
      });
      return new TableCell({
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
        children: paragraphs,
      });
    };
    return [
      new Table({
        rows: [new TableRow({ children: Array.from(row.querySelectorAll('td')).map(cell) })],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
      new Paragraph({ children: [], spacing: { after: 200 } }),
    ];
  }

  // ---- Daftar ------------------------------------------------------------
  function convertList(listEl, depth) {
    const out = [];
    const ordered = listEl.tagName.toLowerCase() === 'ol';
    const level = Math.min(depth, 8);

    for (const li of listItems(listEl)) {
      // Pisahkan anak list (untuk diproses rekursif) dari sisanya.
      const nested = Array.from(li.children).filter((c) => {
        const t = c.tagName?.toLowerCase();
        return t === 'ol' || t === 'ul';
      });
      const clone = li.cloneNode(true);
      Array.from(clone.children).forEach((c) => {
        const t = c.tagName?.toLowerCase();
        if (t === 'ol' || t === 'ul') c.remove();
      });

      const runs = sizeAll(inlineRuns(clone), 20);
      if (runs.length) {
        out.push(
          new Paragraph({
            children: runs,
            spacing: { before: 40, after: 20 },
            numbering: { reference: ordered ? 'rpp-list' : 'rpp-bullet', level },
          })
        );
      }
      for (const child of nested) out.push(...convertList(child, depth + 1));
    }
    return out;
  }

  // ---- Opsi paragraf per kelas elemen ------------------------------------
  function paraOptionsFor(el) {
    const cls = el.classList;
    if (cls.contains('soal-nomor'))
      return { bold: true, size: 22, spacing: { before: 140, after: 40 } };
    if (cls.contains('soal-opsi')) {
      return { size: 20, indent: { left: convertInchesToTwip(0.4) }, spacing: { after: 20 } };
    }
    if (cls.contains('kunci-jawaban')) {
      return {
        bold: true,
        size: 20,
        indent: { left: convertInchesToTwip(0.4) },
        spacing: { after: 60 },
      };
    }
    if (el.style?.textAlign === 'justify') return { alignment: AlignmentType.JUSTIFIED, size: 22 };
    if (el.style?.textAlign === 'center') return { alignment: AlignmentType.CENTER, size: 22 };
    return {};
  }

  /** Elemen yang hanya membungkus blok lain → unwind, jangan digepeng. */
  function isWrapper(el) {
    if (el.tagName?.toLowerCase() !== 'div') return false;
    if (!el.textContent.trim()) return true;
    const hasDirectText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
    );
    if (hasDirectText) return false;
    return !!el.querySelector('table, ol, ul, .section-header, .sub-header, div');
  }

  // ---- Walk utama --------------------------------------------------------
  function walk(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent.trim();
        if (t) blocks.push(new Paragraph({ children: [makeRun(t, { size: 22 })] }));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = child.tagName.toLowerCase();
      const cls = child.classList;

      if (cls.contains('doc-title')) {
        const p = para(sizeAll(inlineRuns(child), 30), {
          bold: true,
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 120 },
        });
        if (p) blocks.push(p);
        continue;
      }
      if (cls.contains('doc-subtitle')) {
        const p = para(sizeAll(inlineRuns(child), 24), {
          bold: true,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        });
        if (p) blocks.push(p);
        continue;
      }
      if (cls.contains('section-header')) {
        const p = para(sizeAll(inlineRuns(child), 24), {
          bold: true,
          heading: HeadingLevel.HEADING_2,
          shading: { fill: 'FCE4EC' },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'E91E63', space: 6 } },
          spacing: { before: 240, after: 100 },
        });
        if (p) blocks.push(p);
        continue;
      }
      if (cls.contains('sub-header')) {
        const p = para(sizeAll(inlineRuns(child), 22), {
          bold: true,
          shading: { fill: 'E3F2FD' },
          spacing: { before: 160, after: 80 },
        });
        if (p) blocks.push(p);
        continue;
      }
      if (tag === 'table') {
        const converted = cls.contains('pengesahan-table')
          ? convertSignatureTable(child)
          : [convertTable(child), new Paragraph({ children: [], spacing: { after: 120 } })];
        converted.filter(Boolean).forEach((b) => blocks.push(b));
        continue;
      }
      if (tag === 'ol' || tag === 'ul') {
        convertList(child, 0).forEach((b) => blocks.push(b));
        continue;
      }
      if (isWrapper(child)) {
        walk(child);
        continue;
      }
      const opts = paraOptionsFor(child);
      const p = para(sizeAll(inlineRuns(child), opts.size ?? 22), opts);
      if (p) blocks.push(p);
    }
  }

  walk(container);

  if (!blocks.length) {
    blocks.push(new Paragraph({ children: [makeRun('(dokumen kosong)')] }));
  }
  return blocks;
}

/** Konfigurasi numbering untuk daftar berurutan & bullet. */
function numberingConfig(lib) {
  const { AlignmentType, LevelFormat, convertInchesToTwip } = lib;
  const levels = (format, textFor) =>
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((level) => ({
      level,
      format,
      text: textFor(level),
      alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: convertInchesToTwip(0.3 + level * 0.25) } } },
    }));

  return {
    config: [
      { reference: 'rpp-list', levels: levels(LevelFormat.DECIMAL, (l) => `%${l + 1}.`) },
      {
        reference: 'rpp-bullet',
        levels: levels(LevelFormat.BULLET, (l) => (l % 2 === 0 ? '•' : '–')),
      },
    ],
  };
}

/**
 * Ubah HTML preview menjadi blob DOCX.
 * @param {string} html
 * @param {string} title
 * @returns {Promise<Blob>}
 */
export async function htmlToDocx(html, title) {
  const lib = requireDocx();
  const { Document, Packer } = lib;
  const doc = new Document({
    title,
    numbering: numberingConfig(lib),
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: { page: { margin: MARGIN } }, children: buildBlocks(html, lib) }],
  });
  return Packer.toBlob(doc);
}

/** Export satu phase ke DOCX. */
export async function exportPhaseDOCX(previewId, filename) {
  const el = document.getElementById(previewId);
  if (!el) throw new Error(`Elemen ${previewId} tidak ditemukan`);
  const doc = el.querySelector('.rpp-document') || el;
  saveAs(await htmlToDocx(doc.innerHTML, filename.replace(/\.docx$/, '')), filename);
}

/**
 * Export gabungan: judul tiap phase + konten, dipisah page break.
 * @param {Array<{id: string, label: string}>} phases
 * @param {string} [filename]
 */
export async function exportCombinedDOCX(phases, filename = 'RPP-Complete.docx') {
  const lib = requireDocx();
  const { Document, Packer, Paragraph, TextRun } = lib;
  const children = [];

  for (const { id, label } of phases) {
    const el = document.getElementById(id)?.querySelector('.rpp-document');
    if (!el) continue;
    children.push(
      new Paragraph({
        alignment: 'center',
        heading: lib.HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: label, bold: true, size: 28, font: FONT })],
        spacing: { before: 200, after: 200 },
      })
    );
    children.push(...buildBlocks(el.innerHTML, lib));
  }

  if (!children.length) throw new Error('Belum ada data untuk diekspor');

  const doc = new Document({
    title: 'RPP-Complete',
    numbering: numberingConfig(lib),
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: { page: { margin: MARGIN } }, children }],
  });
  saveAs(await Packer.toBlob(doc), filename);
}

export { textContent };
