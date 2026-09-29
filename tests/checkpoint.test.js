import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCheckpoint,
  describeCheckpoint,
  discardCheckpoint,
  getCheckpoint,
  listCheckpoints,
  listResumable,
  markComplete,
  markFailed,
  markOrphansInterrupted,
  markUnitComplete,
  patchCheckpoint,
  saveCheckpoint,
} from '../src/recovery/checkpoint.js';
import { clearCheckpointFor } from '../src/recovery/job-runner.js';
import { STORAGE_KEYS } from '../src/core/storage.js';

/** Penyimpanan in-memory, jadi test tidak menyentuh localStorage Node. */
function useMemoryStorage() {
  const mem = new Map();
  globalThis.localStorage = {
    get length() {
      return mem.size;
    },
    key: (i) => Array.from(mem.keys())[i] ?? null,
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
  return mem;
}

const mem = useMemoryStorage();

/** Bersihkan storage + daftar checkpoint sebelum tiap test. */
function reset() {
  mem.clear();
}

test('createCheckpoint menghasilkan status running dengan field lengkap', () => {
  reset();
  const cp = createCheckpoint({ phase: 'phase1', label: 'RPP', total: 5, input: { mapel: 'IPA' } });
  assert.ok(cp.id, 'id harus dibuat');
  assert.equal(cp.status, 'running');
  assert.equal(cp.phase, 'phase1');
  assert.deepEqual(cp.completed, []);
  assert.deepEqual(cp.data, {});
  assert.equal(cp.total, 5);
  assert.deepEqual(cp.input, { mapel: 'IPA' });
  assert.equal(cp.lastError, null);
});

test('saveCheckpoint lalu getCheckpoint membaca kembali data yang sama', () => {
  reset();
  const cp = createCheckpoint({ phase: 'phase1', label: 'RPP' });
  saveCheckpoint(cp);
  const loaded = getCheckpoint(cp.id);
  assert.ok(loaded, 'checkpoint harus tersimpan');
  assert.equal(loaded.id, cp.id);
  assert.equal(loaded.phase, 'phase1');
});

test('markUnitComplete menambahkan unit tanpa duplikat dan menggabungkan data', () => {
  reset();
  const cp = createCheckpoint({ phase: 'phase1', label: 'RPP' });
  saveCheckpoint(cp);

  markUnitComplete(cp.id, 'rpp', { rpp: { judul: 'Uji' } });
  markUnitComplete(cp.id, 'lampiran', { lampiran: { x: 1 } });
  markUnitComplete(cp.id, 'rpp', { rpp: { judul: 'Uji' } });

  const after = getCheckpoint(cp.id);
  assert.deepEqual(after.completed.sort(), ['lampiran', 'rpp'], 'unit tidak boleh terduplikasi');
  assert.ok(after.data.rpp, 'data unit pertama harus ikut');
  assert.ok(after.data.lampiran, 'data unit kedua harus ikut');
});

test('patchCheckpoint hanya mengubah field yang diberikan', () => {
  reset();
  const cp = createCheckpoint({ phase: 'phase2', label: 'Modul', total: 1 });
  saveCheckpoint(cp);
  patchCheckpoint(cp.id, { lastError: 'boom' });

  const after = getCheckpoint(cp.id);
  assert.equal(after.lastError, 'boom');
  assert.equal(after.phase, 'phase2', 'field lain tidak boleh berubah');
  assert.equal(after.total, 1);
});

test('patchCheckpoint untuk id yang tidak ada mengembalikan null', () => {
  reset();
  assert.equal(patchCheckpoint('tidak-ada', { lastError: 'x' }), null);
});

test('markComplete dan markFailed menyimpan status serta pesan error', () => {
  reset();
  const a = createCheckpoint({ phase: 'phase1', label: 'A' });
  const b = createCheckpoint({ phase: 'phase2', label: 'B' });
  saveCheckpoint(a);
  saveCheckpoint(b);

  markComplete(a.id);
  markFailed(b.id, new Error('rate limit 429'));

  assert.equal(getCheckpoint(a.id).status, 'complete');
  assert.equal(getCheckpoint(a.id).lastError, null);
  assert.equal(getCheckpoint(b.id).status, 'failed');
  assert.match(getCheckpoint(b.id).lastError, /rate limit/);
});

test('markFailed menerima string biasa, bukan hanya Error', () => {
  reset();
  const cp = createCheckpoint({ phase: 'phase1', label: 'A' });
  saveCheckpoint(cp);
  markFailed(cp.id, 'koneksi putus');
  assert.equal(getCheckpoint(cp.id).lastError, 'koneksi putus');
});

test('markOrphansInterrupted hanya menyentuh checkpoint yang running', () => {
  reset();
  const running = createCheckpoint({ phase: 'phase1', label: 'R' });
  const complete = createCheckpoint({ phase: 'phase2', label: 'C' });
  const failed = createCheckpoint({ phase: 'phase3', label: 'F' });
  [running, complete, failed].forEach(saveCheckpoint);
  markComplete(complete.id);
  markFailed(failed.id, 'err');

  const orphans = markOrphansInterrupted();
  assert.equal(orphans.length, 1, 'hanya yang running yang dihitung orphan');
  assert.equal(orphans[0].id, running.id);

  assert.equal(getCheckpoint(running.id).status, 'interrupted');
  assert.equal(getCheckpoint(complete.id).status, 'complete', 'complete tidak boleh diubah');
  assert.equal(getCheckpoint(failed.id).status, 'failed', 'failed tidak boleh diubah');
});

test('markOrphansInterrupted aman saat tidak ada checkpoint', () => {
  reset();
  assert.deepEqual(markOrphansInterrupted(), []);
});

test('listResumable mengecualikan yang `complete`, termasuk yang `failed`', () => {
  reset();
  const done = createCheckpoint({ phase: 'phase1', label: 'D' });
  const pending = createCheckpoint({ phase: 'phase2', label: 'P' });
  const broken = createCheckpoint({ phase: 'phase3', label: 'B' });
  [done, pending, broken].forEach(saveCheckpoint);
  markComplete(done.id);
  markFailed(broken.id, 'x');

  const resumable = listResumable().map((c) => c.id);
  // Job yang `failed` masih bisa dilanjutkan — itu justru gunanya
  // checkpoint:pengguna cukup klik "Lanjutkan", bukan mengulang dari nol.
  assert.deepEqual(
    resumable.sort(),
    [pending.id, broken.id].sort(),
    'hanya `complete` yang dikeluarkan'
  );
  assert.ok(!resumable.includes(done.id), 'checkpoint selesai tidak boleh bisa dilanjutkan');
});

test('discardCheckpoint menghapus satu checkpoint dan return void', () => {
  reset();
  const a = createCheckpoint({ phase: 'phase1', label: 'A' });
  const b = createCheckpoint({ phase: 'phase2', label: 'B' });
  saveCheckpoint(a);
  saveCheckpoint(b);

  discardCheckpoint(a.id);
  assert.equal(getCheckpoint(a.id), null);
  assert.ok(getCheckpoint(b.id), 'checkpoint lain tidak boleh ikut terhapus');
});

test('clearCheckpointFor membuang semua checkpoint sebuah phase saja', () => {
  reset();
  const p1a = createCheckpoint({ phase: 'phase1', label: 'A' });
  const p1b = createCheckpoint({ phase: 'phase1', label: 'B' });
  const p2 = createCheckpoint({ phase: 'phase2', label: 'C' });
  [p1a, p1b, p2].forEach(saveCheckpoint);

  clearCheckpointFor('phase1');
  assert.equal(getCheckpoint(p1a.id), null);
  assert.equal(getCheckpoint(p1b.id), null);
  assert.ok(getCheckpoint(p2.id), 'phase2 harus utuh');
});

test('listCheckpoints mengembalikan semua termasuk yang selesai', () => {
  reset();
  const a = createCheckpoint({ phase: 'phase1', label: 'A' });
  const b = createCheckpoint({ phase: 'phase2', label: 'B' });
  saveCheckpoint(a);
  saveCheckpoint(b);
  markComplete(a.id);

  assert.equal(listCheckpoints().length, 2, 'checkpoint selesai tetap tersimpan untuk riwayat');
});

test('penyimpanan rusak tidak membuat modul crash', () => {
  reset();
  mem.set(STORAGE_KEYS.checkpoints, '{bukan json valid');
  // Tidak melempar;Read.all harus aman dan mengembalikan daftar kosong.
  assert.doesNotThrow(() => listCheckpoints());
  assert.deepEqual(listCheckpoints(), []);
});

test('data checkpoint berbentuk bukan array diperlakukan sebagai kosong', () => {
  reset();
  mem.set(STORAGE_KEYS.checkpoints, JSON.stringify({ bukan: 'array' }));
  assert.doesNotThrow(() => listCheckpoints());
  assert.deepEqual(listCheckpoints(), []);
});

test('describeCheckpoint menghitung progress, persentase, dan umur', () => {
  reset();
  const cp = createCheckpoint({ phase: 'phase1', label: 'RPP + Lampiran', total: 5 });
  cp.completed = ['a', 'b'];
  saveCheckpoint(cp);

  const summary = describeCheckpoint(cp);
  assert.equal(summary.done, 2);
  assert.equal(summary.total, 5);
  assert.equal(summary.label, 'RPP + Lampiran');
  assert.equal(typeof summary.ageMs, 'number');
  assert.ok(summary.ageMs >= 0);
});

test('describeCheckpoint menangani total yang tidak diketahui', () => {
  reset();
  const cp = createCheckpoint({ phase: 'phase1', label: 'RPP' });
  cp.total = 0;
  const summary = describeCheckpoint(cp);
  assert.equal(summary.total, 0);
  assert.equal(summary.done, 0);
});
