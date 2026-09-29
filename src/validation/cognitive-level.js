/**
 * Taksonomi Level Kognitif C1–C6.
 *
 * Menggabungkan taksonomi Bloom yang direvisi (Anderson & Krathwohl) dengan
 * Level Kognitif C1–C6 yang lazim dipakai diassessment ::= Indonesia (BSIK /
 * KMK), memetakan:
 *
 *   C1 Mengingat    <-> Bloom: Remembering
 *   C2 Memahami    <-> Bloom: Understanding
 *   C3 Menerapkan  <-> Bloom: Applying
 *   C4 Menganalisis <-> Bloom: Analyzing
 *   C5 Menilai     <-> Bloom: Evaluating
 *   C6 Mencipta    <-> Bloom: Creating
 *
 * Modul ini murni (tidak menyentuh DOM) supaya bisa diuji terpisah dan dipakai
 * ulang oleh validator, renderer, dan pelaporan kualitas.
 */

export const COGNITIVE_LEVELS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];

/** Level yang dianggap "penalaran tinggi" — target minimum soal evaluasi. */
export const HIGH_ORDER_LEVELS = ['C3', 'C4', 'C5', 'C6'];

/** Level yang dianggapRecall/reading saja. */
export const LOW_ORDER_LEVELS = ['C1', 'C2'];

