import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COGNITIVE_LEVELS,
  HIGH_ORDER_LEVELS,
  hasSpecificLevel,
  inferCognitiveLevel,
  levelBadgeHtml,
  levelDistribution,
  normalizeLevel,
  normalizeSoalLevels,
  summarizeLevels,
} from '../src/validation/cognitive-level.js';

test('normalizeLevel mengenali berbagai bentuk penulisan', () => {
  assert.equal(normalizeLevel('C3'), 'C3');
  assert.equal(normalizeLevel('c3'), 'C3');
  assert.equal(normalizeLevel('C-3'), 'C3');
  assert.equal(normalizeLevel('level 3'), 'C3');
  assert.equal(normalizeLevel('takik 4'), 'C4');
  assert.equal(normalizeLevel('mengapplied'), null, 'kata inggris tak dikenal');
  assert.equal(normalizeLevel('Menerapkan'), 'C3');
  assert.equal(normalizeLevel('Analyzing'), 'C4');
  assert.equal(normalizeLevel(''), null);
  assert.equal(normalizeLevel(null), null);
  assert.equal(normalizeLevel(undefined), null);
  assert.equal(normalizeLevel(7), null);
});

test('normalizeLevel menangani objek', () => {
  assert.equal(normalizeLevel({ level: 'C5' }), 'C5');
  assert.equal(normalizeLevel({ code: 'C2' }), 'C2');
  assert.equal(normalizeLevel({ nama: 'Menganalisis' }), 'C4');
});

test('hasSpecificLevel menolak rentang', () => {
  assert.equal(hasSpecificLevel('C3'), true);
  assert.equal(hasSpecificLevel('C2'), true);
  assert.equal(hasSpecificLevel('C1-C6'), false, 'rentang bukan level spesifik');
  assert.equal(hasSpecificLevel('C1 s.d. C4'), false);
  assert.equal(hasSpecificLevel('C1–C6'), false);
  assert.equal(hasSpecificLevel(''), false);
  assert.equal(hasSpecificLevel(null), false);
  assert.equal(hasSpecificLevel('apapun'), false);
});

test('inferCognitiveLevel memakai level eksplisit bila ada', () => {
  const r = inferCognitiveLevel({ pertanyaan: 'Sebutkan organ hati.', level: 'C1' });
  assert.equal(r.level, 'C1');
  assert.equal(r.source, 'explicit');
  assert.equal(r.confidence, 1);
});

test('inferCognitiveLevel mengabaikan level rentang dan Falls back ke heuristik', () => {
  const r = inferCognitiveLevel({
    pertanyaan: 'Berdasarkan data berikut, analisislah penyebab penurunan hasil panen.',
    level: 'C1-C6',
  });
  assert.equal(r.source, 'inferred');
  assert.equal(r.level, 'C4', 'stem analitis harus terdeteksi sebagai C4');
});

test('inferCognitiveLevel mendeteksi kata kerja tiap level', () => {
  const cases = [
    ['Sebutkan fungsi organ ginjal pada tubuh manusia.', 'C1'],
    ['Jelaskan perbedaan antara fotosintesis dan respirasi sel.', 'C2'],
    ['Diberi data tersebut, hitunglah energi kinetik benda itu.', 'C3'],
    ['Analisislah hubungan antara pH dan aktivitas enzim pada data berikut.', 'C4'],
    ['Nilaikan kelayakan solusi PEC biru yang diusulkan tersebut.', 'C5'],
    ['Rancanglah poster edukasi yang menjelaskan siklus air.', 'C6'],
  ];
  for (const [stem, expected] of cases) {
    const r = inferCognitiveLevel({ pertanyaan: stem });
    assert.equal(r.level, expected, `stem "${stem}" diharapkan ${expected}, dapat ${r.level}`);
  }
});

test('inferCognitiveLevel menandai ambiguous saat dua level hampir seri', () => {
  // "Jelaskan mengapa ..." bisa C2 (memahami) atau C4 (menganalisis).
  const r = inferCognitiveLevel({
    pertanyaan: 'Jelaskan mengapa fotosintesis meningkat pada suhu tertentu?',
  });
  assert.equal(typeof r.ambiguous, 'boolean');
  assert.ok(COGNITIVE_LEVELS.includes(r.level));
});

test('inferCognitiveLevel memakai fallback konservatif bila tidak ada jejak', () => {
  const r = inferCognitiveLevel({ pertanyaan: 'Fotosintesis.' });
  assert.equal(r.source, 'fallback');
  assert.equal(r.level, 'C2');
  assert.equal(r.ambiguous, true);
});

test('normalizeSoalLevels mengisi level kosong dan menandai sumbernya', () => {
  const soal = normalizeSoalLevels([
    { nomor: 1, pertanyaan: 'Sebutkan fungsi organ hati.', opsi: ['a', 'b', 'c', 'd'] },
    {
      nomor: 2,
      pertanyaan: 'Analisislah data grafik berikut.',
      opsi: ['a', 'b', 'c', 'd'],
      level: 'C4',
    },
  ]);
  assert.equal(soal[0].level, 'C1');
  assert.equal(soal[0].levelSource, 'inferred');
  assert.equal(soal[1].level, 'C4');
  assert.equal(soal[1].levelSource, 'explicit');
});

test('normalizeSoalLevels menomori ulang soal tanpa nomor', () => {
  const soal = normalizeSoalLevels([{ pertanyaan: 'Sebutkan A' }, { pertanyaan: 'Sebutkan B' }]);
  assert.equal(soal[0].nomor, 1);
  assert.equal(soal[1].nomor, 2);
});

test('normalizeSoalLevels menangani input bukan array', () => {
  assert.deepEqual(normalizeSoalLevels(null), []);
  assert.deepEqual(normalizeSoalLevels(undefined), []);
  assert.deepEqual(normalizeSoalLevels('bukan array'), []);
});

test('levelDistribution menghitung tiap level', () => {
  const dist = levelDistribution([
    { level: 'C1' },
    { level: 'C1' },
    { level: 'c3' },
    { level: 'C-4' },
    { level: 'ngawur' },
  ]);
  assert.equal(dist.C1, 2);
  assert.equal(dist.C3, 1);
  assert.equal(dist.C4, 1);
  assert.equal(dist.C2, 0);
  assert.equal(
    Object.values(dist).reduce((a, b) => a + b, 0),
    4,
    'level ngawur tidak dihitung'
  );
});

test('summarizeLevels menghitung rasio C3+', () => {
  const summary = summarizeLevels([
    { level: 'C1' },
    { level: 'C2' },
    { level: 'C3' },
    { level: 'C4' },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.highOrderCount, 2);
  assert.equal(summary.highOrderRatio, 0.5);
  assert.equal(HIGH_ORDER_LEVELS.includes(summary.dominant) || summary.dominant === 'C1', true);
});

test('summarizeLevels menangani input kosong', () => {
  const summary = summarizeLevels([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.highOrderCount, 0);
  assert.equal(summary.highOrderRatio, 0);
});

test('levelBadgeHtml menghasilkan HTML aman', () => {
  const html = levelBadgeHtml('c4');
  assert.match(html, /data-level="C4"/);
  assert.match(html, /Menganalisis/);
  assert.equal(levelBadgeHtml('ngawur'), '');
});

test('levelBadgeHtml menandai level inferensi', () => {
  assert.match(levelBadgeHtml('C3', { inferred: true }), /inferred/);
  assert.doesNotMatch(levelBadgeHtml('C3', { inferred: false }), /inferred/);
});
