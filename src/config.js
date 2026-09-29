/**
 * Konstanta konfigurasi aplikasi.
 * Semua angka "ajaib" yang tersebar di logika dikumpulkan di sini agar mudah
 * dituning dan tidak perlu menggali banyak file.
 */

/**
 * Worker CORS untuk Poolside.
 *
 * Poolside tidak mengirim header CORS sehingga browser memblokir panggilan
 * langsung. Worker milik project ini meneruskan request tersebut, jadi
 * Poolside bisa dipakai tanpa konfigurasi tambahan.
 *
 * Kunci API milik pengguna: setiap guru mengisinya sendiri di browser
 * masing-masing dan hanya disimpan di localStorage perangkatnya. Tidak ada
 * kunci yang ikut ter-bundle atau ter-deploy ke repository.
 *
 * Kosongkan nilai ini (atau isi URL proxy sendiri di "Pengaturan lanjutan")
 * bila ingin memakai worker milik sendiri.
 */
export const DEFAULT_WORKER_URL = 'https://rpp.andys-riyans.workers.dev/?url=';

export const POOLSIDE_BASE = 'https://inference.poolside.ai/v1';
export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/** Batas token per panggilan API per sub-phase. */
export const TOKEN_LIMITS = {
  '1a': 12000,
  '1b': 10000,
  '1c': 7000,
  '1d': 9000,
  '1e': 8000,
  2: 12000,
  3: 12000,
};

/**
 * Batas diam (idle) satu panggilan ke provider.
 *
 * Dengan streaming, timer di-reset tiap ada potongan teks masuk, jadi generate
 * panjang (10k+ token) tidak lagi dibunuh di detik ke-120 selama model masih
 * menulis. Tanpa streaming, angka ini tetap berlaku sebagai batas total.
 */
export const REQUEST_TIMEOUT_MS = 120_000;

/** Batas mutlak satu panggilan (streaming) agar tidak menggantung selamanya. */
export const REQUEST_HARD_TIMEOUT_MS = 480_000;

/** Jeda antar sub-phase pada mode berurutan (concurrency = 1). */
export const SUBPHASE_COOLDOWN_MS = 5_000;

/**
 * Berapa sub-phase Phase 1 yang boleh jalan bersamaan setelah RPP Core selesai.
 *
 * LKPD, Evaluasi, Remidial/Rubrik, dan Diagnostik hanya butuh RPP Core, jadi
 * tidak perlu antre. Naikkan bila provider kuat; set 1 untuk kembali ke mode
 * berurutan (mis. model gratis yang sering kena 429).
 */
export const SUBPHASE_CONCURRENCY = 3;

/** Selisih waktu mulai antar sub-phase paralel (ms) agar tidak menembak API serentak. */
export const SUBPHASE_STAGGER_MS = 1_200;

/**
 * Perkiraan panjang output (karakter) tiap sub-phase, dipakai HANYA untuk
 * memperhalus progress bar selama streaming. Bukan batas keras.
 */
export const SUBPHASE_EXPECTED_CHARS = { a: 14000, b: 9000, c: 11000, d: 9000, e: 8000 };

/** Backoff saat kena 429 (detik). */
export const RATE_LIMIT_BACKOFF_SECONDS = 20;
export const RATE_LIMIT_PRETRY_SECONDS = 10;

/** Berapa kali percobaan per sub-phase sebelum menyerah. */
export const SUBPHASE_ATTEMPTS = 2;

/** Umur maksimum checkpoint recovery sebelum dibersihkan otomatis (ms). */
export const CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Batas jumlah checkpoint yang disimpan. */
export const CHECKPOINT_MAX_ENTRIES = 20;

/**
 * Definisi sub-phase Phase 1.
 * `schema` menentukan key akar JSON yang diharapkan, `id` menentukan
 * kelengkapan yang dicek.
 */
export const SUBPHASES = [
  {
    id: 'a',
    label: 'RPP Core',
    schema: 'rpp',
    description: 'Identitas, Desain, Langkah, Asesmen, Pengesahan',
  },
  {
    id: 'b',
    label: 'LKPD',
    schema: 'lkpd',
    description: 'Lembar Kerja Peserta Didik (tabel, aktivitas, pertanyaan)',
  },
  {
    id: 'c',
    label: 'Evaluasi + Kunci',
    schema: 'evaluasi',
    description: 'Soal pilihan ganda + kunci jawaban + penskoran',
  },
  {
    id: 'd',
    label: 'Remidial + Pengayaan + Rubrik',
    schema: 'lampiranAkhir',
    description: 'Program remidial, pengayaan, rubrik diskusi & presentasi',
  },
  {
    id: 'e',
    label: 'Tes Diagnostik Awal',
    schema: 'diagnostik',
    description: 'Soal diagnostik awal kognitif + rubrik interpretasi',
  },
];

/** Peta id sub-phase -> lokasi data di dalam APP.phase1. */
export const SUBPHASE_PATHS = {
  a: ['rpp'],
  b: ['lampiran', 'lkpd'],
  c: ['lampiran', 'evaluasi'],
  d: ['lampiran', 'programRemidial', 'programPengayaan', 'rubrikPenilaian'],
  e: ['lampiran', 'diagnostik'],
};

/** Key sub-phase yang wajib ada agar Phase 1 dianggap berhasil. */
export const REQUIRED_SUBPHASES = ['a'];

export const EMPTY_PREVIEW = {
  phase1: { icon: '📋', text: 'Generate RPP + Lampiran untuk melihat hasil di sini.' },
  phase2: { icon: '📖', text: 'Generate Modul Ajar setelah RPP selesai.' },
  phase3: { icon: '🎬', text: 'Generate Media Pembelajaran setelah Modul Ajar selesai.' },
};
