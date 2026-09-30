/**
 * Template renderer Phase 1 (RPP + Lampiran).
 * Menghasilkan HTML dokumen siap print/export.
 */

import { store } from '../core/store.js';
import {
  deriveColumns,
  escapeHtml,
  itemHtml,
  kvTable,
  list,
  para,
  renderSoalBlock,
  table,
  text,
} from './html-helpers.js';

/** Tanggal pengesahan dalam format Indonesia. */
function formatTanggal(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Pemetaan objek umum → <li> (dipakai banyak daftar).
 * Semua bentuk item (nama/detail, pihak/peran, aspek/detail, tahap/tools,
 * pertanyaan/jawaban, key tak dikenal) dirender oleh `itemHtml` tanpa membuang isi.
 */
function defaultListItem(item) {
  return itemHtml(item);
}

/**
 * @param {object} json hasil Phase 1: `{ rpp, lampiran }`
 * @param {object} [input] isi form (default dari store)
 * @returns {string} HTML dokumen
 */
export function buildRPPHTML(json, input = store.state.input) {
  const rpp = json.rpp || json;
  const lamp = json.lampiran || {};
  const ident = rpp.identifikasi || {};
  const desain = rpp.desainPembelajaran || {};
  const langkah = rpp.langkahPembelajaran || {};
  const asesmen = rpp.asesmen || {};

  const today = formatTanggal(input.tanggal);
  const li = (items) => list(items, 'ol', defaultListItem);

  let html = `<div class="rpp-document">`;

  // ---- Judul & identitas utama ----
  html += `<div class="doc-title">RENCANA PELAKSANAAN PEMBELAJARAN</div>`;
  html += `<div class="doc-subtitle">PEMBELAJARAN DEEP LEARNING DENGAN KURIKULUM BERBASIS CINTA (KBC)</div>`;
  html += kvTable([
    ['Nama Madrasah', escapeHtml(input.madrasah)],
    ['Nama Guru', escapeHtml(input.guru)],
    ['NUPTK', escapeHtml(input.nuptk || '-')],
    ['Mata Pelajaran', escapeHtml(input.mapel)],
    ['Materi Pelajaran', escapeHtml(input.materi)],
    ['Elemen', escapeHtml(input.elemen)],
    ['Fase/Kelas/Smt', escapeHtml(input.fase)],
    ['Tahun Ajaran', escapeHtml(input.tahunPelajaran)],
    ['Alokasi Waktu', escapeHtml(input.alkok)],
  ]);

  // ---- Identifikasi ----
  html += `<div class="section-header">IDENTIFIKASI</div>`;
  html += kvTable([
    ['Peserta Didik', text(ident.pesertaDidik)],
    ['Materi Pelajaran', text(ident.materiPelajaran)],
    ['Dimensi Profil Lulusan', li(ident.dimensiProfilLulusan)],
    ['Tema Kurikulum Cinta', li(ident.temaKurikulumCinta)],
    ['Materi Integrasi KBC', li(ident.materiIntegrasiKBC)],
  ]);

  // ---- Desain Pembelajaran ----
  html += `<div class="section-header">DESAIN PEMBELAJARAN</div>`;
  html += kvTable([
    ['Capaian Pembelajaran', text(desain.capaianPembelajaran)],
    [
      'Lintas Disiplin Ilmu',
      desain.lintasDisiplinIlmu?.length ? li(desain.lintasDisiplinIlmu) : false,
    ],
    ['Tujuan Pembelajaran', li(desain.tujuanPembelajaran)],
    ['Topik Pembelajaran', li(desain.topikPembelajaran)],
    [
      'Model Pembelajaran',
      desain.praktekPedagogis ? text(desain.praktekPedagogis.modelPembelajaran) : false,
    ],
    [
      'Sintaks',
      desain.praktekPedagogis?.sintaks?.length ? li(desain.praktekPedagogis.sintaks) : false,
    ],
    [
      'Metode',
      desain.praktekPedagogis?.metode?.length ? li(desain.praktekPedagogis.metode) : false,
    ],
    ['Kemitraan', desain.kemitraanPembelajaran?.length ? li(desain.kemitraanPembelajaran) : false],
  ]);

  if (desain.lingkunganPembelajaran) {
    html += kvTable(
      [
        ['Lingkungan Pembelajaran', text(desain.lingkunganPembelajaran.ruangFisik)],
        ['Budaya Belajar', text(desain.lingkunganPembelajaran.budayaBelajar)],
        [
          'Penerapan Nyata',
          desain.lingkunganPembelajaran.penerapanNyata?.length
            ? li(desain.lingkunganPembelajaran.penerapanNyata)
            : false,
        ],
      ],
      200
    );
  }
  if (desain.pemanfaatanDigital?.length) {
    html += kvTable([['Pemanfaatan Digital', li(desain.pemanfaatanDigital)]], 200);
  }

  // ---- Diferensiasi ----
  if (rpp.diferensiasiPembelajaran) {
    html += `<div class="section-header">DIFERENSIASI PEMBELAJARAN</div>`;
    html += kvTable([
      ['Diferensiasi Konten', text(rpp.diferensiasiPembelajaran.konten)],
      ['Diferensiasi Proses', text(rpp.diferensiasiPembelajaran.proses)],
      ['Diferensiasi Produk', text(rpp.diferensiasiPembelajaran.produk)],
    ]);
  }

  // ---- Langkah Pembelajaran ----
  html += `<div class="section-header">LANGKAH-LANGKAH PEMBELAJARAN</div>`;
  if (langkah.prinsip?.length) {
    html += kvTable([['Prinsip Deep Learning', li(langkah.prinsip)]], 160);
  }
  if (langkah.kegiatanAwal) {
    html += `<div class="sub-header">Kegiatan Awal (${escapeHtml(
      langkah.kegiatanAwal.durasi || '10 menit'
    )})</div>`;
    html += li(langkah.kegiatanAwal.langkah || []);
  }
  if (langkah.kegiatanInti) {
    html += `<div class="sub-header">Kegiatan Inti (${escapeHtml(
      langkah.kegiatanInti.durasi || '50 menit'
    )})</div>`;
    if (langkah.kegiatanInti.tahap?.length) {
      for (const t of langkah.kegiatanInti.tahap) {
        html += `<div style="font-weight:600;margin:8px 0 4px;">${escapeHtml(t.nama || '')}</div>`;
        html += li(t.langkah || []);
      }
    } else {
      html += li(langkah.kegiatanInti.langkah || []);
    }
  }
  if (langkah.kegiatanPenutup) {
    html += `<div class="sub-header">Kegiatan Penutup (${escapeHtml(
      langkah.kegiatanPenutup.durasi || '10 menit'
    )})</div>`;
    html += li(langkah.kegiatanPenutup.langkah || []);
  }

  // ---- Asesmen ----
  html += `<div class="section-header">ASESMEN PEMBELAJARAN</div>`;
  html += kvTable(
    [
      ['Asesmen Awal', asesmen.asesmenAwal?.length ? li(asesmen.asesmenAwal) : false],
      ['Asesmen Proses', asesmen.asesmenProses?.length ? li(asesmen.asesmenProses) : false],
      ['Asesmen Akhir', asesmen.asesmenAkhir?.length ? li(asesmen.asesmenAkhir) : false],
    ],
    160
  );

  // ---- Pengesahan ----
  const tempatTanggal = [input.tempat, today].filter(Boolean).join(', ');
  html += `<div class="pengesahan">`;
  html += `<table class="pengesahan-table">
    <tr>
      <td>Mengetahui,<br><strong>Kepala Madrasah</strong><br><br><br><br><span class="nama">${escapeHtml(
        input.kepsek || ''
      )}</span><br><span class="nuptk">${
        input.kepsekNuptk ? `NUPTK: ${escapeHtml(input.kepsekNuptk)}` : ''
      }</span></td>
      <td>${escapeHtml(tempatTanggal)}<br><strong>Guru Pengampu</strong><br><br><br><br><span class="nama">${escapeHtml(
        input.guru || ''
      )}</span><br><span class="nuptk">${
        input.nuptk ? `NUPTK: ${escapeHtml(input.nuptk)}` : ''
      }</span></td>
    </tr>
  </table>`;
  html += `</div>`;

  // ===================== LAMPIRAN =====================
  html += renderDiagnostik(lamp.diagnostik);
  html += renderLKPD(lamp.lkpd, input);
  html += renderEvaluasi(lamp.evaluasi);
  html += renderRemedialPengayaan(lamp);
  html += renderRubrik(lamp.rubrikPenilaian);

  html += `</div>`;
  return html;
}

function renderDiagnostik(dg) {
  if (!dg) return '';
  let html = `<div class="section-header page-break" style="padding-top:40px;">LAMPIRAN: TES DIAGNOSTIK AWAL KOGNITIF</div>`;
  if (dg.soal?.length) {
    html += `<div class="sub-header">Soal Tes Diagnostik</div>`;
    for (const s of dg.soal) html += renderSoalBlock(s, { showLevel: true });
  }
  if (dg.rubrik) {
    html += `<div class="sub-header">Rubrik Interpretasi Hasil</div>`;
    if (dg.rubrik.aspek?.length) {
      html += `<div><strong>Aspek yang dinilai:</strong> ${escapeHtml(
        dg.rubrik.aspek.join(', ')
      )}</div><br>`;
    }
    if (dg.rubrik.interpretasi?.length) {
      const headers = ['Rentang Skor', 'Kategori', 'Tindak Lanjut'];
      const rows = dg.rubrik.interpretasi.map((r) => ({
        'Rentang Skor': r.rentangSkor || '',
        Kategori: r.kategori || '',
        'Tindak Lanjut': r.tindakLanjut || '',
      }));
      html += table(headers, rows);
    }
  }
  return html;
}

function renderLKPD(lkpd, input) {
  if (!lkpd) return '';
  let html = `<div class="section-header page-break" style="padding-top:40px;">LAMPIRAN: LEMBAR KERJA PESERTA DIDIK (LKPD)</div>`;
  html += kvTable(
    [
      ['Mata Pelajaran', text(lkpd.identitas?.mataPelajaran)],
      ['Kelas/Semester', text(lkpd.identitas?.kelasSemester)],
      ['Materi Pokok', text(lkpd.identitas?.materiPokok)],
      ['Alokasi Waktu', text(lkpd.identitas?.alokasiWaktu)],
    ],
    180
  );

  if (lkpd.tujuan?.length) {
    html += `<div class="sub-header">Tujuan Pembelajaran</div>${list(lkpd.tujuan, 'ol', (i) => `<li>${text(i)}</li>`)}`;
  }
  if (lkpd.aktivitas?.length) {
    for (const a of lkpd.aktivitas) {
      html += `<div class="sub-header">${escapeHtml(a.nama || '')}</div>`;
      if (a.deskripsi) html += para(a.deskripsi);
      if (a.tugas?.length) html += list(a.tugas, 'ol', (i) => `<li>${text(i)}</li>`);
    }
  }
  if (lkpd.tabelPerbandingan?.data?.length) {
    const judul = lkpd.tabelPerbandingan.judul || `Tabel Perbandingan — ${input.materi || ''}`;
    html += `<div class="sub-header">${escapeHtml(judul)}</div>`;
    const cols = lkpd.tabelPerbandingan.kolom?.length
      ? lkpd.tabelPerbandingan.kolom
      : deriveColumns(lkpd.tabelPerbandingan.data);
    html += table(cols, lkpd.tabelPerbandingan.data);
  }
  if (lkpd.pertanyaan?.length) {
    html += `<div class="sub-header">Pertanyaan Pemahaman</div>${list(
      lkpd.pertanyaan,
      'ol',
      defaultListItem
    )}`;
  }
  return html;
}

function renderEvaluasi(ev) {
  if (!ev?.soal?.length) return '';
  let html = `<div class="section-header">LAMPIRAN: SOAL EVALUASI</div>`;
  for (const s of ev.soal) html += renderSoalBlock(s, { showLevel: true });
  if (ev.penskoran) {
    html += `<p style="margin-top:8px;"><strong>Penskoran:</strong> ${escapeHtml(ev.penskoran)}</p>`;
  }
  return html;
}

function renderRemedialPengayaan(lamp) {
  let html = '';
  if (lamp.programRemidial?.langkah?.length) {
    html += `<div class="section-header">LAMPIRAN: PROGRAM REMIDIAL</div>`;
    if (lamp.programRemidial.deskripsi) html += para(lamp.programRemidial.deskripsi);
    html += list(lamp.programRemidial.langkah, 'ol', (i) => `<li>${text(i)}</li>`);
  }
  if (lamp.programPengayaan?.langkah?.length) {
    html += `<div class="section-header">LAMPIRAN: PROGRAM PENGAYAAN</div>`;
    if (lamp.programPengayaan.deskripsi) html += para(lamp.programPengayaan.deskripsi);
    html += list(lamp.programPengayaan.langkah, 'ol', (i) => `<li>${text(i)}</li>`);
  }
  return html;
}

const RUBRIK_HEADERS = ['Aspek', 'Sangat Baik (4)', 'Baik (3)', 'Cukup (2)', 'Perlu Bimbingan (1)'];

function rubricRows(aspek) {
  // Pakai `||` (bukan `??`): AI kadang mengirim `sb: ""` sementara `SB` terisi,
  // dan kita mau mengambil nilai yang benar-benar non-kosong.
  return (aspek || []).map((a) => ({
    Aspek: a.nama || '',
    'Sangat Baik (4)': a.sb || a.SB || '',
    'Baik (3)': a.b || a.B || '',
    'Cukup (2)': a.c || a.C || '',
    'Perlu Bimbingan (1)': a.pb || a.PB || '',
  }));
}

function renderRubrik(rubrik) {
  if (!rubrik) return '';
  let html = '';
  if (rubrik.diskusi?.aspek?.length) {
    html += `<div class="section-header">LAMPIRAN: RUBRIK PENILAIAN DISKUSI</div>`;
    html += table(RUBRIK_HEADERS, rubricRows(rubrik.diskusi.aspek), { className: 'rubrik-table' });
  }
  if (rubrik.presentasi?.aspek?.length) {
    html += `<div class="section-header">LAMPIRAN: RUBRIK PENILAIAN PRESENTASI</div>`;
    html += table(RUBRIK_HEADERS, rubricRows(rubrik.presentasi.aspek), {
      className: 'rubrik-table',
    });
  }
  return html;
}

export { formatTanggal };
