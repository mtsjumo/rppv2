/**
 * Pengecek kelengkapan tiap sub-phase / phase.
 *
 * Tujuannya: hasil AI yang jumlah itemnya kurang dari minimum yang diminta
 * tidak lolos diam-diam (silent quality loss). `checkCompleteness*` mengembalikan
 * `{ ok, issues }`; `issues` dipakai sebagai umpan balik ke model pada
 * completion retry.
 *
 * Semua fungsi murni — bisa diuji tanpa DOM.
 */

import { buildSoalFeedback, validateDiagnostikSet, validateSoalSet } from './soal-validator.js';

const array = (v) => (Array.isArray(v) ? v : []);
const atLeast = (v, n) => array(v).length >= n;

export function checkCompletenessRPP(json) {
  const issues = [];
  const rpp = json.rpp || json;
  const desain = rpp.desainPembelajaran || {};
  const langkah = rpp.langkahPembelajaran || {};

  if (!rpp.diferensiasiPembelajaran) issues.push('diferensiasiPembelajaran kosong');
  if (!atLeast(desain.tujuanPembelajaran, 1)) issues.push('tujuanPembelajaran kosong');
  if (!atLeast(desain.topikPembelajaran, 1)) issues.push('topikPembelajaran kosong');

  const tahap = array(langkah.kegiatanInti?.tahap);
  if (tahap.length < 3) {
    issues.push('kegiatanInti.tahap harus 3 (Memahami/Mengaplikasi/Merefleksi)');
  }
  if (tahap.some((t) => !atLeast(t?.langkah, 2))) {
    issues.push('ada tahap kegiatan inti dengan langkah < 2');
  }
  if (!atLeast(langkah.kegiatanAwal?.langkah, 2)) {
    issues.push('kegiatanAwal.langkah kurang dari 2');
  }
  if (!atLeast(langkah.kegiatanPenutup?.langkah, 2)) {
    issues.push('kegiatanPenutup.langkah kurang dari 2');
  }
  if (!atLeast(langkah.prinsip, 3)) {
    issues.push('prinsip Deep Learning (Mindful/Meaningful/Joyful) kurang dari 3');
  }

  return { ok: issues.length === 0, issues };
}

