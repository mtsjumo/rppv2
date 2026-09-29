/**
 * Template renderer Phase 2 (Modul Ajar).
 */

import { store } from '../core/store.js';
import { escapeHtml, kvTable, list, table, text } from './html-helpers.js';

/** Pemetaan item modul ajar → <li>. */
function modulItem(item) {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return `<li>${text(item)}</li>`;
  if (item.konsep && item.definisi) {
    return `<li><strong>${text(item.konsep)}:</strong> ${text(item.definisi)}${
      item.contoh ? ` <em>(contoh: ${text(item.contoh)})</em>` : ''
    }</li>`;
  }
  if (item.istilah && item.definisi) {
    return `<li><strong>${text(item.istilah)}:</strong> ${text(item.definisi)}</li>`;
  }
  if (item.pertanyaan && item.jawaban) {
    return `<li><strong>Q: ${text(item.pertanyaan)}</strong><br>A: ${text(item.jawaban)}</li>`;
  }
  if (item.nama) {
    const rincian = item.rincian?.length
      ? '<ul>' + item.rincian.map((r) => `<li>${text(r)}</li>`).join('') + '</ul>'
      : '';
    return `<li><strong>${text(item.nama)}</strong>${item.detail ? ': ' + text(item.detail) : ''}${rincian}</li>`;
  }
  if (item.sumber) {
    return `<li>${text(item.sumber)}${item.tautan ? ` (${escapeHtml(item.tautan)})` : ''}</li>`;
  }
  return '';
}

/**
 * @param {object} json hasil Phase 2
 * @param {object} [input]
 * @returns {string}
 */
export function buildModulAjarHTML(json, input = store.state.input) {
  const ma = json.modulAjar || json;
  const ba = ma.bahanAjar || {};
  const li = (items) => list(items, 'ol', modulItem);

  let html = `<div class="rpp-document">`;
  html += `<div class="doc-title">MODUL AJAR</div>`;
  html += `<div class="doc-subtitle">${escapeHtml(input.mapel || '')} — ${escapeHtml(
    input.materi || ''
  )}</div>`;
  html += kvTable([
    ['Madrasah', `: ${escapeHtml(input.madrasah || '')}`],
    ['Mata Pelajaran', `: ${escapeHtml(input.mapel || '')}`],
    ['Materi', `: ${escapeHtml(input.materi || '')}`],
    ['Elemen', `: ${escapeHtml(input.elemen || '')}`],
    ['Fase/Kelas', `: ${escapeHtml(input.fase || '')}`],
    ['Alokasi Waktu', `: ${escapeHtml(input.alkok || '')}`],
    ['Penyusun', `: ${escapeHtml(input.guru || '')}`],
    ['NUPTK', `: ${escapeHtml(input.nuptk || '-')}`],
  ]);

  // ---- Bahan ajar ----
  html += `<div class="section-header">BAHAN AJAR</div>`;
  if (ba.pengertian) html += `<p style="text-align:justify;">${text(ba.pengertian)}</p>`;
  if (ba.subBab?.length) {
    ba.subBab.forEach((sb, i) => {
      html += `<div class="sub-header">${i + 1}. ${escapeHtml(sb.judul || '')}</div>`;
      if (sb.konten) html += `<p style="text-align:justify;">${text(sb.konten)}</p>`;
      if (sb.contoh) {
        html += `<p style="background:#e8f5e9;border-left:4px solid #43a047;padding:6px 10px;page-break-inside:avoid;"><strong>Contoh:</strong> ${text(
          sb.contoh
        )}</p>`;
      }
      if (sb.gambar) html += `<p><em>🖼️ Ilustrasi: ${escapeHtml(sb.gambar)}</em></p>`;
    });
  }

  // ---- Ringkasan materi ----
  if (ma.ringkasanMateri?.length) {
    html += `<div class="section-header">RINGKASAN MATERI</div>`;
    const rows = ma.ringkasanMateri.map((r) =>
      typeof r === 'string'
        ? { Konsep: r, Definisi: '', Contoh: '' }
        : { Konsep: r.konsep || '', Definisi: r.definisi || '', Contoh: r.contoh || '' }
    );
    html += table(['Konsep', 'Definisi', 'Contoh'], rows);
  }

  // ---- Peta konsep (mind map) ----
  if (ma.mindmap?.cabang?.length) {
    html += `<div class="section-header">PETA KONSEP (MIND MAP)</div>`;
    html += `<p style="text-align:center;font-weight:700;font-size:1.1rem;">${escapeHtml(
      ma.mindmap.topik || ''
    )}</p>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">`;
    for (const c of ma.mindmap.cabang) {
      const nama = typeof c === 'string' ? c : c.nama || '';
      const rincian =
        typeof c === 'object' && c.rincian?.length
          ? `<ul>${c.rincian.map((r) => `<li>${text(r)}</li>`).join('')}</ul>`
          : '';
      html +=
        `<div style="flex:1 1 200px;border:1px solid #bdbdbd;border-radius:8px;overflow:hidden;page-break-inside:avoid;">` +
        `<div style="background:#e3f2fd;color:#1976d2;font-weight:700;padding:6px 10px;">🌿 ${escapeHtml(
          nama
        )}</div>` +
        (rincian ? `<div style="padding:6px 10px;">${rincian}</div>` : '') +
        `</div>`;
    }
    html += `</div>`;
  }

  // ---- FAQ ----
  if (ma.faq?.length) {
    html += `<div class="section-header">FAQ (FREQUENTLY ASKED QUESTIONS)</div>`;
    ma.faq.forEach((f, idx) => {
      const q = typeof f === 'string' ? f : f.pertanyaan || '';
      const a = typeof f === 'object' ? f.jawaban || '' : '';
      html +=
        `<div style="border:1px solid #bdbdbd;border-radius:8px;margin:8px 0;overflow:hidden;page-break-inside:avoid;">` +
        `<div style="background:#e3f2fd;padding:6px 10px;font-weight:700;">Q${idx + 1}: ${text(q)}</div>` +
        (a ? `<div style="padding:6px 10px;">A: ${text(a)}</div>` : '') +
        `</div>`;
    });
  }

  // ---- Glosarium ----
  if (ma.glosarium?.length) {
    html += `<div class="section-header">GLOSARIUM</div>`;
    html += table(
      ['Istilah', 'Definisi'],
      ma.glosarium.map((g) => ({ Istilah: g.istilah || '', Definisi: g.definisi || '' }))
    );
  }

  // ---- Referensi ----
  if (ma.referensi?.length) {
    html += `<div class="section-header">REFERENSI & SUMBER BELAJAR</div>`;
    html += li(ma.referensi);
  }

  // ---- Refleksi guru ----
  if (ma.refleksiGuru) {
    html += `<div class="section-header">LEMBAR REFLEKSI GURU</div>`;
    if (ma.refleksiGuru.pertanyaanRefleksi?.length) {
      html += `<div class="sub-header">Pertanyaan Refleksi</div>`;
      html += list(ma.refleksiGuru.pertanyaanRefleksi, 'ol', (i) => `<li>${text(i)}</li>`);
    }
    if (ma.refleksiGuru.hal_yang_berhasil || ma.refleksiGuru.hal_yang_perlu_diperbaiki) {
      html += kvTable(
        [
          ['Hal yang Berhasil', text(ma.refleksiGuru.hal_yang_berhasil)],
          ['Hal yang Perlu Diperbaiki', text(ma.refleksiGuru.hal_yang_perlu_diperbaiki)],
        ],
        250
      );
    }
  }

  html += `</div>`;
  return html;
}
