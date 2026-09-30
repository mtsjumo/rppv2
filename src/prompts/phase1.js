/**
 * Prompt builder untuk sub-phase Phase 1 (a–e).
 *
 * Dipisah per sub-phase agar mudah dibaca & dituning tanpa menyentuh logika
 * generate. Tiap builder mengembalikan `{ systemPrompt, userPrompt }`.
 */

import { BASE_RULES, LATEX_RULE, buildContextSummary, fewshotNote } from './base.js';
import {
  FEWSHOT_DIAGNOSTIK,
  FEWSHOT_EVALUASI,
  FEWSHOT_LAMPIRAN_AKHIR,
  FEWSHOT_LKPD,
  FEWSHOT_RPP_CORE,
} from './fewshot.js';

/** Blok identitas + CP/TP yang dipakai hampir semua sub-phase. */
function identityBlock(input) {
  return `- Madrasah: ${input.madrasah}
- Mata Pelajaran: ${input.mapel}
- Materi: ${input.materi}
- Elemen: ${input.elemen}
- Kelas: ${input.fase}`;
}

/** --- 1a: RPP Core ------------------------------------------------------- */
function buildRPPCore(input) {
  const systemPrompt =
    BASE_RULES +
    `

STRUKTUR JSON (rpp) — isi SEMUA field secara dinamis sesuai CP/TP/materi, JANGAN copy contoh:
{
  "rpp": {
    "identifikasi": {
      "pesertaDidik": "deskripsi peserta didik sesuai input CP",
      "materiPelajaran": "materi yang dipelajari",
      "dimensiProfilLulusan": ["dimensi 1 relevan materi", "dimensi 2 relevan materi"],
      "temaKurikulumCinta": ["tema cinta relevan materi", "tema cinta relevan materi"],
      "materiIntegrasiKBC": ["nilai KBC relevan materi 1", "nilai KBC relevan materi 2"]
    },
    "desainPembelajaran": {
      "capaianPembelajaran": "CP dari input",
      "lintasDisiplinIlmu": [{ "nama": "disiplin terkait", "detail": "uraian" }],
      "tujuanPembelajaran": ["TP sesuai input"],
      "topikPembelajaran": ["topik diturunkan dari CP/TP", "topik diturunkan dari CP/TP"],
      "praktekPedagogis": {
        "modelPembelajaran": "model sesuai karakter materi & TP",
        "sintaks": ["langkah sintaks 1", "langkah sintaks 2"],
        "metode": ["metode 1", "metode 2"]
      },
      "kemitraanPembelajaran": [{ "pihak": "pihak relevan", "peran": "perannya" }],
      "lingkunganPembelajaran": { "ruangFisik": "", "budayaBelajar": "", "penerapanNyata": [{ "aspek": "aspek relevan TP", "detail": "detail penerapan" }] },
      "pemanfaatanDigital": [{ "tahap": "tahap pembelajaran", "tools": ["tool digital"] }]
    },
    "diferensiasiPembelajaran": {
      "konten": "strategi diferensiasi konten berdasarkan kesiapan/minat/profil belajar",
      "proses": "strategi diferensiasi proses",
      "produk": "strategi diferensiasi produk"
    },
    "langkahPembelajaran": {
      "prinsip": ["Mindful (berkesadaran)", "Meaningful (bermakna)", "Joyful (menyenangkan)"],
      "kegiatanAwal": { "durasi": "10 menit", "langkah": ["langkah kegiatan awal relevan materi"] },
      "kegiatanInti": { "durasi": "50 menit", "tahap": [{ "nama": "Memahami", "langkah": ["langkah untuk mencapai TP"] }, { "nama": "Mengaplikasi", "langkah": ["langkah untuk mencapai TP"] }, { "nama": "Merefleksi", "langkah": ["langkah untuk mencapai TP"] }] },
      "kegiatanPenutup": { "durasi": "10 menit", "langkah": ["langkah penutup"] }
    },
    "asesmen": { "asesmenAwal": ["asesmen awal relevan"], "asesmenProses": ["asesmen proses relevan"], "asesmenAkhir": ["asesmen akhir relevan"] },
    "pengesahan": { "tempat": "", "tanggal": "" }
  }
}

ATURAN PENTING — KONSISTENSI:
1. Materi, Elemen, CP, TP, dan ATP HARUS saling berkaitan erat. Setiap bagian RPP harus mendukung pencapaian TP.
2. Dimensi Profil Pelajar Pancasila, Tema Kurikulum Cinta (Panca Cinta), dan Materi Integrasi KBC harus RELEVAN dengan ${input.materi}, ${input.elemen}, CP, dan TP. JANGAN copy-paste.
3. Topik pembelajaran, model pembelajaran, sintaks, metode, penerapan nyata, dan pemanfaatan digital HARUS diturunkan secara logis dari CP dan TP. Pilih model/sintaks yang PALING SESUAI dengan karakter materi dan tujuan pembelajaran — jangan asal pakai PBL.
4. Setiap langkah kegiatan awal, inti (Memahami→Mengaplikasi→Merefleksi), dan penutup harus DIRANCANG untuk mencapai TP. Jika tidak, RPP tidak berguna.
5. Integrasikan nilai Panca Cinta KBC dan prinsip Deep Learning (Mindful→Meaningful→Joyful) secara KONTEKSTUAL dalam setiap tahap pembelajaran, bukan tempelan.
6. Sertakan strategi Diferensiasi Pembelajaran (konten, proses, produk) yang spesifik dan dapat diterapkan sesuai materi.
7. Notasi matematika/sains mengikuti aturan NOTASI di atas: teks Unicode untuk yang sederhana, LaTeX hanya untuk pecahan, akar, sigma/integral, matriks. Aksara Arab/Jawa tulis langsung.
8. Kegiatan inti harus berisi pertanyaan pemantik, contoh kasus, atau instruksi tugas yang benar-benar ditulis (bukan hanya disebutkan), lengkap dengan media/bahan yang dipakai dan produk yang dihasilkan peserta didik.

CONTOH STRUKTUR & GAYA BAHASA (acuan format, kedalaman isi, dan cara menulis langkah pembelajaran — JANGAN salin topiknya):
${FEWSHOT_RPP_CORE}
${fewshotNote(input.materi)}`;

  const userPrompt = `Generate RPP Core untuk:
- Madrasah: ${input.madrasah}
- Mata Pelajaran: ${input.mapel}
- Materi: ${input.materi}
- Elemen: ${input.elemen}
- Guru: ${input.guru}
- NUPTK Guru: ${input.nuptk || '-'}
- Kepala Madrasah: ${input.kepsek}
- NUPTK Kepala Madrasah: ${input.kepsekNuptk || '-'}
- Fase/Kelas/Semester: ${input.fase}
- Alokasi Waktu: ${input.alkok}
- Tempat/Tanggal: ${input.tempat}, ${input.tanggal}

CP: ${input.cp}

TP: ${input.tp}

${input.atp ? `ATP:\n${input.atp}` : ''}

ATURAN:
- Dimensi Profil Pelajar Pancasila, Tema Kurikulum Cinta, dan Integrasi KBC harus RELEVAN dengan ${input.materi} dan ${input.elemen}, bukan copy-paste.
- Topik, model, sintaks, metode, penerapan nyata, pemanfaatan digital HARUS diturunkan dari CP dan TP.
- ${LATEX_RULE}

Output JSON dengan struktur "rpp" saja.`;

  return { systemPrompt, userPrompt };
}

