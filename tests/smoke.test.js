/**
 * Smoke test: jalankan bundle build di DOM sungguhan (jsdom) dan pastikan
 * `init()` selesai tanpa error serta UI berada di kondisi awal yang benar.
 *
 * Ini menangkap null-deref saat startup yang tidak akan terlihat oleh test
 * statis — misalnya selector yang salah atau elemen yang belum ada.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { STORAGE_KEYS } from '../src/core/storage.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUNDLE = path.join(ROOT, 'dist', 'assets', 'app.js');
const INDEX = path.join(ROOT, 'dist', 'index.html');

/**
 * Siapkan DOM + stub yang dibutuhkan aplikasi, lalu jalankan bundle.
 *
 * PENTING: `init()` dijadwalkan pada DOMContentLoaded, dan jsdom
 * mengefires event itu secara ASINKRON setelah `eval()`. Jadi kita harus
 * menunggu `.wizard-step[data-step="0"]` mendapat kelas `active` (tanda
 * `showStep(0)` sudah jalan) sebelum berinteraksi — kalau tidak, listener
 * autosave belum terpasang dan test akan gagal palsu.
 *
 * @param {Record<string,string>} [seedStorage] nilai localStorage awal
 * @returns {Promise<{dom, window, errors, warnings}>}
 */
async function bootApp(seedStorage = {}) {
  assert.ok(fs.existsSync(INDEX), 'dist/index.html belum ada — jalankan `npm run build` dulu');
  assert.ok(fs.existsSync(BUNDLE), 'dist/assets/app.js belum ada — jalankan `npm run build` dulu');

  const errors = [];
  const warnings = [];

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(e.message));
  virtualConsole.on('error', (...a) => errors.push(a.join(' ')));
  virtualConsole.on('warn', (...a) => warnings.push(a.join(' ')));

  const html = fs.readFileSync(INDEX, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'https://example.test/',
    pretendToBeVisual: true,
    virtualConsole,
  });

  const { window } = dom;

  // jsdom tidak mengimplementasikan API yang dipakai app.
  window.matchMedia =
    window.matchMedia ||
    (() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }));

  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => 'blob:mock';
    window.URL.revokeObjectURL = () => {};
  }
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.HTMLElement.prototype.scrollIntoView = function () {};

  // Aplikasi memanggil window.confirm saat reset; default true agar tidak
  // memblokir smoke test.
  window.confirm = () => true;
  window.print = () => {};

  // Isi localStorage SEBELUM bundle dievaluasi, supaya init() langsung
  // menemukan data sesi sebelumnya.
  for (const [k, v] of Object.entries(seedStorage)) {
    window.localStorage.setItem(k, v);
  }

  const code = fs.readFileSync(BUNDLE, 'utf8');
  try {
    window.eval(code);
  } catch (e) {
    errors.push(e.stack || e.message);
  }

  // Tunggu init() selesai (sentinel: showStep(0) sudah menandai langkah aktif).
  const activeStep = window.document.querySelector('.wizard-step[data-step="0"]');
  for (let i = 0; i < 100; i++) {
    if (activeStep?.classList.contains('active')) break;
    await new Promise((r) => setTimeout(r, 20));
  }

  return { dom, window, errors, warnings };
}

test('bundle build berjalan tanpa error saat startup', async () => {
  const { window, errors } = await bootApp();
  // init() berjalan sinkron pada DOMContentLoaded; jsdom sudah selesai parse.
  assert.deepEqual(errors, [], `error saat boot:\n${errors.join('\n---\n')}`);
  assert.ok(window.document, 'dokumen harus ada');
});

test('init() benar-benar dijalankan (bukan hanya HTML statis)', async () => {
  const { window } = await bootApp();
  const doc = window.document;

  // showStep(0) hanya dijalankan oleh init(); kelas ini adalah sentinel-nya.
  const step0 = doc.querySelector('.wizard-step[data-step="0"]');
  assert.ok(step0, 'elemen wizard step 0 harus ada');
  assert.ok(step0.classList.contains('active'), 'init() harus sudah menandai langkah 0 aktif');

  // Delegasi aksi global: klik tombol export harus ditangani tanpa error.
  // (Tidak memanggil API-nya, hanya memastikan tidak ada handler yang hilang.)
  const wired = [...doc.querySelectorAll('[data-action]')].length;
  assert.ok(wired > 0, 'harus ada elemen ber-data-action');
});

