# Session Handoff — Performa Generate & UI/UX (rpp-gen-main)

Tanggal sesi: 2026-09-29. Dokumen ini untuk agen/pengembang berikutnya.

## 1. Masalah yang dilaporkan

1. Generate RPP terasa sangat lambat, dan prosesnya tidak terlihat jelas saat menunggu.
2. UI/UX menjenuhkan dan kurang ramah pengguna.

## 2. Akar masalah yang ditemukan

| Gejala | Penyebab di kode |
| --- | --- |
| Lambat | 5 sub-phase Phase 1 dijalankan berurutan + cooldown tetap 5 dtk (`SUBPHASE_COOLDOWN_MS`), padahal sub-phase b–e hanya butuh RPP Core |
| Lambat / sering retry | Panggilan non-streaming dengan timeout total 120 dtk, sementara `max_tokens` sub-phase `1a` = 12000 (sering butuh > 120 dtk) |
| Batal terasa macet | Sinyal batal hanya dicek di antara panggilan; `fetch` yang sedang jalan tidak di-abort |
| Proses tak terlihat | Event AI (retry JSON, rate-limit, fallback model) hanya di-`emit`, tidak pernah sampai UI; overlay layar penuh hanya berisi "Mohon tunggu"; progress bar tertutup overlay |
| Peringatan "macet?" salah | Timer macet 150 dtk tidak pernah di-reset walau proses hidup |
| Fitur regenerate tak terjangkau | Bar `#phase1-regenerate` selalu disembunyikan setelah sukses |

## 3. Yang sudah dikerjakan

### Kecepatan
- `src/recovery/job-runner.js` — opsi baru `concurrency` dan `staggerMs`. Unit pertama (RPP Core) jalan sendiri, sisanya lewat pool paralel. Mode berurutan (`concurrency: 1`) tetap seperti dulu.
- `src/config.js` — `SUBPHASE_CONCURRENCY = 3`, `SUBPHASE_STAGGER_MS = 1200`, `REQUEST_HARD_TIMEOUT_MS`, `SUBPHASE_EXPECTED_CHARS`.
- `src/services/ai-provider.js` — ditulis ulang: streaming SSE (fallback otomatis ke JSON biasa bila server mengabaikan `stream`), timeout diam yang di-reset tiap potongan data, batas mutlak 480 dtk, dan abort `fetch` saat pengguna membatalkan. Timeout dilempar sebagai `Error` biasa (bisa di-retry runner), pembatalan sebagai `AbortError`.
- `src/services/ai-client.js` — wrapper `callAIProvider` (shadowing) yang meneruskan `signal` dan melaporkan state `streaming`; `rate-limited` kini membawa `seconds`.

### Keterlihatan proses
- `src/ui/progress-monitor.js` (baru) — status per bagian, catatan hidup ("Menulis… 4,2 rb karakter"), progress halus, waktu berjalan, tombol Batal, kerangka pratinjau.
- `src/ui/wizard.js` — `updateProgress` memakai `syncSteps` (node dipakai ulang, tanpa kedip) dan mendukung status `done/active/pending/failed/waiting`.
- `src/phases/phase1.js` — ditulis ulang: memakai monitor, pratinjau bertahap (`renderPartialPreview` dipanggil dari `onUnit`), status AI diteruskan per unit, regenerate bisa dibatalkan, bar regenerate tampil setelah sukses.
- `src/ui/loading.js` — overlay penuh diganti panel melayang (Phase 2/3/regenerate) dengan waktu berjalan; timer macet di-reset tiap ada kabar.
- `src/phases/phase2.js`, `phase3.js` — meneruskan `onStatus` agar status streaming tampil.

### UI/UX
- `src/styles/experience.css` (baru, dimuat setelah `app.css`, sebelum `document.css`) — stepper bergaris penghubung, bagian form bernomor, tombol/toast/kartu dirapikan, monitor progres, skeleton, panel status, bar aksi form lengket di mobile. Variabel warna lama (`--pink`, dst.) sengaja TIDAK diubah karena `document.css`/hasil cetak masih memakainya; warna baru memakai `--ux-*`. Nilai `--shadow` lama yang tidak valid ikut diperbaiki.
- `index.html` — markup panel status, kepala monitor progres, tombol "Isi data contoh".
- `src/main.js` — aksi `fill-example` (data contoh generik), impor `experience.css`.

### Test baru (lulus di container, 11/11)
- `tests/job-runner-parallel.test.js` — urutan, paralelisme, gagal-fatal, gagal-pelengkap, batal, resume.
- `tests/provider-streaming.test.js` — SSE terpotong, fallback JSON, error di tengah stream, timeout diam, pembatalan.

## 4. Belum diverifikasi (WAJIB dijalankan dulu)

Sesi ini tidak punya shell di mesin pengguna. Hanya modul inti (runner, provider, client, checkpoint) yang dijalankan di container terpisah. Belum dijalankan:

```bash
npm install
npm run format        # file baru/ubahan belum diformat Prettier
npm run check         # lint + build + seluruh test (smoke jsdom, dom-contract, hygiene, artifacts)
npm run dev           # cek visual manual
```