export function checkCompletenessLKPD(json) {
  const issues = [];
  const lkpd = json.lkpd || json;

  if (!atLeast(lkpd.aktivitas, 2)) issues.push('aktivitas kurang dari 2');
  if (!atLeast(lkpd.tabelPerbandingan?.data, 3)) {
    issues.push('tabelPerbandingan.data kurang dari 3 baris');
  }
  if (!atLeast(lkpd.pertanyaan, 2)) issues.push('pertanyaan pemahaman kurang dari 2');

  // Tabel perbandingan: jumlah sel tiap baris harus sama dengan jumlah kolom.
  const kolom = array(lkpd.tabelPerbandingan?.kolom);
  const data = array(lkpd.tabelPerbandingan?.data);
  if (kolom.length && data.length) {
    data.forEach((row, i) => {
      if (Array.isArray(row) && row.length !== kolom.length) {
        issues.push(
          `tabelPerbandingan.data baris ${i + 1} punya ${row.length} sel, harus ${kolom.length} (sesuai jumlah kolom)`
        );
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Kelengkapan evaluasi. Selain jumlah soal, kini juga menjalankan
 * `validateSoalSet` sehingga komposisi level kognitif C1–C6 (khususnya
 * minimal C3+) ikut dijaga.
 */
export function checkCompletenessEvaluasi(json) {
  const ev = json.evaluasi || json;
  const issues = [];

  if (array(ev.soal).some((s) => !Array.isArray(s.opsi) || s.opsi.length !== 4)) {
    issues.push('ada soal dengan opsi bukan 4 pilihan');
  }

  const validation = validateSoalSet(array(ev.soal));
  // Hanya severity 'error' yang memicu completion retry; 'warn' ditampilkan
  // sebagai catatan kualitas di preview.
  issues.push(...validation.issues.filter((i) => i.severity === 'error').map((i) => i.message));

  const result = { ok: issues.length === 0, issues };
  result.warnings = validation.issues.filter((i) => i.severity === 'warn').map((i) => i.message);
  result.cognitiveSummary = validation.summary;
  // Umpan balik spesifik ke model: menyebut distribusi level aktual supaya
  // model tahu bagian mana yang kurang (bukan cuma "perbaiki yang kurang").
  result.feedback = buildSoalFeedback(validation);
  return result;
}

export function checkCompletenessLampiranAkhir(json) {
  const issues = [];
  if (!atLeast(json.programRemidial?.langkah, 3))
    issues.push('programRemidial.langkah kurang dari 3');
  if (!atLeast(json.programPengayaan?.langkah, 3)) {
    issues.push('programPengayaan.langkah kurang dari 3');
  }
  if (!atLeast(json.rubrikPenilaian?.diskusi?.aspek, 3)) {
    issues.push('rubrik diskusi: aspek kurang dari 3');
  }
  if (!atLeast(json.rubrikPenilaian?.presentasi?.aspek, 3)) {
    issues.push('rubrik presentasi: aspek kurang dari 3');
  }
  return { ok: issues.length === 0, issues };
}

export function checkCompletenessModulAjar(json) {
  const issues = [];
  const ma = json.modulAjar || json;
  const subBab = array(ma.bahanAjar?.subBab);

  if (subBab.length < 3) issues.push(`subBab hanya ${subBab.length}, minimal 3`);
  if (array(ma.glosarium).length < 8) {
    issues.push(`glosarium hanya ${array(ma.glosarium).length}, minimal 8`);
  }
  if (array(ma.faq).length < 3) issues.push(`FAQ hanya ${array(ma.faq).length}, minimal 3`);
  if (!ma.refleksiGuru) issues.push('refleksiGuru kosong');
  if (array(ma.referensi).length < 3) {
    issues.push(`referensi hanya ${array(ma.referensi).length}, minimal 3`);
  }
  if (array(ma.ringkasanMateri).length < 3) {
    issues.push(`ringkasanMateri hanya ${array(ma.ringkasanMateri).length}, minimal 3`);
  }
  if (array(ma.mindmap?.cabang).length < 3) {
    issues.push(`mindmap cabang hanya ${array(ma.mindmap?.cabang).length}, minimal 3`);
  }
  // Setiap sub-bab harus punya isi, bukan cuma judul.
  const kosong = subBab.filter((sb) => !String(sb?.konten ?? '').trim()).length;
  if (kosong > 0) {
    issues.push(`${kosong} subBab tidak memiliki konten`);
  }

  return { ok: issues.length === 0, issues };
}

export function checkCompletenessMedia(json) {
  const issues = [];
  const media = json.media || json;
  const slide = array(media.slidePresentasi);
  const adegan = array(media.videoScript?.adegan);
  const kuis = array(media.kuisInteraktif);

  if (slide.length < 10) issues.push(`slide hanya ${slide.length}, minimal 10`);
  if (adegan.length < 5) issues.push('adegan video kurang dari 5');
  if (kuis.length < 5) issues.push('kuis interaktif kurang dari 5');
  if (array(media.infografis?.elemen).length < 5) {
    issues.push('elemen infografis kurang dari 5');
  }
  if (!media.poster?.judul) issues.push('poster edukatif kosong');
  if (slide.some((s) => !String(s?.catatanPembicara ?? '').trim())) {
    issues.push('ada slide tanpa catatan pembicara');
  }

  return { ok: issues.length === 0, issues };
}

export function checkCompletenessDiagnostik(json) {
  const issues = [];
  const dg = json.diagnostik || json;
  const soal = array(dg.soal);

  if (array(dg.rubrik?.interpretasi).length < 2) {
    issues.push('interpretasi rubrik diagnostik kurang dari 2');
  }
  if (array(dg.rubrik?.aspek).length < 2) {
    issues.push('aspek rubrik diagnostik kurang dari 2');
  }

  const validation = validateDiagnostikSet(soal);
  issues.push(...validation.issues.filter((i) => i.severity === 'error').map((i) => i.message));

  const result = { ok: issues.length === 0, issues };
  result.warnings = validation.issues.filter((i) => i.severity === 'warn').map((i) => i.message);
  result.cognitiveSummary = validation.summary;
  result.feedback = buildSoalFeedback(validation);
  return result;
}

/** Peta id sub-phase Phase 1 -> checker-nya. */
export const COMPLETENESS_CHECKERS = {
  a: checkCompletenessRPP,
  b: checkCompletenessLKPD,
  c: checkCompletenessEvaluasi,
  d: checkCompletenessLampiranAkhir,
  e: checkCompletenessDiagnostik,
};

/** Checker phase-level. */
export const PHASE_CHECKERS = {
  2: checkCompletenessModulAjar,
  3: checkCompletenessMedia,
};

/** Punya checker kelengkapan? */
export function getChecker(phaseKey) {
  return COMPLETENESS_CHECKERS[phaseKey] ?? PHASE_CHECKERS[phaseKey] ?? null;
}
