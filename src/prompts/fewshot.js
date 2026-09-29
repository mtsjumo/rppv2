/**
 * Few-shot examples: acuan gaya bahasa, kedalaman isi, dan struktur JSON.
 *
 * Ini kunci kualitas output, terutama untuk model gratis yang butuh contoh
 * konkret, bukan cuma skema kosong. Topik contoh (Sel Hewan dan Sel Tumbuhan)
 * sengaja dipakai seragam; fewshotNote() memberi tahu model supaya jangan menyalin topiknya.
 *
 * Ekstrak dari index.legacy-monolith.html.bak tanpa modifikasi isi.
 */

export const FEWSHOT_RPP_CORE = `{
  "rpp": {
    "identifikasi": {
      "pesertaDidik": "Peserta didik umumnya sudah mengetahui dasar materi terkait namun perlu bimbingan lebih lanjut. Kesiapan belajar cukup baik, terutama bila materi disajikan lewat pengamatan langsung, diskusi kelompok, dan media visual yang menarik.",
      "materiPelajaran": "[Materi Utama]",
      "dimensiProfilLulusan": ["Keimanan dan ketakwaan terhadap Tuhan Yang Maha Esa", "Penalaran Kritis", "Kolaborasi", "Kreativitas", "Komunikasi"],
      "temaKurikulumCinta": ["Cinta Allah dan Rasul-Nya", "Cinta kepada diri sendiri dan sesama"],
      "materiIntegrasiKBC": ["Bersyukur atas ilmu pengetahuan sebagai rahmat dari Allah SWT.", "Membiasakan diri bersikap teliti, jujur, dan bertanggung jawab."]
    },
    "desainPembelajaran": {
      "capaianPembelajaran": "Pada akhir fase ini, peserta didik mampu memahami konsep utama dan mengaplikasikannya dalam penyelesaian masalah kontekstual.",
      "lintasDisiplinIlmu": [{ "nama": "Pendidikan Agama Islam", "detail": "syukur terhadap keteraturan ciptaan Allah" }],
      "tujuanPembelajaran": ["Peserta didik mampu mendeskripsikan konsep utama materi.", "Peserta didik mampu menganalisis penerapan konsep dalam permasalahan."],
      "topikPembelajaran": ["Konsep Dasar Materi", "Penerapan dan Analisis Materi"],
      "praktekPedagogis": { "modelPembelajaran": "Problem Based Learning", "sintaks": ["Orientasi murid pada masalah.", "Mengorganisasi murid untuk belajar.", "Membimbing penyelidikan individu/kelompok.", "Mengembangkan dan menyajikan hasil.", "Menganalisis dan mengevaluasi proses pemecahan masalah."], "metode": ["Diskusi", "Tanya jawab", "Penugasan", "Presentasi"] },
      "kemitraanPembelajaran": [{ "pihak": "Orang tua/Wali murid", "peran": "Mendorong peserta didik memahami materi terkait di rumah." }],
      "lingkunganPembelajaran": { "ruangFisik": "Ruang kelas fleksibel dan kolaboratif.", "budayaBelajar": "Budaya berpikir kritis, kolaboratif, dan reflektif.", "penerapanNyata": [{ "aspek": "Penerapan praktis", "detail": "Identifikasi masalah kontekstual dalam kehidupan sehari-hari." }] },
      "pemanfaatanDigital": [{ "tahap": "Pelaksanaan", "tools": ["Video pembelajaran", "Power Point"] }]
    },
    "diferensiasiPembelajaran": {
      "konten": "Materi disajikan dalam berbagai format (teks, video, infografis) sesuai gaya belajar peserta didik.",
      "proses": "Peserta didik dapat memilih untuk bekerja secara individu maupun kelompok berdasarkan kesiapan belajar.",
      "produk": "Hasil penyelesaian masalah dapat disajikan berupa laporan tertulis, mind map, atau presentasi lisan."
    },
    "langkahPembelajaran": {
      "prinsip": ["Mindful (berkesadaran)", "Meaningful (bermakna)", "Joyful (menyenangkan)"],
      "kegiatanAwal": { "durasi": "10 menit", "langkah": ["Guru menyapa dan mengajak berdoa (mindful)", "Guru mengajukan pertanyaan pemantik terkait materi", "Guru menyampaikan tujuan pembelajaran dan manfaatnya dalam kehidupan (meaningful)"] },
      "kegiatanInti": { "durasi": "50 menit", "tahap": [
        { "nama": "Memahami", "langkah": ["Guru mengajukan masalah kontekstual terkait materi (Sintaks 1)", "Peserta didik menyimak penjelasan/video pembelajaran", "Diskusi kelas untuk menggali pemahaman awal"] },
        { "nama": "Mengaplikasi", "langkah": ["Peserta didik berkelompok mengerjakan LKPD dengan bimbingan guru (Kolaborasi, Kreativitas)", "Guru membimbing penyelidikan tiap kelompok"] },
        { "nama": "Merefleksi", "langkah": ["Presentasi hasil diskusi dan umpan balik (Komunikasi)", "Peserta didik menyimpulkan materi, guru memberi penguatan", "Refleksi: apa yang dipelajari, bagaimana perasaan, bagian mana yang masih sulit"] }
      ]},
      "kegiatanPenutup": { "durasi": "10 menit", "langkah": ["Guru memberi penguatan pembelajaran", "Guru menyampaikan rencana topik selanjutnya", "Doa penutup"] }
    },
    "asesmen": { "asesmenAwal": ["Asesmen diagnostik awal"], "asesmenProses": ["Diskusi kelompok", "Presentasi", "LKPD"], "asesmenAkhir": ["Soal evaluasi individu (tes tertulis)"] },
    "pengesahan": { "tempat": "", "tanggal": "" }
  }
}`;

