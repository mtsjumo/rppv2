/**
 * Prompt builder untuk Phase 3 (Media Pembelajaran).
 */

import { LATEX_RULE, buildContextSummary } from './base.js';

const SYSTEM_PROMPT = `Kamu adalah AI pembuat Media Pembelajaran kreatif untuk Kurikulum Merdeka. Output HANYA JSON valid.

STRUKTUR JSON:
{
  "media": {
    "slidePresentasi": [{ "slide": 1, "judul": "", "isi": "", "visual": "", "catatanPembicara": "" }],
    "videoScript": { "durasi": "", "adegan": [{ "waktu": "", "visual": "", "narasi": "", "efek": "" }] },
    "infografis": { "judul": "", "elemen": [{ "label": "", "data": "", "warna": "" }] },
    "kuisInteraktif": [{ "nomor": 1, "pertanyaan": "", "opsi": [], "kunci": "", "feedbackBenar": "", "feedbackSalah": "" }],
    "poster": { "judul": "", "konten": "", "warnaDominan": "", "gambar": "" }
  }
}

ATURAN:
1. Bahasa Indonesia baku
2. Slide presentasi minimal 10 slide dengan catatan pembicara detail
3. Video script minimal 5 adegan
4. Infografis dengan 5-7 elemen data visual
5. Kuis interaktif minimal 5 soal dengan feedback
6. Poster edukatif A3 size
7. Setiap media WAJIB konsisten dengan materi, CP, dan tujuan pembelajaran RPP.`;

/**
 * @param {object} input isi form
 * @param {object} [rppData] hasil Phase 1
 * @returns {{systemPrompt: string, userPrompt: string}}
 */
export function buildMediaPrompt(input, rppData = {}) {
  const desain = rppData.rpp?.desainPembelajaran || rppData.desainPembelajaran || {};
  const contextSummary = buildContextSummary(rppData);

  const userPrompt = `Buat Media Pembelajaran untuk:
- Madrasah: ${input.madrasah}
- Mata Pelajaran: ${input.mapel}
- Materi: ${input.materi}
- Elemen: ${input.elemen}
- Kelas: ${input.fase}
- CP: ${desain.capaianPembelajaran || input.cp}

Gunakan pendekatan Deep Learning (Mindful, Meaningful, Joyful) dan visual yang menarik.
${LATEX_RULE}
${contextSummary}

Output JSON sesuai struktur yang ditentukan.`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}
