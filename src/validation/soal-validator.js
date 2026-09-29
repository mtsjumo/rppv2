/**
 * Validator set soal evaluasi/diagnostik.
 *
 * Melengkapi `checkCompletenessEvaluasi` yang hanya menghitung jumlah
 * soal. Modul ini memeriksa kualitas kognitif dan integritas butir:
 *
 *   - level C1–C6 ada, valid, dan bukan rentang
 *   - komposisi sesuai ambang minimum C3+ (dan ideal C4+)
 *   - kunci jawaban menunjuk opsi yang ada
 *   - opsi cukup (4 untuk PG) dan tidak kosong
 *   - tidak ada soal duplikat
 *   - distribusi kunci tidak menumpuk di satu huruf
 *   - tidak ada "giveaway" (mis. opsi "semua jawaban benar")
 *
 * Semua fungsi murni — bisa diuji tanpa DOM.
 */

import {
  HIGH_ORDER_LEVELS,
  COGNITIVE_LEVELS,
  levelDistribution,
  normalizeLevel,
  normalizeSoalLevels,
  summarizeLevels,
} from './cognitive-level.js';

export const DEFAULT_THRESHOLDS = {
  /** Minimum jumlah soal. */
  minSoal: 10,
  /** Minimum jumlah opsi per soal. */
  minOpsi: 4,
  /** Minimum jumlah soal pada level C3 atau lebih tinggi. */
  minHighOrder: 4,
  /** Minimum jumlah soal C4+ (analisis/evaluasi). Target ini bersifat anjuran. */
  minAnalysis: 2,
  /** Persentase minimum soal C3+ (0..1). */
  minHighOrderRatio: 0.4,
  /** Toleransi imbalance kunci: max share per huruf sebelum dilaporkan. */
  maxKeyShare: 0.5,
  /** Panjang minimal teks pertanyaan (karakter). */
  minStemLength: 20,
};

/** Opsi yang mencurigakan sebagai "giveaway". */
const GIVEAWAY_PATTERN =
  /(semua (jawaban|opsi|pilihan) (benar|di atas)|tidak ada (yang )?(benar|tepat)|semua di atas benar)/i;

/** Buang label "A." / "1)" dari teks opsi agar perbandingan konsisten. */
export function stripOptionLabel(text) {
  return String(text ?? '')
    .replace(/^\s*[A-Da-d][.\s)]+\s*/, '')
    .replace(/^\s*\d+[.\s)]+\s*/, '')
    .trim();
}