export const FEWSHOT_LKPD = `{
  "lkpd": {
    "identitas": { "mataPelajaran": "[Mata Pelajaran]", "kelasSemester": "[Kelas / Semester]", "materiPokok": "[Materi Utama]", "alokasiWaktu": "2 x 40 menit" },
    "tujuan": ["Mengidentifikasi konsep dasar materi.", "Menyajikan hasil analisis/diskusi kelompok."],
    "aktivitas": [
      { "nama": "Aktivitas 1: Memahami Konsep", "deskripsi": "Amati fenomena/soal kontekstual yang disajikan.", "tugas": ["Identifikasi unsur-unsur penting.", "Lengkapi rincian yang diminta."] },
      { "nama": "Aktivitas 2: Perbandingan dan Penerapan", "deskripsi": "Lengkapi tabel perbandingan berikut berdasarkan hasil diskusi.", "tugas": [] }
    ],
    "tabelPerbandingan": { "kolom": ["No", "Aspek yang Dibandingkan", "Kategori A", "Kategori B", "Keterangan"], "data": [
      ["1", "Aspek 1", "Karakteristik A1", "Karakteristik B1", "Penjelasan perbandingan aspek 1."],
      ["2", "Aspek 2", "Karakteristik A2", "Karakteristik B2", "Penjelasan perbandingan aspek 2."],
      ["3", "Aspek 3", "Karakteristik A3", "Karakteristik B3", "Penjelasan perbandingan aspek 3."]
    ]},
    "pertanyaan": [
      { "nomor": 1, "pertanyaan": "Apa perbedaan/hubungan utama dari aspek yang dipelajari?", "jawaban": "Penjelasan mendasar berdasarkan hasil diskusi." },
      { "nomor": 2, "pertanyaan": "Bagaimana penerapan konsep ini dalam situasi kehidupan nyata?", "jawaban": "Kaitkan dengan fungsi dan manfaatnya." }
    ]
  }
}`;

export const FEWSHOT_EVALUASI = `{
  "evaluasi": {
    "soal": [
      { "nomor": 1, "pertanyaan": "Pertanyaan konsep dasar (mengingat/memahami) terkait materi...", "opsi": ["A. Pilihan A", "B. Pilihan B", "C. Pilihan C (jawaban benar)", "D. Pilihan D"], "kunci": "C", "level": "C2" },
      { "nomor": 2, "pertanyaan": "Pertanyaan berupa studi kasus/analisis singkat yang menuntut penalaran, bukan hafalan (contoh: 'Berdasarkan fenomena... kesimpulan yang tepat adalah...')", "opsi": ["A. Pilihan A", "B. Pilihan B (jawaban benar)", "C. Pilihan C", "D. Pilihan D"], "kunci": "B", "level": "C4" }
    ],
    "penskoran": "Setiap soal benar skor 10, salah 0. Nilai = jumlah skor benar x 10"
  }
}`;