/** --- 1b: LKPD ---------------------------------------------------------- */
function buildLKPD(input, contextSummary) {
  const systemPrompt =
    BASE_RULES +
    `

Kamu sedang melanjutkan generate RPP. Sekarang buat LKPD.
Output HANYA JSON dengan struktur berikut:

{
  "lkpd": {
    "identitas": { "mataPelajaran": "", "kelasSemester": "", "materiPokok": "", "alokasiWaktu": "" },
    "tujuan": ["Tujuan LKPD"],
    "aktivitas": [{ "nama": "Aktivitas 1: sesuai materi", "deskripsi": "deskripsi aktivitas", "tugas": ["tugas 1", "tugas 2"] }, { "nama": "Aktivitas 2: Perbandingan/Penerapan", "deskripsi": "deskripsi aktivitas", "tugas": [] }],
    "tabelPerbandingan": { "kolom": ["No", "nama kolom sesuai materi", "..."], "data": [["1", "nilai kolom 1", "nilai kolom 2", "..."]] },
    "pertanyaan": [{ "nomor": 1, "pertanyaan": "", "jawaban": "" }]
  }
}

PENTING soal "tabelPerbandingan": setiap baris di "data" adalah ARRAY OF STRING (BUKAN object), urutannya HARUS sama persis dengan urutan "kolom". Jumlah kolom bebas menyesuaikan materi (tidak harus 5), minimal 5 baris data yang benar-benar relevan dengan ${input.materi}.

MUTU LKPD: tiap aktivitas memuat bahan/alat (bila ada), langkah kerja yang bisa langsung dikerjakan, dan hasil yang harus ditulis/digambar peserta didik. Bila aktivitas butuh tabel pengamatan atau tabel isian, tulis sebagai tabel Markdown di dalam "deskripsi" dengan kolom yang jelas. Pertanyaan pemahaman menuntut penalaran (mengapa/bagaimana/apa akibatnya), bukan sekadar menyebutkan definisi, dan "jawaban" memuat kunci yang benar-benar bisa dipakai guru.`;

  const userPrompt = `Buat LKPD untuk materi ${input.materi}.
${identityBlock(input)}
- CP: ${input.cp}
- TP: ${input.tp}

${LATEX_RULE}

CONTOH STRUKTUR & GAYA (acuan format & kedalaman — JANGAN salin topiknya, dan ingat "data" tabel di contoh ini array-of-array):
${FEWSHOT_LKPD}
${fewshotNote(input.materi)}
${contextSummary}
Output JSON struktur "lkpd" saja.`;

  return { systemPrompt, userPrompt };
}

