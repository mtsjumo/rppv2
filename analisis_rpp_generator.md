# Analisis & Rekomendasi Peningkatan: AI RPP Generator

## Ringkasan Kondisi Aktual

Aplikasi ini adalah single-page HTML generator RPP berbasis AI (OpenRouter) yang menghasilkan dokumen RPP Kurikulum Merdeka + KBC (Kurikulum Berbasis Cinta) dalam 3 fase terpisah. Secara teknis sudah solid, namun ada banyak peluang peningkatan.

---

## 🔴 Masalah Kritis pada Kualitas Output (Konten RPP)

### 1. Prompt System Masih Terlalu Generik untuk Beberapa Bagian

**Kondisi saat ini:**

- Prompt untuk Modul Ajar (Phase 2) tidak mengandung few-shot example yang konkret — hanya skema JSON kosong
- Prompt Phase 3 (Media) tidak mencerminkan integrasi KBC/Deep Learning secara mendalam
- Instruksi `fewshotNote()` hanya berupa peringatan teks, bukan contoh output yang diharapkan

**Dampak:** Output Modul Ajar cenderung generik, tidak terhubung organis dengan RPP Core yang dihasilkan di Phase 1.

**Rekomendasi:**

- Tambahkan few-shot example untuk Modul Ajar (seperti `FEWSHOT_RPP_CORE`)
- Kirimkan ringkasan RPP Core ke prompt Phase 2 dan 3 secara lebih eksplisit (saat ini hanya `buildContextSummary()` yang agak minim)

---

### 2. Kurangnya Kedalaman pada Aspek Pedagogis Kurikulum Merdeka

**Kondisi saat ini:**

- Instruksi KBC hanya menyebut 5 Panca Cinta tanpa contoh integrasi kontekstual per materi
- Prompt tidak mewajibkan AI mencantumkan **diferensiasi pembelajaran** (salah satu inti Kurikulum Merdeka)
- Tidak ada prompt untuk **profil peserta didik yang beragam** (konten, proses, produk)

**Rekomendasi:**

```
Tambahkan ke system prompt:
- Wajib sertakan strategi diferensiasi: konten (apa yang dipelajari),
  proses (bagaimana belajar), produk (bagaimana menunjukkan pemahaman)
- Integrasi nilai KBC harus disebutkan per langkah (bukan hanya di Identifikasi)
```

---

### 3. Soal Evaluasi Level Kognitif Kurang Tervalidasi

**Kondisi saat ini:**

- `checkCompletenessEvaluasi()` hanya memeriksa jumlah soal ≥ 10 dan opsi = 4
- Tidak ada verifikasi apakah minimal 3 soal benar-benar C3-C4 (analisis/penerapan)
- Prompt minta "MINIMAL 3 soal C3-C4" tapi tidak ada mekanisme validasi

**Rekomendasi:**

- Tambahkan field `level` (C1-C6) pada setiap soal di schema JSON
- Validasi di `checkCompletenessEvaluasi()` bahwa setidaknya 30% soal adalah C3+

---

### 4. LKPD Tidak Memiliki Instruksi Guru (Petunjuk Penggunaan)

**Kondisi saat ini:**

- LKPD hanya memiliki: identitas, tujuan, aktivitas, tabel, pertanyaan
- Tidak ada **Petunjuk untuk Guru** (langkah penggunaan LKPD di kelas)
- Tidak ada **Penskoran LKPD** yang terstruktur (hanya disebutkan di schema contoh, tidak di prompt)

**Rekomendasi:**

```json
Tambahkan ke schema LKPD:
"petunjukGuru": "...",
"penskoran": {
  "aktivitas1": "...",
  "aktivitas2": "..."
}
```

---

### 5. Program Remidial & Pengayaan Terlalu Templat

**Kondisi saat ini:**

- Few-shot `FEWSHOT_LAMPIRAN_AKHIR` berisi langkah-langkah yang sangat generik
- Tidak ada keterkaitan dengan materi spesifik atau hasil evaluasi

**Rekomendasi:**

- Prompt harus mewajibkan langkah remidial yang **spesifik pada materi** (bukan "berikan pembelajaran ulang")
- Tambahkan kolom **waktu pelaksanaan** dan **target ketercapaian** pada program remidial/pengayaan