Titik yang paling mungkin bermasalah:
1. **Lint/format** pada `phase1.js`, `progress-monitor.js`, `ai-provider.js` (baris > 100 karakter, dll).
2. **`hygiene.test.js`** memindai `.md` dan `.js` untuk kata penanda pekerjaan-tertunda; dokumen ini sengaja menghindarinya, jaga tetap begitu.
3. **`smoke.test.js`** — memuat bundle di jsdom; periksa tidak ada error saat boot (import `experience.css` lewat Vite, `progress-monitor` mengimpor `wizard.js`).
4. **Tampilan** — belum pernah dilihat di browser: stepper, sticky monitor (`top: 68px` menebak tinggi header), panel melayang di mobile, `is-partial` banner, dan kontras.
5. **Rate limit** — `SUBPHASE_CONCURRENCY = 3` dengan model gratis OpenRouter bisa memicu HTTP 429. Retry per unit sudah ada, tetapi bila sering gagal turunkan ke `1` atau `2` di `src/config.js`.
6. **Streaming lewat worker Poolside** (`rpp.andys-riyans.workers.dev`) belum diuji; bila worker mem-buffer respons, kode otomatis jatuh ke mode JSON biasa (tanpa hitungan karakter).

## 5. Uji manual yang disarankan (dengan API key sungguhan)

1. Klik "Isi data contoh" → Generate. Catat waktu total; bandingkan dengan cabang lama (`SUBPHASE_CONCURRENCY = 1`).
2. RPP Core harus muncul sebagai pratinjau sebelum semua bagian selesai.
3. Klik Batalkan di tengah streaming: harus berhenti < 2 dtk dan progress tersimpan; banner "Lanjutkan" muncul.
4. Reload di tengah generate → banner pemulihan → Lanjutkan.
5. Paksa satu bagian gagal (mis. key salah untuk model tertentu) → status "gagal" pada bagian itu, sisanya tetap jadi.
6. Phase 2 dan 3: panel melayang menampilkan "AI sedang menulis… N karakter".

## 6. Sprint berikutnya (berurutan)

**Sprint A — Stabilkan (0,5 hari)**
- Jalankan bagian 4, perbaiki lint/format/test yang gagal.
- Kriteria selesai: `npm run check` hijau; uji manual 1–6 lulus.

**Sprint B — Kontrol kecepatan (0,5 hari)**
- Pengaturan "Kecepatan: Cepat (paralel) / Aman (berurutan)" di panel Pengaturan, disimpan di settings.
- Turunkan otomatis ke berurutan bila 429 muncul pada dua unit dalam satu run; tampilkan toast yang menjelaskannya.
- Kriteria selesai: nilai konkurensi tidak lagi hard-coded di `phase1.js`; ada test untuk logika penurunan otomatis.

**Sprint C — Phase 2 & 3 (1 hari)**
- Pecah Modul Ajar dan Media menjadi beberapa unit (mis. Bahan Ajar / Ringkasan+Peta Konsep / FAQ+Glosarium+Referensi) yang dijalankan paralel.
- Generalisasi `progress-monitor` (saat ini terikat id `#phase1-progress*`) agar dipakai semua phase; tambah kontainer progres di kartu Phase 2/3 dan perbarui `dom-contract.test.js` (yang kini menyatakan progress bar hanya ada di Phase 1).
- Kriteria selesai: tiga phase memakai monitor yang sama; waktu Phase 2/3 turun terukur.

**Sprint D — Polesan UI/UX (1–2 hari)**
- Onboarding: bila API key kosong, tampilkan banner ajakan membuka Pengaturan di Langkah 1 (bukan hanya error saat klik Generate).
- Validasi inline per field (pesan di bawah input, fokus ke field pertama yang salah) — perlu membaca `src/ui/form.js`.
- Pratinjau Phase 1: daftar isi/tab (RPP, LKPD, Evaluasi, Remidial, Diagnostik) agar dokumen panjang mudah dinavigasi; ringkas Langkah 1 (identitas) setelah generate.
- Kurangi sisa emoji pada judul kartu dan tombol export; seragamkan ikon (SVG inline).
- Pertimbangkan mode gelap dengan menjaga area dokumen tetap putih (hati-hati dengan `document.css`).
- Kriteria selesai: uji coba dengan 2–3 guru; catat titik bingung; perbaikan ditinjau di layar 360 px dan desktop.

**Sprint E — Efisiensi prompt (opsional, terukur)**
- Ukur token masukan tiap sub-phase; pangkas few-shot (`src/prompts/fewshot.js`, terkunci oleh test kesamaan dengan monolit lama — ubah test bersamaan) dan kaji ulang `TOKEN_LIMITS`.
- Kriteria selesai: waktu median Phase 1 tercatat sebelum/sesudah.

## 7. Catatan keputusan

- Unit pertama (RPP Core) sengaja tidak diparalelkan: ia memberi konteks bagi unit lain dan, bila gagal, sisanya sia-sia.
- Progres per bagian memakai perkiraan panjang output (`SUBPHASE_EXPECTED_CHARS`) hanya untuk memperhalus bar; angka bisa disetel dan tidak memengaruhi logika.
- Tombol Batal dibuat tanpa `data-action` (listener sendiri) — `dom-contract.test.js` melarang gabungan keduanya karena klik akan tereksekusi dua kali.
- Bar Regenerate kini tampil setelah generate; sebelumnya selalu tersembunyi. Bila itu disengaja, kembalikan `setHidden(..., true)` di `phase1.js`.





hal yang harus Anda pahami, perbaikan selalu harus tanpa mengurangi kualitas output (kualitas output tetap nomor satu, isi dan konten is that matter), jika bisa malah meningkatkan kualitas outputnya, tidak terlalu generik, dengan konten yang lebih baik.

Saat export ke pdf, hal ini jangan 2 masalah kualitas Analisis kualitas soal evaluasi C1 Mengingat × 1 C2 Memahami × 2 C3 Menerapkan × 3 C4 Menganalisis × 2 C5 Menilai × 1 C6 Mencipta × 1 Total 10 soal · 7 soal level C3+ (70%) soal #6: ada opsi duplikat soal #7: ada opsi duplikat kunci jawaban menumpuk di opsi A (60% dari soal) — sebar kunci lebih merata sampai terender di pdf.