/** --- 1c: Evaluasi + kunci ---------------------------------------------- */
function buildEvaluasi(input, contextSummary) {
  const systemPrompt =
    BASE_RULES +
    `

Sekarang buat soal evaluasi. Output HANYA JSON:

{
  "evaluasi": {
    "soal": [{ "nomor": 1, "pertanyaan": "", "opsi": ["A. ", "B. ", "C. ", "D. "], "kunci": "A", "level": "C1" }],
    "penskoran": "Setiap soal benar skor 10, salah 0. Nilai = skor x 10"
  }
}

Minimal 10 soal pilihan ganda dengan 4 opsi, tentang ${input.materi}.

WAJIB — TINGKAT KOGNITIF (Level C1–C6, memakai huruf "C"):
Soal WAJIB diberi field "level" yang spesifik: "C1" (mengingat), "C2" (memahami), "C3" (menerapkan), "C4" (menganalisis), "C5" (menilai), atau "C6" (mencipta). JANGAN menulis level dalam bentuk rentang seperti "C1-C6".

Komposisi yang diminta:
- Minimal 10 soal, 4 opsi setiap soal.
- MINIMAL 4 soal pada level C3 atau lebih tinggi (menerapkan, menganalisis, menilai, mencipta) — berbasis analisis, perhitungan, studi kasus, atau penerapan konsep pada situasi nyata, BUKAN sekadar hafalan.
- Minimal 2 soal pada level C4 atau lebih tinggi (menganalisis/menilai).
- Capai maksimal 40% soal di level C1–C2.
- Sebar kunci jawaban A/B/C/D secara merata, jangan menumpuk di satu huruf.
- Setiap soal harus punya tepat satu opsi yang benar dan teks opsi tidak boleh memuat jawaban (cth. "semua jawaban benar").
- Soal C3 ke atas WAJIB berbasis stimulus (kasus, data/tabel kecil, percobaan, atau situasi sehari-hari) yang ditulis lengkap di "pertanyaan", bukan pertanyaan definisi yang diberi kata "analisislah".
- Pengecoh (distraktor) harus masuk akal dan mewakili miskonsepsi umum; panjang dan gaya keempat opsi seimbang sehingga kunci tidak bisa ditebak dari bentuknya.
- Tidak ada dua soal yang menguji hal yang sama; cakup seluruh TP.`;

  const userPrompt = `Buat 10 soal evaluasi pilihan ganda tentang ${input.materi}.
${identityBlock(input)}
${LATEX_RULE}

CONTOH STRUKTUR & GAYA SOAL (acuan format & variasi level kognitif — JANGAN salin topiknya):
${FEWSHOT_EVALUASI}
${fewshotNote(input.materi)}
${contextSummary}
Output struktur "evaluasi" saja, dengan MINIMAL 10 soal, setiap soal ber-"level" spesifik (C1/C2/C3/C4/C5/C6), dan MINIMAL 4 soal berada pada level C3 atau lebih tinggi.`;

  return { systemPrompt, userPrompt };
}

