# Rencana Implementasi: Integrasi Provider Poolside

Saya telah memperbaiki _syntax error_ yang menyebabkan tombol pengaturan tidak bisa diklik. Masalah tersebut terjadi akibat karakter _escape_ yang keliru pada fungsi `regeneratePart` yang baru kita tambahkan sebelumnya.

Sekarang, untuk mengabulkan permintaan Anda mengintegrasikan **Poolside (Model Laguna S-2.1)**, kita perlu melakukan beberapa modifikasi mendasar pada struktur aplikasi di `index.html`.

## ⚠️ User Review Required

Perubahan ini akan memodifikasi cara aplikasi memanggil API dan cara data pengaturan (Settings) disimpan. Mohon periksa rencana di bawah ini dan konfirmasi apakah Anda setuju dengan alur dan skenario integrasi ini.

## Proposed Changes

### Komponen Pengaturan (Settings UI)

Kita perlu memodifikasi menu Pengaturan untuk mengakomodasi dua jenis provider yang berbeda (OpenRouter dan Poolside).

#### [MODIFY] `index.html` (Area Modal Settings)

- **Tambah Dropdown Provider**: Menambahkan elemen `<select id="set-provider">` dengan opsi `OpenRouter` dan `Poolside`.
- **Manajemen API Key Terpisah**:
  - Mengubah input `set-apikey` menjadi dua input terpisah atau satu input dinamis, namun di belakang layar, kita akan menyimpan `openRouterKey` dan `poolsideKey` secara terpisah di `localStorage`. Ini penting agar key OpenRouter Anda tidak tertimpa/hilang saat mencoba Poolside.
  - Jika provider `Poolside` dipilih, placeholder input model akan disarankan menjadi `poolside/laguna-s-2.1`.

### Modifikasi Logika Pemanggilan API

Saat ini, fungsi pemanggilan AI terikat secara _hardcode_ ke endpoint OpenRouter. Kita akan merestrukturisasinya agar dinamis.

#### [MODIFY] `index.html` (Fungsi API)

- Mengubah fungsi `callOpenRouter` menjadi `callAIProvider`.
- Menambahkan percabangan logika (_conditional branch_):
  - **Jika Provider == OpenRouter**: URL fetch menggunakan `https://openrouter.ai/api/v1/chat/completions` dengan Headers `Authorization: Bearer [OpenRouter_Key]`.
  - **Jika Provider == Poolside**: URL fetch menggunakan `https://inference.poolside.ai/v1/chat/completions` dengan Headers `Authorization: Bearer [Poolside_Key]`.
- Modifikasi fungsi `generateWithFallback` agar membaca konfigurasi `APP.settings.provider` saat ini sebelum menginisiasi panggilan.

## Verifikasi Plan

1. **Uji UI Pengaturan**:
   - Memastikan pergantian dropdown "Provider" berjalan lancar dan menampilkan form API Key yang sesuai.
   - Memastikan nilai yang tersimpan di `localStorage` tidak bercampur.
2. **Uji Pemanggilan (Fetch)**:
   - Jika memilih Poolside dengan model `poolside/laguna-s-2.1`, memastikan koneksi mengarah ke `inference.poolside.ai`.
   - Menguji apakah model merespons dengan JSON yang _valid_ untuk RPP (terlepas dari kualitas pedagogisnya).

Silakan klik **Proceed** atau berikan umpan balik jika Anda setuju dengan rencana implementasi ini!