---

### 6. Modul Ajar Tidak Memiliki Lembar Refleksi Guru

**Kondisi saat ini:**

- Modul Ajar menghasilkan: bahanAjar, ringkasanMateri, glosarium, mindmap, faq, referensi
- Tidak ada **Catatan Refleksi Guru** setelah pembelajaran

**Rekomendasi:**

```json
Tambahkan ke schema modulAjar:
"refleksiGuru": {
  "pertanyaanRefleksi": ["..."],
  "catatanPerbaikan": "template kolom kosong"
}
```

---

## 🟡 Masalah Sedang pada Kualitas Dokumen

### 7. Dokumen Output Tidak Mengikuti Format Resmi Kemenag

**Kondisi saat ini:**

- Tidak ada kop surat madrasah (logo/nama institusi dalam format formal)
- Pengesahan hanya berisi 2 kolom (Kepala Madrasah & Guru), padahal format Kemenag umumnya 3 kolom termasuk Waka Kurikulum
- Tidak ada nomor dokumen/kode RPP

**Rekomendasi:**

- Tambahkan field: `nomorDokumen`, `tahunPelajaran`, `jenjanPendidikan`
- Tambahkan kolom ketiga di pengesahan untuk Waka Kurikulum

---

### 8. Preview Dokumen Tidak Ada Halaman (Pagination)

**Kondisi saat ini:**

- Preview RPP tampil sebagai satu blok HTML panjang tanpa pemisah halaman visual
- Pengguna tidak bisa melihat bagaimana dokumen akan terlihat saat dicetak

**Rekomendasi:**

- Tambahkan `page-break` visual di preview (simulasi halaman A4)
- Tampilkan nomor halaman di preview

---

### 9. Export DOCX Sangat Sederhana

**Kondisi saat ini:**

- `htmlToDocx()` menggunakan parsing DOM manual yang sangat dasar
- Tabel tidak mempertahankan lebar kolom yang proporsional
- Tidak ada penanganan heading, spacing yang baik
- Bullets/numbered list dikonversi jadi paragraf biasa

**Rekomendasi:**

- Gunakan library `html-docx-js` atau perbaiki converter untuk mempertahankan struktur
- Pastikan dokumen DOCX menggunakan font Times New Roman 12pt (standar dokumen resmi)
- Tambahkan header/footer pada DOCX

---

### 10. Tidak Ada Validasi Input yang Lebih Kaya

**Kondisi saat ini:**

- Validasi hanya `required` (tidak kosong)
- Tidak ada saran/autocomplete untuk CP/TP berdasarkan mata pelajaran dan fase
- Tidak ada format validasi untuk NUPTK (harus 16 digit angka)
- Alokasi waktu bisa diisi format apa saja tanpa normalisasi

**Rekomendasi:**

- Tambahkan validasi NUPTK (16 digit numerik)
- Tambahkan helper text atau contoh untuk setiap field
- Pertimbangkan bank CP/TP per mapel-fase sebagai referensi

---

## 🟢 Masalah Minor tapi Penting pada Kualitas Dokumen

### 11. Tidak Ada Komponen "Tahun Pelajaran"

Identitas RPP seharusnya mencantumkan Tahun Pelajaran (misal: 2025/2026), namun field ini tidak ada.

### 12. Asesmen Diagnostik (Lampiran 1) Tidak Dihasilkan oleh AI

Schema `rpp-schema.json` memiliki `lampiran1_tesDiagnostik` yang lengkap, tapi prompt ke AI tidak meminta soal diagnostik awal — hanya evaluasi akhir dan LKPD.

### 13. Tidak Ada Opsi "Regenerate Bagian Tertentu"

Jika satu bagian RPP kurang memuaskan, pengguna harus generate ulang seluruh fase. Tidak ada tombol "Regenerate hanya LKPD" atau "Regenerate soal evaluasi saja".

---

## 🔵 Peningkatan UI/UX

### A. Masalah Navigasi & Alur Kerja