export const LEVEL_DEFINITIONS = {
  C1: {
    code: 'C1',
    nama: 'Mengingat',
    bloom: 'Remembering',
    deskripsi: 'Mengynosesis informasi: mengingat, menyebut, menunjukkan, mendefinisikan.',
    kataKunci: [
      'sebutkan',
      'namakan',
      'tuliskan',
      'apakah',
      'apa',
      'siapa',
      'kapan',
      'di mana',
      'mengapa',
      'definisikan',
      'identifikasi',
      'sebut',
      'tulis',
      'ingat',
      'hafal',
      'daftar',
      'jelaskan secara lisan',
    ],
    polaPertanyaan: [
      'Pernyataan manakah yang benar tentang ...?',
      'Manakah yang termasuk ...?',
      'Tuliskan fungsi dari ...!',
    ],
    contoh: 'Sebutkan organ-organ penyusun sistem pencernaan makanan.',
  },
  C2: {
    code: 'C2',
    nama: 'Memahami',
    bloom: 'Understanding',
    deskripsi: 'Memaknai informasi:afsirkan, ringkas, bandingkan, jelaskan dengan kalimat sendiri.',
    kataKunci: [
      'jelaskan',
      'uraikan',
      'ringkas',
      'bandingkan',
      'bedakan',
      'klasifikasi',
      'contohkan',
      'terjemahkan',
      'tafsirkan',
      'mengapa',
      'bagaimana',
      'apakah pernyataan',
      'kesimpulan',
      'ide utama',
      'pokok',
    ],
    polaPertanyaan: [
      'Mengapa ... dapat terjadi?',
      'Pernyataan manakah yang paling tepat menjelaskan ...?',
      'Manakah perbedaan antara X dan Y?',
    ],
    contoh: 'Jelaskan perbedaan antara respirasi aerob dan anaerob.',
  },
  C3: {
    code: 'C3',
    nama: 'Menerapkan',
    bloom: 'Applying',
    deskripsi: 'Menggunakan konsep pada situasi baru: perhitungan, prosedur, penerapan kaidah.',
    kataKunci: [
      'terapkan',
      'hitung',
      'hitunglah',
      'perhitungkan',
      'gunakan',
      'makaikan',
      'selesaikan',
      'kerjakan',
      'lakukan',
      'sedangkan',
      'pada kasus',
      'dalam situasi',
      'diberi data',
      'tentukan nilai',
      'hitung besar',
    ],
    polaPertanyaan: [
      'Diberi data X, hitunglah nilai Y!',
      'Perhatikan kasus berikut.apakah nilai yang benar adalah ...?',
      'Bagaimana cara menentukan ... pada kondisi tersebut?',
    ],
    contoh: 'Diberi data tersebut, hitunglah energi kinetic benda itu.',
  },
  C4: {
    code: 'C4',
    nama: 'Menganalisis',
    bloom: 'Analyzing',
    deskripsi: 'Menguraikan hubungan sebab-akibat, mencari pola, dan menyimpulkan dari data.',
    kataKunci: [
      'analisis',
      'analisislah',
      'mengapa',
      'sebab',
      'akibat',
      'pola',
      'hubungkan',
      'kaitkan',
      'bandingkan',
      'bedakan',
      'menguraikan',
      'tentukan hubungan',
      'kasus berikut',
      'studi kasus',
      'data berikut',
      'grafik',
      'tabel berikut',
      'mengapa hal ini',
      'jelaskan hubungan',
    ],
    polaPertanyaan: [
      'Berdasarkan data berikut, kesimpulan yang tepat adalah ...',
      'Analisislah penyebab yang dominan pada kasus berikut.',
      'Fenomena di bawah ini menunjukkan ...',
    ],
    contoh: 'Berdasarkan data pengamatan, tentukan hubungan antara pH dan aktivitas enzim.',
  },
  C5: {
    code: 'C5',
    nama: 'Menilai',
    bloom: 'Evaluating',
    deskripsi:
      'Memberi penilaian berdasarkan kriteria: membandingkan memecahkan, mengevaluasi solusi.',
    kataKunci: [
      'nilai',
      'nilaikan',
      'evaluasi',
      'berikan alasan',
      'apakah tepat',
      'apakah benar',
      'apakah sesuai',
      'kritik',
      'kekurangan',
      'kelebihan',
      'paling tepat',
      'paling baik',
      'paling efektif',
      'layak',
      'layakkah',
      'memutuskan',
    ],
    polaPertanyaan: [
      'Pernyataan manakah yang paling tepat menjelaskan ...?',
      'Manakah solusi yang paling efektif ...?',
      'Nilaikan kelayakan ...',
    ],
    contoh: 'Nilaikan kelayakan solusi yang diusulkan untuk mengatasi masalah tersebut.',
  },
  C6: {
    code: 'C6',
    nama: 'Mencipta',
    bloom: 'Creating',
    deskripsi: 'Merancang produk baru: merancang, menyusun, mem prototyping, mengarang.',
    kataKunci: [
      'rancang',
      'rancanglah',
      'ancang',
      'buat',
      'buatkan',
      'susun',
      'susunlah',
      'karang',
      'ciptakan',
      'kreasikan',
      'tentukan desain',
      'usulkan solusi',
      'formulasikan',
      'prototipe',
    ],
    polaPertanyaan: ['Rancanglah ... untuk ...', 'Usulkan solusi yang tepat untuk mengatasi ...'],
    contoh: 'Rancanglah poster edukasi yang menjelaskan siklus air secara sederhana.',
  },
};

/** Normalisasi level dari teks bebas: "c3", "level c4", "C-3", "menerapkan" → "C3". */
export function normalizeLevel(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    return normalizeLevel(value.level ?? value.code ?? value.nama ?? null);
  }
  const raw = String(value).trim();
  if (!raw) return null;

  // Bentuk eksplisit: C3 / c-3 / level 3 / takik 3
  const explicit = raw.match(/(?:level|takik|c)\s*[-\s]?\s*([1-6])/i);
  if (explicit) return `C${explicit[1]}`;

  // Nama level (Indonesia atau Inggris)
  const byName = COGNITIVE_LEVELS.find(
    (code) =>
      LEVEL_DEFINITIONS[code].nama.toLowerCase() === raw.toLowerCase() ||
      LEVEL_DEFINITIONS[code].bloom.toLowerCase() === raw.toLowerCase()
  );
  if (byName) return byName;

  return null;
}

