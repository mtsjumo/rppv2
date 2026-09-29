/**
 * Template renderer Phase 3 (Media Pembelajaran).
 */

import { store } from '../core/store.js';
import { escapeHtml, kvTable, list, table, text } from './html-helpers.js';

/** Pemetaan item media → <li>. */
function mediaItem(item) {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return `<li>${text(item)}</li>`;

  // Slide presentasi
  if (item.slide && item.judul) {
    let out = `<li><strong>Slide ${escapeHtml(item.slide)}: ${text(item.judul)}</strong>`;
    if (item.isi) out += `<br>${text(item.isi)}`;
    if (item.visual) out += `<br><em>Visual: ${text(item.visual)}</em>`;
    if (item.catatanPembicara) {
      out += `<br><span style="color:#666;">🗣 ${text(item.catatanPembicara)}</span>`;
    }
    return out + '</li>';
  }

  // Adegan video
  if (item.waktu && item.visual) {
    let out = `<li><strong>[${escapeHtml(item.waktu)}]</strong> ${text(item.visual)}`;
    if (item.narasi) out += `<br>🎤 ${text(item.narasi)}`;
    if (item.efek) out += `<br><em>Efek: ${text(item.efek)}</em>`;
    return out + '</li>';
  }

  // Kuis interaktif
  if (item.nomor && item.pertanyaan) {
    let out = `<li><strong>${escapeHtml(item.nomor)}. ${text(item.pertanyaan)}</strong>`;
    if (item.opsi?.length) {
      const labels = ['A', 'B', 'C', 'D', 'E'];
      out += '<ul>';
      item.opsi.forEach((o, idx) => {
        const txt = String(o).replace(/^[A-Ea-e][.\s)]+\s*/, '');
        out += `<li>${labels[idx] || idx + 1}. ${text(txt)}</li>`;
      });
      out += '</ul>';
    }
    out += `<br><span style="color:#c62828;">Kunci: ${escapeHtml(item.kunci || '')}</span>`;
    if (item.feedbackBenar)
      out += `<br><span style="color:#2e7d32;">✅ ${text(item.feedbackBenar)}</span>`;
    if (item.feedbackSalah)
      out += `<br><span style="color:#c62828;">❌ ${text(item.feedbackSalah)}</span>`;
    return out + '</li>';
  }

  // Elemen infografis
  if (item.label && item.data) {
    return `<li><strong>${text(item.label)}:</strong> ${text(item.data)}${
      item.warna ? ` (warna: ${escapeHtml(item.warna)})` : ''
    }</li>`;
  }

  return '';
}

/**
 * @param {object} json hasil Phase 3
 * @param {object} [input]
 * @returns {string}
 */
export function buildMediaHTML(json, input = store.state.input) {
  const media = json.media || json;
  const li = (items) => list(items, 'ol', mediaItem);

  let html = `<div class="rpp-document">`;
  html += `<div class="doc-title">MEDIA PEMBELAJARAN</div>`;
  html += `<div class="doc-subtitle">${escapeHtml(input.mapel || '')} — ${escapeHtml(
    input.materi || ''
  )}</div>`;

  if (media.slidePresentasi?.length) {
    html += `<div class="section-header">📊 SLIDE PRESENTASI</div>`;
    html += li(media.slidePresentasi);
  }

  if (media.videoScript) {
    html += `<div class="section-header">🎬 VIDEO PEMBELAJARAN</div>`;
    if (media.videoScript.durasi) {
      html += `<p><strong>Durasi:</strong> ${escapeHtml(media.videoScript.durasi)}</p>`;
    }
    if (media.videoScript.adegan?.length) {
      html += table(
        ['Waktu', 'Visual', 'Narasi', 'Efek'],
        media.videoScript.adegan.map((a) => ({
          Waktu: a.waktu || '',
          Visual: a.visual || '',
          Narasi: a.narasi || '',
          Efek: a.efek || '',
        }))
      );
    }
  }

  if (media.infografis) {
    html += `<div class="section-header">📈 INFOGRAFIS</div>`;
    html += `<p style="text-align:center;font-weight:700;font-size:1rem;">${escapeHtml(
      media.infografis.judul || ''
    )}</p>`;
    if (media.infografis.elemen?.length) {
      html += table(
        ['Elemen', 'Data', 'Warna'],
        media.infografis.elemen.map((e) => ({
          Elemen: e.label || '',
          Data: e.data || '',
          Warna: e.warna || '',
        }))
      );
    }
  }

  if (media.kuisInteraktif?.length) {
    html += `<div class="section-header">🎯 KUIS INTERAKTIF</div>`;
    html += li(media.kuisInteraktif);
  }

  if (media.poster) {
    html += `<div class="section-header">🖼️ POSTER EDUKATIF</div>`;
    html += kvTable(
      [
        ['Judul', text(media.poster.judul)],
        ['Konten', text(media.poster.konten)],
        ['Warna Dominan', text(media.poster.warnaDominan)],
        ['Gambar', text(media.poster.gambar || '-')],
      ],
      120
    );
  }

  html += `</div>`;
  return html;
}
