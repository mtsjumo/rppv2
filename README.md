# AI RPP Generator

**Generator RPP, Modul Ajar, dan Media Pembelajaran berbasis AI**  
Kurikulum Merdeka + KBC (Kurikulum Berbasis Cinta) dengan Deep Learning

Aplikasi web statis. Tanpa backend, tanpa server. Semua pemrosesan berjalan di
browser; satu-satunya panggilan keluar adalah ke API AI.

## Fitur

- **3-Phase Generation**: RPP + Lampiran → Modul Ajar → Media Pembelajaran
- **Validasi kognitif C3–C4**: level soal dinormalisasi, soal rentang di-inferensi
  dari stem, dan komposisi minimal C3+/C4+ diperiksa sebelum hasil dipakai
- **Checkpoint & resume**: progress tiap sub-phase tersimpan; tab yang tertutup
  atau generate yang gagal bisa dilanjutkan tanpa mengulang dari nol
- **Batal & regenerate**: batalkan proses kapan saja, regenerate per bagian
- **Autosave form**: isian form disimpan dan dipulihkan saat reload
- **Export 3 format**: PDF, DOCX, dan satu file HTML mandiri
- **Anti-klik-ganda (busy lock)**: tidak ada dua proses generate bersamaan
- **Generate lebih cepat**: setelah RPP Core selesai, LKPD, Evaluasi, Remidial/Rubrik,
  dan Diagnostik dibuat paralel (atur `SUBPHASE_CONCURRENCY` di `src/config.js`;
  isi `1` untuk kembali berurutan bila provider sering menjawab 429)
- **Progres yang terlihat**: status per bagian, jumlah karakter yang sedang ditulis
  model (streaming), waktu berjalan, dan pratinjau yang muncul bertahap
- **Batal yang sungguhan**: tombol Batalkan menghentikan permintaan yang sedang jalan
- **Rumus LaTeX** dikonversi menjadi gambar (CodeCogs) saat render
- **Zero-config hosting**: build menghasilkan satu `dist/` yang bisa langsung
  di-upload ke GitHub Pages maupun dibuka lewat `file://`

## Menjalankan secara lokal

```bash
npm install
npm run dev      # server pengembangan Vite, hot reload
```

Untuk menghasilkan situs statis:

```bash
npm run build    # output ke dist/
npm run preview  # cek hasil build di http://localhost:4173
```

### Script yang tersedia

| Script            | Kegunaan                                |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Server dev Vite dengan HMR              |
| `npm run build`   | Build produksi ke `dist/`               |
| `npm run preview` | Melayani `dist/` seperti hosting statis |
| `npm run lint`    | ESLint                                  |
| `npm run format`  | Prettier (tulis ulang)                  |
| `npm test`        | Build lalu jalankan seluruh test        |
| `npm run check`   | Lint + test                             |

> `npm test` menjalankan build lebih dulu karena smoke test memuat bundle
> hasil build ke dalam jsdom.

## Dapatkan API Key