/** --- 1d: Remidial + Pengayaan + Rubrik -------------------------------- */
function buildLampiranAkhir(input, contextSummary) {
  const systemPrompt =
    BASE_RULES +
    `

Sekarang buat program remidial, pengayaan, dan rubrik. Output HANYA JSON:

{
  "programRemidial": { "deskripsi": "", "langkah": ["identifikasi siswa yang belum tuntas", "berikan pembelajaran ulang dengan metode berbeda", "bimbingan individu/kelompok", "evaluasi ulang"] },
  "programPengayaan": { "deskripsi": "", "langkah": ["identifikasi siswa yang sudah tuntas", "berikan materi pengayaan", "tugas mandiri eksploratif", "presentasi hasil pengayaan"] },
  "rubrikPenilaian": {
    "diskusi": { "aspek": [{ "nama": "Berani mengemukakan pendapat", "sb": "", "b": "", "c": "", "pb": "" }, { "nama": "Kerjasama dan komunikasi", "sb": "", "b": "", "c": "", "pb": "" }, { "nama": "Keaktifan", "sb": "", "b": "", "c": "", "pb": "" }] },
    "presentasi": { "aspek": [{ "nama": "Kesesuaian dan Kelengkapan", "sb": "", "b": "", "c": "", "pb": "" }, { "nama": "Komunikatif dan Kejelasan", "sb": "", "b": "", "c": "", "pb": "" }, { "nama": "Percaya Diri", "sb": "", "b": "", "c": "", "pb": "" }] }
  }
}

Rubrik 4 level: SB=Sangat Baik, B=Baik, C=Cukup, PB=Perlu Bimbingan. Setiap program (remidial/pengayaan) MINIMAL 3 langkah, setiap rubrik (diskusi/presentasi) MINIMAL 3 aspek.

MUTU: langkah remidial dan pengayaan harus spesifik untuk materi ini (sebut kegiatan, media, atau tugas yang konkret, bukan langkah umum yang cocok untuk semua mapel). Deskriptor rubrik harus terukur dan dapat diamati (mis. jumlah, ketepatan, bukti perilaku), bukan pengulangan kata sifat; keempat level harus berbeda nyata satu sama lain.`;

  const userPrompt = `Buat program remidial, pengayaan, dan rubrik penilaian untuk materi ${input.materi}.
${identityBlock(input)}
${LATEX_RULE}

CONTOH STRUKTUR & GAYA (acuan format & kedalaman — JANGAN salin topiknya):
${FEWSHOT_LAMPIRAN_AKHIR}
${fewshotNote(input.materi)}
${contextSummary}
Output struktur "programRemidial", "programPengayaan", dan "rubrikPenilaian".`;

  return { systemPrompt, userPrompt };
}

/** --- 1e: Tes diagnostik awal ------------------------------------------- */
function buildDiagnostik(input, contextSummary) {
  const systemPrompt =
    BASE_RULES +
    `

Sekarang buat tes diagnostik kognitif awal. Output HANYA JSON:

{
  "diagnostik": {
    "soal": [{ "nomor": 1, "pertanyaan": "", "opsi": ["A. ", "B. ", "C. ", "D. "], "kunci": "A" }],
    "rubrik": {
      "aspek": ["aspek 1", "aspek 2"],
      "interpretasi": [{ "rentangSkor": "", "kategori": "", "tindakLanjut": "" }]
    }
  }
}

Minimal 5 soal pilihan ganda dengan 4 opsi. Soal diagnostik mengukur kesiapan prasyarat, jadi boleh berada pada level C1–C2, TETAPI tetap wajib diberi field "level" yang spesifik ("C1".."C6").
Rubrik interpretasi minimal 3 tingkat (Paham Utuh, Paham Sebagian, Belum Paham).`;

  const userPrompt = `Buat tes diagnostik kognitif awal untuk materi ${input.materi}.
- Mata Pelajaran: ${input.mapel}
- Kelas: ${input.fase}
- CP: ${input.cp}

${LATEX_RULE}

CONTOH STRUKTUR & GAYA:
${FEWSHOT_DIAGNOSTIK}
${fewshotNote(input.materi)}
${contextSummary}
Output struktur "diagnostik" saja, dengan MINIMAL 5 soal dan 3 tingkat interpretasi.`;

  return { systemPrompt, userPrompt };
}

const BUILDERS = {
  a: buildRPPCore,
  b: buildLKPD,
  c: buildEvaluasi,
  d: buildLampiranAkhir,
  e: buildDiagnostik,
};

/**
 * Bangun prompt untuk sebuah sub-phase.
 * @param {string} subPhaseId 'a' | 'b' | 'c' | 'd' | 'e'
 * @param {object} input isi form
 * @param {object} [context] data Phase 1 yang sudah terkumpul
 * @returns {{systemPrompt: string, userPrompt: string}}
 */
export function buildSubPhasePrompt(subPhaseId, input, context = {}) {
  const builder = BUILDERS[subPhaseId];
  if (!builder) throw new Error(`Sub-phase tidak dikenal: ${subPhaseId}`);
  const contextSummary = buildContextSummary(context);
  return builder(input, contextSummary);
}

export { buildRPPCore, buildLKPD, buildEvaluasi, buildLampiranAkhir, buildDiagnostik };
