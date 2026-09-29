/**
 * Aturan dasar & utilitas prompt yang dipakai semua phase.
 */

/**
 * Peringatan anti-salin untuk few-shot example.
 * Contoh di prompt sengaja bertopik "Sel Hewan dan Sel Tumbuhan" sebagai
 * acuan gaya; tanpa peringatan ini model gratis cenderung menyalin topiknya.
 */
export function fewshotNote(materiAsli) {
  return `\n\nPERINGATAN: Contoh di atas topiknya adalah "Sel Hewan dan Sel Tumbuhan" HANYA untuk referensi gaya bahasa, kedalaman, dan struktur JSON. JANGAN salin topik/istilah biologinya. Materi yang HARUS kamu buat adalah "${materiAsli}" — sesuaikan seluruh isi sepenuhnya dengan materi ini.`;
}

/**
 * Ringkasan konteks dari RPP inti supaya Phase 2/3 konsisten.
 * Tanpa ini, modul ajar & media bisa berbeda topik dengan RPP.
 */
export function buildContextSummary(context) {
  const rpp = context?.rpp;
  if (!rpp) return '';

  const desain = rpp.desainPembelajaran || {};
  const langkah = rpp.langkahPembelajaran || {};
  const topik = (desain.topikPembelajaran || []).join('; ');
  const tp = (desain.tujuanPembelajaran || []).join('; ');
  const model = desain.praktekPedagogis?.modelPembelajaran || '';
  const tahapNama = (langkah.kegiatanInti?.tahap || []).map((t) => t.nama).join(', ');
  if (!topik && !tp && !model) return '';

  return `\n\nKONTEKS DARI RPP INTI YANG SUDAH DIBUAT SEBELUMNYA (WAJIB konsisten dengan ini, jangan bertentangan):\n- Topik Pembelajaran: ${topik}\n- Tujuan Pembelajaran: ${tp}\n- Model Pembelajaran: ${model}\n- Tahapan Kegiatan Inti: ${tahapNama}`;
}

/** System prompt dasar untuk seluruh generator RPP. */
export const BASE_RULES = `Kamu adalah AI generator RPP Kurikulum Merdeka untuk MTs/SMP di Indonesia. Output HANYA JSON valid, tanpa teks lain. Bahasa Indonesia baku (EYD), formal.

KURIKULUM BERBASIS CINTA (KBC) — Kemenag:
KBC adalah jiwa implementasi Kurikulum Nasional di madrasah. Bukan mengganti, tetapi menginsersikan nilai cinta ke seluruh proses pembelajaran. Lima nilai Panca Cinta:
1. Cinta kepada Tuhan Yang Maha Esa — keimanan, spiritualitas, syukur
2. Cinta kepada Diri dan Sesama — empati, kasih sayang, tolong-menolong
3. Cinta kepada Ilmu Pengetahuan — semangat belajar, literasi, inovasi
4. Cinta kepada Lingkungan — ekoteologi, menjaga alam, keberlanjutan
5. Cinta kepada Bangsa dan Negeri — nasionalisme, toleransi, moderasi beragama

DEEP LEARNING — Kemendikdasmen:
Tiga pilar Pembelajaran Mendalam (PM):
- Mindful (Berkesadaran): siswa hadir penuh, termotivasi intrinsik, sadar tujuan belajar, mampu meregulasi diri
- Meaningful (Bermakna): pembelajaran terhubung dengan kehidupan nyata, siswa merasakan manfaat dan relevansi
- Joyful (Menggembirakan): lingkungan aman secara psikologis,santis, kegembiraan dari pertumbuhan autentik

Integrasi: KBC menyediakan jiwa dan nilai, Deep Learning menyediakan pendekatan pedagogis. Keduanya saling melengkapi dalam setiap langkah pembelajaran.

Ekspresi matematika tulis \\(...\\) (inline) atau \\[...\\] (display) LaTeX.
Aksara Arab dan Jawa tulis langsung dalam teks aslinya, JANGAN pakai transliterasi.`;

/** Aturan notasi saintifik yang dipakai berulang di beberapa prompt. */
export const LATEX_RULE =
  'Ekspresi matematika pakai \\(...\\) (inline) atau \\[...\\] (display) LaTeX. Aksara Arab/Jawa tulis langsung.';
