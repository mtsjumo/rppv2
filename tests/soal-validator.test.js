import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSoalFeedback,
  stripOptionLabel,
  validateDiagnostikSet,
  validateSoalSet,
  DEFAULT_THRESHOLDS,
} from '../src/validation/soal-validator.js';

/** Bank soal yang memenuhi semua ambang. */
function makeSoal(n = 10) {
  const levels = ['C1', 'C2', 'C1', 'C2', 'C3', 'C4', 'C3', 'C4', 'C3', 'C1'];
  const keys = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B'];
  const stems = [
    'Sebutkan organ-organ penyusun sistem pencernaan makanan.',
    'Jelaskan perbedaan antara respirasi aerob dan anaerob.',
    'Tuliskan fungsi utama organ paru-paru pada manusia.',
    'Uraikan fungsi bagian tumbuhan yang melakukan fotosintesis.',
    'Diberi data tersebut, hitunglah energi kinetik benda itu.',
    'Analisislah hubungan antara pH dan aktivitas enzim.',
    'Terapkan konsep difusi pada kasus компании airolds.',
    'Berdasarkan data pengamatan, tentukan pola perubahan tekanan.',
    'Menggunakan hukum Pascal, tentukan gaya pada piston kedua.',
    'Sebutkan dua contoh bahan bakar yang digunakan rumah tangga.',
  ];
  return Array.from({ length: n }, (_, i) => ({
    nomor: i + 1,
    pertanyaan: stems[i % stems.length] + (i >= stems.length ? ` (varian ${i})` : ''),
    opsi: [`A. Pilihan ${i}-1`, `B. Pilihan ${i}-2`, `C. Pilihan ${i}-3`, `D. Pilihan ${i}-4`],
    kunci: keys[i % keys.length],
    level: levels[i % levels.length],
  }));
}

test('stripOptionLabel membuang label A./1) dari opsi', () => {
  assert.equal(stripOptionLabel('A. Mitokondria'), 'Mitokondria');
  assert.equal(stripOptionLabel('B) Kloroplas'), 'Kloroplas');
  assert.equal(stripOptionLabel('1. Mitokondria'), 'Mitokondria');
  assert.equal(stripOptionLabel('3) Kloroplas'), 'Kloroplas');
  assert.equal(stripOptionLabel('  A.   Mitokondria '), 'Mitokondria');
  assert.equal(stripOptionLabel('Tanpa label'), 'Tanpa label');
  assert.equal(stripOptionLabel(null), '');
});

test('set soal yang baik lolos validasi', () => {
  const r = validateSoalSet(makeSoal(10));
  assert.equal(r.ok, true, `harusnya ok, tapi: ${JSON.stringify(r.issues)}`);
  assert.equal(r.issues.filter((i) => i.severity === 'error').length, 0);
  assert.equal(r.summary.highOrderCount >= DEFAULT_THRESHOLDS.minHighOrder, true);
});

test('kurang dari minimum soal ditolak', () => {
  const r = validateSoalSet(makeSoal(4));
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /minimal 10/.test(i.message)));
});

test('soal tanpa level C3+ ditolak (ini inti item C3–C4)', () => {
  const soal = makeSoal(10).map((s) => ({ ...s, level: 'C1' }));
  const r = validateSoalSet(soal);
  assert.equal(r.ok, false);
  const msg = r.issues.map((i) => i.message).join(' | ');
  assert.match(msg, /level C3\+ hanya 0/);
  assert.match(msg, /minimal 4/);
});

test('level di-inferensi otomatis bila AI hanya memberi rentang', () => {
  const soal = makeSoal(10).map((s) => ({ ...s, level: 'C1-C6' }));
  // Ganti stem nomor 6 dengan stem analitis agar inferensi jelas C4.
  soal[5].pertanyaan = 'Analisislah hubungan antara pH dan aktivitas enzim pada data berikut.';

  const r = validateSoalSet(soal);
  // Level eksplisit lain sudah cukup memenuhi ambang, jadi set tetap lolos.
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(r.soal[5].level, 'C4', 'stem analitis + range → C4 via heuristik');
  assert.equal(r.soal[5].levelSource, 'inferred');
  assert.ok(r.summary.inferredCount >= 1, 'level ter-inferensi harus dihitung');
});

test('seluruh level rentang di-inferensi, bukan dianggap eksplisit', () => {
  const r = validateSoalSet(makeSoal(10).map((s) => ({ ...s, level: 'C1-C6' })));
  assert.equal(r.summary.inferredCount, 10, 'tidak boleh ada yang dianggap eksplisit');
  assert.equal(r.summary.invalidLevelCount, 0, 'rentang bukan level invalid');
});

test('opsi bukan 4 pilihan ditolak', () => {
  const soal = makeSoal(10);
  soal[3].opsi = ['A. satu', 'B. dua', 'C. tiga'];
  const r = validateSoalSet(soal);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /opsi 3, minimal 4/.test(i.message)));
});