/** Normalisasi teks untuk deteksi duplikat. */
function canonical(text) {
  return stripOptionLabel(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validasi satu set soal.
 *
 * @param {Array} rawSoal daftar soal dari AI
 * @param {object} [options]
 * @param {object} [options.thresholds] override ambang
 * @param {'error'|'warn'} [options.level] severity issues yang dikembalikan
 * @returns {{ok: boolean, issues: Array<{severity: string, message: string}>,
 *            summary: object, soal: Array}}
 */
export function validateSoalSet(rawSoal, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
  const level = options.level || 'error';
  const issues = [];
  const add = (message, severity = level) => issues.push({ severity, message });

  const soal = normalizeSoalLevels(rawSoal);

  // --- Keberadaan & jumlah ------------------------------------------------
  if (!Array.isArray(rawSoal) || rawSoal.length === 0) {
    add('Tidak ada soal sama sekali');
    return { ok: false, issues, summary: summarizeLevels([]), soal: [] };
  }
  if (soal.length < thresholds.minSoal) {
    add(`soal hanya ${soal.length}, minimal ${thresholds.minSoal}`, 'error');
  }

  const dist = levelDistribution(soal);
  const highOrder = HIGH_ORDER_LEVELS.reduce((sum, c) => sum + dist[c], 0);
  const analysis = ['C4', 'C5', 'C6'].reduce((sum, c) => sum + dist[c], 0);

  // --- Integritas per butir ---------------------------------------------
  const seenQuestion = new Map();
  const keyCounts = { A: 0, B: 0, C: 0, D: 0 };
  let invalidLevelCount = 0;
  let inferredCount = 0;
  let ambiguousCount = 0;

  for (const s of soal) {
    const nomor = s.nomor;
    const stem = String(s.pertanyaan ?? '').trim();

    // Stem
    if (!stem) {
      add(`soal #${nomor}: pertanyaan kosong`, 'error');
    } else if (stem.length < thresholds.minStemLength) {
      add(
        `soal #${nomor}: pertanyaan terlalu pendek (${stem.length} karakter) — kurang dari ${thresholds.minStemLength}, kemungkinan konteksnya minim`,
        'warn'
      );
    }

    // Opsi
    const opsi = Array.isArray(s.opsi) ? s.opsi : [];
    if (opsi.length < thresholds.minOpsi) {
      const suffix = s.levelSource === 'explicit' ? '' : ` (level ${s.level} hasil inferensi)`;
      add(`soal #${nomor}: opsi ${opsi.length}, minimal ${thresholds.minOpsi}${suffix}`, 'error');
    }
    const opsiBersih = opsi.map(stripOptionLabel);
    if (opsiBersih.some((o) => !o)) {
      add(`soal #${nomor}: ada opsi kosong`, 'error');
    }
    if (new Set(opsiBersih.map(canonical)).size !== opsiBersih.length && opsiBersih.length > 0) {
      add(`soal #${nomor}: ada opsi duplikat`, 'error');
    }
    if (opsiBersih.some((o) => GIVEAWAY_PATTERN.test(o))) {
      add(`soal #${nomor}: opsi mengandung jawaban menggoda (giveaway) (giveaway)`, 'warn');
    }

    // Kunci
    const keyRaw = String(s.kunci ?? '').trim();
    if (!keyRaw) {
      add(`soal #${nomor}: kunci jawaban kosong`, 'error');
    } else {
      const key = keyRaw[0].toUpperCase();
      if (!/^[A-D]$/.test(key)) {
        add(`soal #${nomor}: kunci "${keyRaw}" bukan A–D`, 'error');
      } else if (keyCounts[key] !== undefined) {
        keyCounts[key] += 1;
        if (opsi.length > 0 && opsi.length < key.charCodeAt(0) - 64) {
          add(`soal #${nomor}: kunci ${key} di luar jumlah opsi (${opsi.length})`, 'error');
        }
      }
    }

    // Level
    if (normalizeLevel(s.level) === null) {
      invalidLevelCount += 1;
      add(`soal #${nomor}: level kognitif tidak valid`, 'error');
    }
    if (s.levelSource === 'inferred' || s.levelSource === 'fallback') {
      inferredCount += 1;
    }
    if (s.levelAmbiguous) {
      ambiguousCount += 1;
    }

    // Duplikat pertanyaan
    const canon = canonical(stem);
    if (canon && seenQuestion.has(canon)) {
      add(`soal #${nomor}: pertanyaan duplikat dengan soal #${seenQuestion.get(canon)}`, 'error');
    } else if (canon) {
      seenQuestion.set(canon, nomor);
    }
  }

  // --- Komposisi level ----------------------------------------------------
  if (highOrder < thresholds.minHighOrder) {
    add(
      `soal level C3+ hanya ${highOrder}, minimal ${thresholds.minHighOrder} soal berpikir tingkat tinggi`,
      'error'
    );
  }
  if (highOrder / soal.length < thresholds.minHighOrderRatio) {
    add(
      `proporsi soal C3+ hanya ${Math.round((highOrder / soal.length) * 100)}%, minimal ${Math.round(thresholds.minHighOrderRatio * 100)}%`,
      'warn'
    );
  }
  if (analysis < thresholds.minAnalysis) {
    add(
      `soal analisis/evaluasi (C4+) hanya ${analysis}, minimal ${thresholds.minAnalysis} — soal terlalu mudah untuk asesmen retensi`,
      'warn'
    );
  }

  // --- Distribusi kunci ---------------------------------------------------
  const totalKeys = Object.values(keyCounts).reduce((a, b) => a + b, 0);
  if (totalKeys > 0) {
    const maxShare = Math.max(...Object.values(keyCounts)) / totalKeys;
    if (maxShare > thresholds.maxKeyShare) {
      const worst = Object.entries(keyCounts).sort((a, b) => b[1] - a[1])[0];
      add(
        `kunci jawaban menumpuk di opsi ${worst[0]} (${Math.round(maxShare * 100)}% dari soal) — sebar kunci lebih merata`,
        'warn'
      );
    }
  }

  // --- Ringkasan ----------------------------------------------------
  const summary = {
    ...summarizeLevels(soal),
    distribution: dist,
    highOrderCount: highOrder,
    analysisCount: analysis,
    invalidLevelCount,
    inferredCount,
    ambiguousCount,
    keyDistribution: { ...keyCounts },
    thresholds,
  };

  return { ok: !issues.some((i) => i.severity === 'error'), issues, summary, soal };
}

/**
 * Ringkasan yang bisa langsung disisipkan ke prompt AI sebagai umpan balik,
 * supaya model tahu persis apa yang kurang (dipakai oleh completion retry).
 */
export function buildSoalFeedback(result) {
  const errors = result.issues.filter((i) => i.severity === 'error');
  const warns = result.issues.filter((i) => i.severity === 'warn');
  const s = result.summary;
  const lines = [];
  lines.push(
    `Distribusi level saat ini: ${COGNITIVE_LEVELS.map((c) => `${c}=${s.distribution[c]}`).join(', ')} (total ${s.total}).`
  );
  lines.push(`Soal C3+ (menerapkan/analisis/evaluasi/mencipta): ${s.highOrderCount}.`);
  lines.push(`Soal C4+ (analisis/evaluasi/mencipta): ${s.analysisCount}.`);
  if (s.ambiguousCount) {
    lines.push(
      `${s.ambiguousCount} soal level-nya ambigu dan perlu ditulis ulang agar jelas kognitifnya.`
    );
  }
  if (errors.length) {
    lines.push('MASALAH HARUS DIPERBAIKI:');
    lines.push(...errors.map((e) => `- ${e.message}`));
  }
  if (warns.length) {
    lines.push('PERBAIKAN DISARANKAN:');
    lines.push(...warns.map((w) => `- ${w.message}`));
  }
  lines.push(
    'Perbaiki dan kembalikan JSON LENGKAP dengan struktur SAMA. Pastikan setiap soal memiliki field "level" yang spesifik (C1/C2/C3/C4/C5/C6, bukan rentang) dan Minimal 4 soal berada pada level C3 atau lebih tinggi.'
  );
  return lines.join('\n');
}

/**
 * Cek khusus untuk tes diagnostik: soal prasyarat, kunci, rubrik interpretasi.
 * Tidak menuntut C3+ (diagnostik boleh C1–C2) tapi tetap cek integritas.
 */
export function validateDiagnostikSet(rawSoal, options = {}) {
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    minSoal: 5,
    minHighOrder: 0,
    minAnalysis: 0,
    minHighOrderRatio: 0,
    ...(options.thresholds || {}),
  };
  return validateSoalSet(rawSoal, { ...options, thresholds });
}