/** Deskripsi lengkap sebuah level; null bila tidak dikenal. */
export function getLevelDefinition(code) {
  return LEVEL_DEFINITIONS[normalizeLevel(code)] ?? null;
}

/** Deskripsi singkat siap tampil di UI/label. */
export function describeLevel(code) {
  const def = getLevelDefinition(code);
  return def ? `${def.code} — ${def.nama} (${def.bloom})` : 'Tidak teridentifikasi';
}

/**
 * Hitung skor heuristik sebuah stem soal terhadap tiap level C1–C6.
 * Mengembalikan objek `{ C1: n, C2: n, ... }`.
 *
 * Bobot kata kunci diprocal dengan panjang kata kunci (kata kunci lebih
 * spesifik = bobot lebih tinggi) supaya "mengapa" (ambigu, ada di C2 & C4)
 * tidak mengalahkan "menganalisis".
 */
export function scoreStemByLevels(text) {
  const stem = String(text ?? '').toLowerCase();
  const scores = Object.fromEntries(COGNITIVE_LEVELS.map((c) => [c, 0]));

  if (!stem) return scores;

  for (const code of COGNITIVE_LEVELS) {
    for (const keyword of LEVEL_DEFINITIONS[code].kataKunci) {
      const kw = keyword.toLowerCase();
      if (!kw || kw.length < 3) continue;
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i');
      if (!re.test(stem)) continue;

      // Bobot: kata panjang & spesifik lebih tinggi. "mengapa" (6) = 1.0,
      // "menggunakan" (10) ≈ 1.6, "menganalisis" (11) ≈ 1.7.
      const weight = 1 + Math.min(keyword.length, 14) / 12;
      // Durasi kata: frasa panjang sangat spesifik ("studi kasus") dapat bobot penuh.
      scores[code] += wordCount(keyword) > 1 ? weight * 1.3 : weight;
    }
  }
  return scores;
}

function wordCount(s) {
  return String(s).trim().split(/\s+/).length;
}

/**
 * Infer level kognitif sebuah soal dari teks pertanyaannya.
 * Dipakai ketika AI tidak mengisi field `level`, atau mengisinya dengan
 * rentang ("C1-C6") yang tidak berguna.
 *
 * Mengembalikan:
 *   `{ level, source: 'explicit'|'inferred'|'fallback', confidence, scores, ambiguous }`
 */
export function inferCognitiveLevel(soal) {
  const text = `${soal?.pertanyaan ?? ''} ${(soal?.opsi ?? []).join(' ')}`;

  // 1) Level eksplisit & spesifik dari AI.
  //    RENTANG ("C1-C6") sengaja tidak dihitung: normalizeLevel() akan
  //    mengekstrak "C1" darinya, padahal rentang bukan level yang bisa
  //    dipakai untuk penilaian. Flag `range` menandai kasus itu.
  const hasRange = isRangeValue(soal?.level);
  if (!hasRange) {
    const explicit = normalizeLevel(soal?.level);
    if (explicit) {
      return {
        level: explicit,
        source: 'explicit',
        confidence: 1,
        scores: scoreStemByLevels(text),
        ambiguous: false,
      };
    }
  }

  // 2) Level dari heuristik teks.
  const scores = scoreStemByLevels(text);
  const ranked = COGNITIVE_LEVELS.map((code) => ({ code, score: scores[code] })).sort(
    (a, b) => b.score - a.score
  );
  const top = ranked[0];
  const second = ranked[1];

  if (!top || top.score <= 0) {
    // Tidak ada jejak: default konservatif ke C2 (memahami), tandai ambiguous.
    return {
      level: 'C2',
      source: 'fallback',
      confidence: 0.2,
      scores,
      ambiguous: true,
    };
  }

  // Ambigu bila dua level teratas nyaris seri (mis. C2 vs C4 sama-sama kuat
  // karena stem-nya "mengapa ...?"). confidence diturunkan, caller bisa
  // memutuskan untuk menandai soal perlu ditinjau.
  const margin = top.score - second.score;
  const ratio = top.score > 0 ? margin / top.score : 0;
  const ambiguous = ratio < 0.25;

  return {
    level: top.code,
    source: 'inferred',
    confidence: Math.max(0.3, Math.min(0.95, 0.55 + ratio * 0.4)),
    scores,
    ambiguous,
  };
}