test('kunci jawaban di luar jangkauan ditolak', () => {
  const soal = makeSoal(10);
  soal[2].kunci = 'E';
  const r = validateSoalSet(soal);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /bukan A–D|kunci E/.test(i.message)));
});

test('kunci kosong ditolak', () => {
  const soal = makeSoal(10);
  soal[0].kunci = '';
  const r = validateSoalSet(soal);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /kunci jawaban kosong/.test(i.message)));
});

test('opsi duplikat dan opsi kosong ditolak', () => {
  const soal = makeSoal(10);
  soal[0].opsi = ['A. Sama', 'B. Sama', 'C. Beda', 'D. Lain'];
  soal[1].opsi = ['A. ', 'B. X', 'C. Y', 'D. Z'];
  const r = validateSoalSet(soal);
  assert.equal(r.ok, false);
  const msg = r.issues.map((i) => i.message).join(' | ');
  assert.match(msg, /opsi duplikat/);
  assert.match(msg, /opsi kosong/);
});

test('pertanyaan duplikat terdeteksi', () => {
  const soal = makeSoal(10);
  soal[5].pertanyaan = soal[0].pertanyaan;
  const r = validateSoalSet(soal);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /pertanyaan duplikat/.test(i.message)));
});

test('giveaway "semua jawaban benar" dilaporkan sebagai peringatan', () => {
  const soal = makeSoal(10);
  soal[0].opsi[3] = 'D. Semua jawaban benar';
  const r = validateSoalSet(soal);
  assert.ok(r.issues.some((i) => /giveaway/.test(i.message)));
  // Giveaway cuma peringatan, tidak menggagalkan set.
  assert.ok(!r.issues.some((i) => /giveaway/.test(i.message) && i.severity === 'error'));
});

test('kunci menumpuk di satu huruf memberi peringatan', () => {
  const soal = makeSoal(10).map((s) => ({ ...s, kunci: 'A' }));
  const r = validateSoalSet(soal);
  assert.ok(r.issues.some((i) => /kunci jawaban menumpuk/.test(i.message)));
  assert.ok(!r.issues.some((i) => /menumpuk/.test(i.message) && i.severity === 'error'));
});

test('pertanyaan terlalu pendek diberi peringatan', () => {
  const soal = makeSoal(10);
  soal[0].pertanyaan = 'Apa itu?';
  const r = validateSoalSet(soal);
  assert.ok(r.issues.some((i) => /terlalu pendek/.test(i.message)));
});

test('daftar soal kosong ditangani', () => {
  const r = validateSoalSet([]);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /Tidak ada soal/.test(i.message)));
  assert.equal(r.summary.total, 0);
});

test('input bukan array ditangani', () => {
  assert.equal(validateSoalSet(null).ok, false);
  assert.equal(validateSoalSet(undefined).ok, false);
  assert.equal(validateSoalSet('bukan array').ok, false);
});

test('ambang kustom dihormati', () => {
  const r = validateSoalSet(makeSoal(4), { thresholds: { minSoal: 3, minHighOrder: 0 } });
  assert.equal(r.ok, true, JSON.stringify(r.issues));
});

test('validateDiagnostikSet tidak menuntut C3+', () => {
  const soal = makeSoal(5).map((s) => ({ ...s, level: 'C1' }));
  const r = validateDiagnostikSet(soal);
  assert.equal(r.ok, true, JSON.stringify(r.issues));
});

test('validateDiagnostikSet tetap menolak soal terlalu sedikit', () => {
  const r = validateDiagnostikSet(makeSoal(3));
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /minimal 5/.test(i.message)));
});

test('buildSoalFeedback menyebut distribusi level aktual', () => {
  const soal = makeSoal(10).map((s) => ({ ...s, level: 'C1' }));
  const feedback = buildSoalFeedback(validateSoalSet(soal));
  assert.match(feedback, /Distribusi level saat ini/);
  assert.match(feedback, /C1=10/);
  assert.match(feedback, /Soal C3\+.*: 0/);
  assert.match(feedback, /MASALAH HARUS DIPERBAIKI/);
  assert.match(feedback, /minimal 4 soal berpikir tingkat tinggi/);
  assert.doesNotMatch(
    feedback,
    /\/python|undefined|NaN|\[object/,
    'pesan tidak boleh berisi artefak dump'
  );
});

test('buildSoalFeedback pada set yang baik tetap menyebut komposisi', () => {
  const feedback = buildSoalFeedback(validateSoalSet(makeSoal(10)));
  assert.match(feedback, /Distribusi level saat ini/);
  assert.doesNotMatch(feedback, /MASALAH HARUS DIPERBAIKI/);
  assert.doesNotMatch(feedback, /\/python|undefined|NaN|\[object/);
});

test('threshold default punya nilai yang masuk akal', () => {
  assert.equal(DEFAULT_THRESHOLDS.minSoal, 10);
  assert.equal(DEFAULT_THRESHOLDS.minOpsi, 4);
  assert.equal(DEFAULT_THRESHOLDS.minHighOrder, 4);
  assert.equal(DEFAULT_THRESHOLDS.minHighOrderRatio, 0.4);
});