export const FEWSHOT_LAMPIRAN_AKHIR = `{
  "programRemidial": { "deskripsi": "Program bagi peserta didik yang belum mencapai TP.", "langkah": ["Identifikasi peserta didik yang belum tuntas berdasarkan asesmen.", "Berikan pembelajaran ulang dengan metode/media berbeda.", "Bimbingan individu atau kelompok kecil.", "Evaluasi ulang untuk memastikan ketuntasan."] },
  "programPengayaan": { "deskripsi": "Program bagi peserta didik yang sudah mencapai TP.", "langkah": ["Identifikasi peserta didik yang sudah tuntas.", "Berikan materi pengayaan yang lebih menantang.", "Tugas mandiri eksploratif terkait materi.", "Presentasikan hasil pengayaan."] },
  "rubrikPenilaian": {
    "diskusi": { "aspek": [
      { "nama": "Berani mengemukakan pendapat", "sb": "Berani berpendapat dengan baik dan runtut", "b": "Berani berpendapat namun belum konsisten", "c": "Berani berpendapat dengan beberapa teman saja", "pb": "Perlu dimotivasi untuk berpendapat" },
      { "nama": "Kerjasama dan komunikasi", "sb": "Kerjasama dan komunikasi sangat baik", "b": "Kerjasama dan komunikasi baik namun belum konsisten", "c": "Kerjasama dengan beberapa teman", "pb": "Perlu dimotivasi untuk bekerjasama" }
    ]},
    "presentasi": { "aspek": [
      { "nama": "Kesesuaian dan Kelengkapan", "sb": "Sangat sesuai materi dan lengkap", "b": "Sesuai materi dan lengkap", "c": "Sesuai materi namun kurang lengkap", "pb": "Kurang sesuai dan kurang lengkap" }
    ]}
  }
}`;

export const FEWSHOT_MODUL_AJAR = `{
  "modulAjar": {
    "bahanAjar": {
      "pengertian": "Pengertian komprehensif mengenai materi utama.",
      "subBab": [
        { "judul": "Sub Bab 1", "konten": "Penjelasan detail sub bab 1.", "contoh": "Contoh aplikatif sub bab 1." },
        { "judul": "Sub Bab 2", "konten": "Penjelasan detail sub bab 2.", "contoh": "Contoh aplikatif sub bab 2." },
        { "judul": "Sub Bab 3", "konten": "Penjelasan detail sub bab 3.", "contoh": "Contoh aplikatif sub bab 3." }
      ]
    },
    "ringkasanMateri": [
      { "konsep": "Konsep Penting 1", "definisi": "Definisi singkat dan padat.", "contoh": "Contoh nyata." }
    ],
    "glosarium": [
      { "istilah": "Istilah", "definisi": "Definisi istilah teknis yang digunakan dalam materi." }
    ],
    "mindmap": {
      "topik": "Topik Utama",
      "cabang": [
        { "nama": "Cabang 1", "rincian": ["Sub cabang 1", "Sub cabang 2"] }
      ]
    },
    "faq": [
      { "pertanyaan": "Apa yang sering ditanyakan siswa tentang materi ini?", "jawaban": "Jawaban yang jelas dan mudah dipahami." }
    ],
    "referensi": [
      { "sumber": "Buku Paket Kemdikbud Kelas X", "tautan": "" }
    ],
    "refleksiGuru": {
      "pertanyaanRefleksi": [
        "Apakah kegiatan pembelajaran berjalan sesuai rencana?",
        "Bagian mana yang paling sulit dipahami peserta didik?",
        "Apa langkah perbaikan untuk pertemuan selanjutnya?"
      ],
      "hal_yang_berhasil": "Peserta didik antusias saat diskusi.",
      "hal_yang_perlu_diperbaiki": "Manajemen waktu saat presentasi kelompok."
    }
  }
}`;

export const FEWSHOT_DIAGNOSTIK = `{
  "diagnostik": {
    "soal": [
      { "nomor": 1, "pertanyaan": "Soal pemahaman dasar terkait materi sebelumnya.", "opsi": ["A. Opsi A", "B. Opsi B", "C. Opsi C (benar)", "D. Opsi D"], "kunci": "C" },
      { "nomor": 2, "pertanyaan": "Soal pemahaman prasyarat untuk materi yang akan diajarkan.", "opsi": ["A. Opsi A", "B. Opsi B", "C. Opsi C", "D. Opsi D (benar)"], "kunci": "D" }
    ],
    "rubrik": {
      "aspek": ["Pemahaman Prasyarat Kognitif", "Kesiapan Mengikuti Materi Baru"],
      "interpretasi": [
        { "rentangSkor": "80-100", "kategori": "Paham Utuh", "tindakLanjut": "Pembelajaran dapat dilanjutkan sesuai rencana CP." },
        { "rentangSkor": "60-79", "kategori": "Paham Sebagian", "tindakLanjut": "Berikan pendampingan tambahan pada bagian tertentu." },
        { "rentangSkor": "0-59", "kategori": "Belum Paham", "tindakLanjut": "Lakukan remedial kognitif sebelum masuk ke materi inti." }
      ]
    }
  }
}`;
