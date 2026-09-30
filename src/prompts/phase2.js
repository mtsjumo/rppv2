/**
 * Prompt builder untuk Phase 2 (Modul Ajar).
 */

import {
  CONTENT_QUALITY_RULES,
  LATEX_RULE,
  NOTATION_RULES,
  buildContextSummary,
  fewshotNote,
} from './base.js';
import { FEWSHOT_MODUL_AJAR } from './fewshot.js';

const SYSTEM_PROMPT = `Kamu adalah AI pembuat Modul Ajar Kurikulum Merdeka untuk MTs/SMP Indonesia. Output HANYA JSON valid, tidak ada teks lain.

STRUKTUR JSON:
{
  "modulAjar": {
    "bahanAjar": {
      "pengertian": "paragraf panjang tentang materi",
      "subBab": [{ "judul": "", "konten": "", "contoh": "", "gambar": "" }]
    },
    "ringkasanMateri": [{ "konsep": "", "definisi": "", "contoh": "" }],
    "glosarium": [{ "istilah": "", "definisi": "" }],
    "mindmap": { "topik": "", "cabang": [{ "nama": "", "rincian": [] }] },
    "faq": [{ "pertanyaan": "", "jawaban": "" }],
    "referensi": [{ "sumber": "", "tautan": "" }],
    "refleksiGuru": {
      "pertanyaanRefleksi": ["pertanyaan refleksi 1", "pertanyaan refleksi 2", "pertanyaan refleksi 3"],
      "hal_yang_berhasil": "",
      "hal_yang_perlu_diperbaiki": ""
    }
  }
}

ATURAN:
1. Bahasa Indonesia baku (EYD), formal-akademik
2. Bahan ajar MENDALAM dan KOMPREHENSIF sesuai materi pembelajaran
3. Sub-bab minimal 3, mencakup semua aspek materi, dan setiap sub-bab WAJIB punya isi "konten" yang tidak kosong
4. Ringkasan materi minimal 3 konsep
5. Glosarium minimal 8 istilah penting
6. FAQ minimal 3 pertanyaan antisipasi siswa
7. Mindmap dengan minimal 3 cabang utama
8. Referensi minimal 3 sumber
9. Sertakan bagian Refleksi Guru untuk evaluasi pembelajaran
10. Setiap sub-bab memuat contoh yang konkret dan dapat diverifikasi (angka, kasus, atau fenomena nyata), bukan contoh umum. Glosarium dan FAQ khusus untuk materi ini.
11. Selalu konsisten dengan CP, TP, dan topik yang sudah ditetapkan pada RPP inti.

${CONTENT_QUALITY_RULES}

${NOTATION_RULES}`;

/**
 * @param {object} input isi form
 * @param {object} [rppData] hasil Phase 1
 * @returns {{systemPrompt: string, userPrompt: string}}
 */
export function buildModulAjarPrompt(input, rppData = {}) {
  const desain = rppData.rpp?.desainPembelajaran || rppData.desainPembelajaran || {};
  const contextSummary = buildContextSummary(rppData);

  const userPrompt = `Buat Modul Ajar untuk:
- Madrasah: ${input.madrasah}
- Mata Pelajaran: ${input.mapel}
- Materi: ${input.materi}
- Elemen: ${input.elemen}
- Fase/Kelas: ${input.fase}
- CP: ${desain.capaianPembelajaran || input.cp}
- TP: ${(desain.tujuanPembelajaran || [input.tp]).join('; ')}
- Topik: ${(desain.topikPembelajaran || []).join('; ')}

${LATEX_RULE}

CONTOH NOTASI (berlaku di SEMUA field teks: pengertian, konten sub-bab, contoh, definisi, jawaban FAQ):
- Rumus struktural WAJIB LaTeX: \\(\\frac{1}{2}\\), \\[E = \\frac{1}{2} m v^{2}\\], \\(\\sqrt{a^{2} + b^{2}}\\).
- Cukup teks biasa: m², cm³, H₂O, H₂SO₄, CO₂, 2H₂ + O₂ → 2H₂O, 25 °C, 3 × 10⁸ m/s.
- Salah: membungkus kata atau kalimat biasa dengan LaTeX, atau menulis pecahan bertingkat sebagai teks "1/2 m v^2".
- Di dalam JSON, backslash ditulis GANDA agar valid, mis. "rumus": "\\\\frac{1}{2}".

CONTOH STRUKTUR (JANGAN salin isinya, gunakan sebagai panduan format dan kedalaman):
${FEWSHOT_MODUL_AJAR}
${fewshotNote(input.materi)}
${contextSummary}

Output JSON sesuai struktur yang ditentukan.`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}