1. Buka [openrouter.ai/keys](https://openrouter.ai/keys)
2. Daftar/login (gratis)
3. Buat API Key → klik **Create Key**
4. Salin key (format: `sk-or-v1-...`)

## Cara memakai aplikasi

1. Buka aplikasi → klik **Pengaturan**
2. Masukkan API Key, pilih model AI, lalu **Test API** (cek status)
3. Isi form Identitas + CP + TP + ATP
4. Klik **Generate RPP + Lampiran**
5. Tunggu; progress tersimpan per bagian sehingga bisa diinterupsi
6. Unduh PDF / DOCX / HTML
7. Lanjut ke **Modul Ajar** → **Media Pembelajaran**

## Deploy ke GitHub Pages

Workflow `.github/workflows/pages.yml` sudah menangani build dan deploy:

```bash
git push origin main
```

Alurnya: `npm ci` → lint → test → `npm run build` → upload `dist/` → deploy.
Aktifkan Pages dengan source **GitHub Actions** di Settings → Pages.

Deploy manual juga bisa: `npm run build` lalu upload isi `dist/` ke branch
`gh-pages`.

Semua path di build bersifat relatif (`base: './'`), jadi aplikasi tetap jalan
di sub-path seperti `https://[user].github.io/rpp-generator/`.

### Membuka hasil build tanpa server

Hasil build sengaja dibuat sebagai **IIFE**, bukan ES module, dan tag
`<script>`-nya tanpa `type="module"`. Alasannya: browser memblokir module script
di origin `file://` (aturan CORS), sedangkan project ini tidak menyediakan
server. Jadi `dist/index.html` bisa langsung dibuka dengan double-click.

## Struktur project

```
index.html                 # shell UI (tanpa JS inline)
vite.config.js             # bundling; plugin mengubah tag script jadi klasik
src/
  main.js                  # bootstrap, delegasi aksi, pemulihan sesi
  config.js                # konstanta bersama (sub-phase, token limit, ambang)
  core/                    # DOM, store, storage, event bus, busy lock
  services/                # klien AI, retry/fallback, ekstraksi JSON, LaTeX
  validation/              # taksonomi C1–C6, validator soal, kelengkapan
  prompts/                 # pembangun prompt + few-shot
  recovery/                # checkpoint & job runner yang bisa dilanjutkan
  render/                  # renderer HTML tiap phase
  export/                  # PDF, DOCX, HTML gabungan
  ui/                      # form, wizard, loading, toast, pengaturan, banner
  styles/                  # CSS aplikasi & CSS dokumen cetak
tests/                     # unit test + smoke test jsdom
```

## Model AI yang didukung

| Model                 | Kecepatan | Kualitas | Status           |
| --------------------- | --------- | -------- | ---------------- |
| Nemotron-3-Super 120B | cepat     | baik     | Free             |
| DeepSeek Chat         | sedang    | baik     | Free             |
| Gemini 1.5 Flash      | cepat     | cukup    | Free             |
| Llama 3.1 70B         | lambat    | baik     | Free             |
| Kustom (isi sendiri)  | ?         | ?        | Tergantung model |

## Output tiap phase

```
Phase 1: RPP + Lampiran
├── RPP Utama (Identitas, Desain, Langkah, Asesmen)
├── LKPD (Lembar Kerja Peserta Didik)
├── Soal Evaluasi + Kunci Jawaban  (+ validasi C3–C4)
├── Program Remidial & Pengayaan
├── Rubrik Penilaian
└── Halaman Pengesahan

Phase 2: Modul Ajar
├── Bahan Ajar Mendalam, Ringkasan Materi
├── Peta Konsep, FAQ, Glosarium, Referensi

Phase 3: Media Pembelajaran
├── Slide Presentasi + Catatan Pembicara
├── Video Script, Infografis, Kuis Interaktif, Poster Edukatif
```

## Keamanan & Privasi

- API Key disimpan di **localStorage browser** (hanya di device Anda)
- Semua data diproses **client-side**; tidak ada backend milik project ini
- Data yang dikirim ke pihak ketiga hanya ke API AI yang Anda pilih
- **Rekomendasi**: gunakan browser pribadi, jangan share device

### Batasan yang diketahui

- `renderCodeCogs` hanya mengenali `\[...\]`, `$$...$$`, `\(...\)`, dan `$...$`.
  LaTeX `\begin{equation}...\end{equation}` akan muncul sebagai teks mentah.
  Prompt ke AI yang menentukan delimiter yang dipakai, bukan renderer.
- Rumus bergaya `$...$` hanya dirender bila terlihat seperti matematika
  (memuat `\`, `^`, `_`, atau `=`), supaya harga seperti `$5000$` tidak salah
  jadi gambar.
- Checkpoint disimpan di `localStorage` (sekitar 5–10 MB). Hasil generate yang
  sangat besar bisa gagal disimpan; aplikasi memberi peringatan, bukan crash.

## Tech Stack

| Layer       | Library                 | Lisensi |
| ----------- | ----------------------- | ------- |
| Runtime     | Vanilla JS (ES modules) | -       |
| Bundler     | Vite                    | MIT     |
| Test        | `node:test` + jsdom     | MIT     |
| PDF Export  | html2pdf.js             | MIT     |
| DOCX Export | docx.js                 | MIT     |
| AI API      | OpenRouter              | REST    |
| Hosting     | GitHub Pages            | Gratis  |

## Lisensi

MIT — Bebas digunakan, dimodifikasi, dan disebarluaskan untuk kepentingan pendidikan.

---

_Dibuat untuk membantu guru Indonesia dalam administrasi pembelajaran._