/**
 * Normalisasi seluruh set soal: isi `level` yang kosong dengan hasil inferensi
 * dan set `levelSource` agar UI bisa menandai level yang "tebakan".
 * Mengembalikan objek baru (tidak memutasi input).
 */
export function normalizeSoalLevels(soalList) {
  if (!Array.isArray(soalList)) return [];
  return soalList.map((soal, index) => {
    const inferred = inferCognitiveLevel(soal);
    const isBlankOrRange = !hasSpecificLevel(soal?.level);
    return {
      ...soal,
      level: inferred.level,
      levelSource: isBlankOrRange ? inferred.source : 'explicit',
      levelConfidence: inferred.confidence,
      levelAmbiguous: inferred.ambiguous,
      nomor: soal?.nomor ?? index + 1,
    };
  });
}
/** Pola pemisah range: -, –, —, atau "s.d." */
const RANGE_SEP = '[-–—s.d.]';

/** True bila teks level berupa rentang, mis. "C1-C6" atau "C1 s.d. C4". */
export function isRangeValue(value) {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  if (!raw) return false;
  const rangeEnd = new RegExp(`${RANGE_SEP}{1,2}\\s*c?\\d\\s*$`, 'i');
  const rangeStart = new RegExp(`^c?\\d\\s*${RANGE_SEP}`, 'i');
  return rangeEnd.test(raw) || rangeStart.test(raw);
}

/** True bila field level sudah berisi satu level spesifik (bukan rentang/kosong). */
export function hasSpecificLevel(value) {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  if (!raw) return false;
  if (isRangeValue(raw)) return false;
  return normalizeLevel(raw) !== null;
}

/** Distribusi level sebagai `{ C1: n, ... }`. */
export function levelDistribution(soalList) {
  const dist = Object.fromEntries(COGNITIVE_LEVELS.map((c) => [c, 0]));
  if (!Array.isArray(soalList)) return dist;
  for (const soal of soalList) {
    const code = normalizeLevel(soal?.level);
    if (code) dist[code] += 1;
  }
  return dist;
}

/** Ringkasan singkat distribusi untuk ditampilkan di preview/laporan. */
export function summarizeLevels(soalList) {
  const dist = levelDistribution(soalList);
  const total = soalList?.length ?? 0;
  const high = HIGH_ORDER_LEVELS.reduce((sum, c) => sum + dist[c], 0);
  const inferredCount = Array.isArray(soalList)
    ? soalList.filter((s) => s?.levelSource === 'inferred' || s?.levelSource === 'fallback').length
    : 0;
  return {
    total,
    distribution: dist,
    highOrderCount: high,
    highOrderRatio: total ? high / total : 0,
    inferredCount,
    /** Dominan level, atau null bila kosong. */
    dominant:
      COGNITIVE_LEVELS.find((c) => dist[c] === Math.max(...COGNITIVE_LEVELS.map((x) => dist[x]))) ??
      null,
  };
}

/** Label badge HTML aman untuk sebuah level. */
export function levelBadgeHtml(code, { inferred = false } = {}) {
  const normalized = normalizeLevel(code);
  if (!normalized) return '';
  const def = LEVEL_DEFINITIONS[normalized];
  const title = `${def.code} — ${def.nama} (${def.bloom})`;
  const cls = inferred ? 'cognitive-badge inferred' : 'cognitive-badge';
  return `<span class="${cls}" data-level="${normalized}" title="${title}">${normalized} ${def.nama}</span>`;
}