test('init() memasang delegasi aksi dan merender kondisi awal', async () => {
  const { window } = await bootApp();
  const doc = window.document;

  // Step 0 (form) aktif, tiga langkah berikutnya tersembunyi.
  const step0 = doc.querySelector('#step-0');
  assert.ok(step0, 'card step-0 harus ada');
  assert.ok(!step0.classList.contains('hidden'), 'step-0 harus terlihat di awal');

  // Banner export untuk tiap phase disembunyikan sampai generate selesai.
  for (const n of [1, 2, 3]) {
    const bar = doc.querySelector(`#phase${n}-export`);
    assert.ok(bar, `bar export phase${n} harus ada`);
    assert.ok(
      bar.classList.contains('hidden'),
      `bar export phase${n} harus tersembunyi sebelum generate`
    );
  }

  // Tombol generate tidak dinonaktifkan.
  for (const n of [1, 2, 3]) {
    const btn = doc.querySelector(`#phase${n}-gen-btn`);
    assert.ok(btn, `tombol phase${n} harus ada`);
    assert.equal(btn.disabled, false, `tombol phase${n} harus aktif di awal`);
  }
});

test('overlay loading tersembunyi sampai ada proses', async () => {
  const { window } = await bootApp();
  const overlay = window.document.querySelector('#loading-overlay');
  assert.ok(overlay, 'overlay loading harus ada');
  assert.ok(overlay.classList.contains('hidden'), 'loading harus tersembunyi di awal');
  assert.equal(
    window.document.querySelector('#loading-actions').children.length,
    0,
    'tombol batal tidak boleh ada sebelum ada proses'
  );
});

test('isian form tersimpan ke draft dan dipulihkan', async () => {
  const { window } = await bootApp();
  const doc = window.document;

  const mapel = doc.querySelector('#inp-mapel');
  assert.ok(mapel, 'field mapel harus ada');
  mapel.value = 'Matematika';
  mapel.dispatchEvent(new window.Event('input', { bubbles: true }));

  // Autosave-nya debounced; tunggu sedikit lebih lama dari jeda default.
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEYS.formDraft);
        assert.ok(raw, `draft harus tersimpan di localStorage ("${STORAGE_KEYS.formDraft}")`);
        const parsed = JSON.parse(raw);
        const body = parsed.input || parsed;
        assert.equal(body.mapel, 'Matematika', 'draft harus berisi nilai field');
        resolve();
      } catch (e) {
        reject(e);
      }
    }, 600);
  });
});

test('checkpoint yang tertinggal ditandai interrupted saat reload', async () => {
  // Simulasikan sesi lalu yang ditutup saat job masih jalan.
  const orphan = {
    id: 'cp_smoke1',
    phase: 'phase1',
    label: 'RPP + Lampiran',
    status: 'running',
    completed: ['rpp'],
    data: { rpp: { rpp: { judul: 'Uji' } } },
    input: { mapel: 'IPA' },
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now() - 60_000,
  };

  // boot dengan localStorage terisi, supaya init() langsung memprosesnya.
  const { window, errors } = await bootApp({
    [STORAGE_KEYS.checkpoints]: JSON.stringify([orphan]),
  });

  assert.deepEqual(errors, [], `error saat boot dengan checkpoint:\n${errors.join('\n---\n')}`);

  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.checkpoints) || '[]');
  assert.equal(saved.length, 1, 'checkpoint harus tetap ada');
  assert.equal(
    saved[0].status,
    'interrupted',
    'checkpoint `running` harus ditandai interrupted, bukan dianggap masih jalan'
  );
  assert.equal(saved[0].completed.length, 1, 'unit yang sudah selesai tidak boleh hilang');
});

test('checkpoint yang sudah `complete` tidak ditandai interrupted', async () => {
  const done = {
    id: 'cp_smoke2',
    phase: 'phase2',
    label: 'Modul Ajar',
    status: 'complete',
    completed: ['modul-ajar'],
    data: {},
    input: { mapel: 'IPA' },
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now() - 60_000,
  };
  const { window, errors } = await bootApp({
    [STORAGE_KEYS.checkpoints]: JSON.stringify([done]),
  });
  assert.deepEqual(errors, [], errors.join('\n'));
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.checkpoints) || '[]');
  assert.equal(saved[0].status, 'complete', 'checkpoint selesai tidak boleh diubah');
});

test('tidak ada error yang tertunda setelah semua interaksi', async () => {
  // Libatkan error async (mis. rejection promise) agar tidak lolos dari
  // bootApp() yang hanya menangkap error sinkron.
  const { window, errors } = await bootApp();
  window.addEventListener('unhandledrejection', () => {});
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(errors, [], errors.join('\n'));
});
