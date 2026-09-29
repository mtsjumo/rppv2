/**
 * Ekstraksi & validasi JSON dari balasan AI.
 * Semua fungsi murni — bisa diuji tanpa DOM.
 */

/**
 * Coba parsing JSON dari teks yang mungkin dikelilingi markdown fence, penjelasan,
 * atau karakter kontrol dari pelarian LaTeX yang rusak.
 * @returns {object|null} objek hasil parse, atau null bila gagal
 */
export function extractJSON(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  // Step 1: buang markdown fence.
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  // Step 2: ambil blok { ... } pertama yang seimbang.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  // Step 3: parse langsung.
  let parsed = tryParse(cleaned);
  if (parsed) return parsed;

  // Step 4: perbaiki masalah umum.
  let repaired = cleaned
    .replace(/\\'/g, "'")
    .replace(/\\([^"\\/bfnrtu])/g, '\\$&')
    .replace(/,(\s*[}\]])/g, '$1') // trailing comma
    .replace(/([{,])\s*(\w+)\s*:/g, '$1"$2":') // key tanpa kutip
    .replace(/:\s*'([^']*)'/g, ':"$1"') // string kutip tunggal
    .replace(/:\s*'([^']*)'(\s*[},])/g, ':"$1"$2');

  parsed = tryParse(repaired);
  if (parsed) return parsed;

  // Step 5: hilangkan newline di dalam string.
  repaired = repaired.replace(/\n\s*/g, ' ');
  parsed = tryParse(repaired);
  if (parsed) return parsed;

  // Step 6: salvage — cari struktur JSON terlengkap yang closed.
  const salvaged = salvageDeepestJson(repaired);
  if (salvaged) return salvaged;

  return null;
}

/**
 * Ambil objek JSON paling dalam yang successfully balanced dari teks.
 * Berguna saat model sempat menulis objek yang tidak pernah ditutup.
 */
function salvageDeepestJson(text) {
  let depth = 0;
  let start = -1;
  let lastGoodEnd = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        lastGoodEnd = i;
        start = -1;
      }
    }
  }
  if (lastGoodEnd > 0) {
    // Coba parse setiap prefix objek terbalik dari yang terlengkap.
    for (let end = lastGoodEnd; end > 0; end--) {
      if (text[end] !== '}') continue;
      const candidate = text.slice(0, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        /* lanjut ke kandidat lebih pendek */
      }
    }
  }
  return null;
}

/**
 * Pastikan JSON punya key akar yang diharapkan untuk sebuah phase.
 * Melempar Error bila struktur fundamentally salah.
 *
 * @param {object} json
 * @param {string|number} phaseName '1a'..'1e', '2', '3'
 * @returns {object} json (mungkin dibungkus ulang)
 */
export function validatePhaseJSON(json, phaseName) {
  if (!json || typeof json !== 'object') {
    throw new Error('Response bukan JSON object');
  }
  const p = String(phaseName);

  if (p === '1a' || p === '1') {
    if (!json.rpp) json = { rpp: json };
    if (!json.rpp) throw new Error('Phase RPP Core harus memiliki struktur "rpp"');
  }
  if (p === '1b') {
    if (!json.lkpd) json = { lkpd: json };
    if (!json.lkpd) throw new Error('Phase LKPD harus memiliki struktur "lkpd"');
  }
  if (p === '1c') {
    if (!json.evaluasi) json = { evaluasi: json };
    if (!json.evaluasi) throw new Error('Phase Evaluasi harus memiliki struktur "evaluasi"');
  }
  if (p === '1d') {
    if (!json.programRemidial && !json.programPengayaan && !json.rubrikPenilaian) {
      json = {
        programRemidial: json.programRemidial || null,
        programPengayaan: json.programPengayaan || null,
        rubrikPenilaian: json.rubrikPenilaian || null,
      };
    }
  }
  if (p === '1e') {
    if (!json.diagnostik) json = { diagnostik: json };
    if (!json.diagnostik) throw new Error('Phase Diagnostik harus memiliki struktur "diagnostik"');
  }
  if (p === '2') {
    if (!json.modulAjar && !json.bahanAjar) json = { modulAjar: json };
    if (!json.modulAjar && !json.bahanAjar) {
      throw new Error('Phase 2 harus memiliki "modulAjar" atau "bahanAjar"');
    }
  }
  if (p === '3') {
    if (!json.media) json = { media: json };
    if (!json.media) throw new Error('Phase 3 harus memiliki "media"');
  }
  return json;
}

/** Pesan error yang ramah manusia untuk ditampilkan ke pengguna. */
export function friendlyError(msg) {
  const m = String(msg || '');
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(m)) {
    return 'Browser memblokir koneksi (CORS/jaringan) — untuk Poolside wajib isi Worker / Proxy URL di ⚙️ Pengaturan';
  }
  if (/poolside|laguna/i.test(m) && /404|not found|model/i.test(m)) {
    return 'Model Poolside tidak ditemukan — pastikan ID "poolside/laguna-s-2.1"';
  }
  if (/unavailable.*free|no longer free/i.test(m)) return 'Model ini sudah tidak gratis';
  if (/404|not found/i.test(m)) return 'Model tidak ditemukan, mungkin sudah tidak tersedia';
  if (/timeout|aborted|etimedout/i.test(m)) return 'Koneksi timeout, coba lagi';
  if (/api[ _-]?key|unauthorized|403|401|authentication/i.test(m)) return 'API Key tidak valid';
  if (/rate[\s_-]?limit|too many|429/i.test(m)) return 'Terlalu banyak permintaan, tunggu sebentar';
  if (/quota|insufficient credits/i.test(m)) return 'Kuota API habis';
  if (/json/i.test(m)) {
    return 'AI tidak menghasilkan format JSON yang valid — coba model lain atau generate ulang';
  }
  return m.split('.')[0] || 'Error tidak diketahui';
}