| Masalah                                                         | Rekomendasi                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Wizard steps tidak bisa diklik langsung (hanya navigasi linear) | Izinkan jump ke step yang sudah selesai                                   |
| Settings panel tersembunyi dan butuh klik dua kali              | Tunjukkan indikator "API Key belum diisi" yang menonjol saat pertama buka |
| Tidak ada autosave form input                                   | Simpan input form ke `localStorage` secara otomatis                       |
| Reset tanpa konfirmasi yang kontekstual                         | Tampilkan modal konfirmasi yang lebih jelas                               |

---

### B. Masalah Visual & Estetika

| Masalah                                                | Rekomendasi                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| UI sangat datar dan minimal — tidak "wow"              | Tambahkan glassmorphism cards, gradient latar, animasi masuk |
| Header terlalu sederhana                               | Header dengan branding lebih kuat, animasi teks, badge versi |
| Color scheme terlalu monoton (pink)                    | Tambahkan variasi warna per phase (pink→blue→green→purple)   |
| Font tidak ekspresif                                   | Gunakan Google Fonts (misalnya Inter atau Plus Jakarta Sans) |
| Tombol-tombol tidak memiliki visual feedback yang baik | Tambahkan ripple effect, loading state per tombol            |
| Tidak ada dark mode                                    | Tambahkan toggle dark/light mode                             |

---

### C. Masalah Feedback & Informasi

| Masalah                                  | Rekomendasi                                             |
| ---------------------------------------- | ------------------------------------------------------- |
| Progress bar hanya di Phase 1            | Tambahkan indikator progress untuk Phase 2 dan 3        |
| Toast hanya teks, tidak menunjukkan aksi | Tambahkan tombol "Coba Lagi" di toast error             |
| Loading overlay menutupi seluruh layar   | Ganti dengan skeleton loading atau per-section loading  |
| Tidak ada estimasi waktu                 | Tampilkan estimasi waktu generate berdasarkan sub-phase |
| Tidak ada history generate               | Simpan hasil generate sebelumnya di localStorage        |

---

### D. Masalah Preview Dokumen

| Masalah                                    | Rekomendasi                                                      |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Preview hanya satu panel tanpa tab         | Tambahkan tab per lampiran (RPP Core / LKPD / Evaluasi / Rubrik) |
| Tidak bisa edit hasil generate             | Tambahkan mode edit inline pada preview                          |
| Preview tidak responsif terhadap ukuran A4 | Tampilkan preview dalam frame A4 virtual                         |
| Tidak ada zoom in/out preview              | Tambahkan kontrol zoom untuk preview dokumen                     |

---

### E. Fitur yang Hilang tapi Penting

| Fitur                       | Deskripsi                                                    |
| --------------------------- | ------------------------------------------------------------ |
| **Import/Export Settings**  | Ekspor konfigurasi (API key, model, preferensi) ke file JSON |
| **Template Mata Pelajaran** | Pilih mata pelajaran → auto-isi CP/TP dari bank data         |
| **Preview cetak**           | Mode preview khusus print sebelum PDF                        |
| **Share URL**               | Generate link shareable dari hasil RPP                       |
| **Versi dokumen**           | Track perubahan/revisi RPP                                   |
| **Tooltip & onboarding**    | Panduan singkat untuk pengguna baru                          |

---

## Prioritas Implementasi

### 🔴 Urgent (Kualitas Output)

1. Tambahkan few-shot example untuk Modul Ajar
2. Tambahkan field soal diagnostik (tes awal) ke Phase 1
3. Tambahkan field Tahun Pelajaran ke form
4. Tambahkan validasi NUPTK (16 digit)
5. Tambahkan opsi "Regenerate bagian tertentu"

### 🟡 Penting (Dokumen & UX)

6. Tambahkan tab preview per lampiran di Phase 1
7. Perbaiki export DOCX agar lebih akurat
8. Autosave form input ke localStorage
9. Progress bar untuk Phase 2 dan 3
10. Indikator "API Key belum diisi" yang menonjol

### 🟢 Peningkatan (Estetika & Fitur)

11. Redesign UI dengan glassmorphism, gradient, animasi
12. Google Fonts (Inter/Plus Jakarta Sans)
13. Dark mode toggle
14. Template mata pelajaran dengan bank CP/TP
15. Preview dalam frame A4 virtual
