/**
 * Job runner mode paralel.
 *
 * Phase 1 dulu lambat karena 5 sub-phase berjalan berurutan dengan jeda tetap
 * 5 detik. Sekarang RPP Core jalan sendirian dulu, lalu sisanya paralel.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { runResumableJob } from '../src/recovery/job-runner.js';
import { getCheckpoint } from '../src/recovery/checkpoint.js';

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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bangun unit uji yang mencatat urutan mulai/selesai dan puncak paralelisme. */
function makeUnits(ids, { failId = null, delay = 40 } = {}) {
  const log = [];
  const stats = { active: 0, peak: 0 };
  const units = ids.map((id) => ({
    id,
    persistKey: id,
    run: async () => {
      log.push(`start:${id}`);
      stats.active++;
      stats.peak = Math.max(stats.peak, stats.active);
      await wait(delay);
      stats.active--;
      if (id === failId) throw new Error('boom');
      log.push(`end:${id}`);
      return { id };
    },
  }));
  return { units, log, stats };
}

test('unit pertama selesai dulu, sisanya berjalan paralel tanpa cooldown 5 detik', async () => {
  mem.clear();
  const { units, log, stats } = makeUnits(['a', 'b', 'c', 'd', 'e']);

  const startedAt = Date.now();
  const job = await runResumableJob({
    phase: 'phase1',
    label: 'uji',
    units,
    concurrency: 3,
    staggerMs: 0,
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(job.completed, true);
  assert.deepEqual(Object.keys(job.data).sort(), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(getCheckpoint(job.checkpointId).status, 'complete');

  assert.equal(log[0], 'start:a');
  assert.ok(log.indexOf('end:a') < log.indexOf('start:b'), 'RPP Core harus selesai sebelum unit lain mulai');
  assert.equal(stats.peak, 3, 'harus ada 3 unit berjalan bersamaan');
  assert.ok(elapsed < 2000, `mode paralel tidak boleh kena cooldown tetap (${elapsed}ms)`);
});

test('unit pertama gagal → unit lain tidak dijalankan', async () => {
  mem.clear();
  const { units, log } = makeUnits(['a', 'b', 'c'], { failId: 'a', delay: 10 });

  const job = await runResumableJob({
    phase: 'phase1',
    label: 'uji',
    units,
    concurrency: 3,
    staggerMs: 0,
  });

  assert.equal(job.completed, false);
  assert.ok(job.error, 'error fatal harus terisi');
  assert.ok(!log.includes('start:b') && !log.includes('start:c'), 'unit lain tidak boleh jalan');
});

test('unit pelengkap gagal → unit lain tetap selesai dan job ditandai belum lengkap', async () => {
  mem.clear();
  const { units } = makeUnits(['a', 'b', 'c', 'd'], { failId: 'c', delay: 10 });

  const job = await runResumableJob({
    phase: 'phase1',
    label: 'uji',
    units,
    concurrency: 3,
    staggerMs: 0,
  });

  assert.equal(job.completed, false);
  assert.equal(job.error, null, 'kegagalan unit pelengkap bukan error fatal');
  assert.deepEqual(job.failed, ['c']);
  assert.deepEqual(Object.keys(job.data).sort(), ['a', 'b', 'd']);
});

test('sinyal batal sebelum mulai → tidak ada unit yang dijalankan', async () => {
  mem.clear();
  const { units, log } = makeUnits(['a', 'b']);
  const controller = new AbortController();
  controller.abort();

  const job = await runResumableJob({
    phase: 'phase1',
    label: 'uji',
    units,
    concurrency: 3,
    signal: controller.signal,
  });

  assert.equal(job.aborted, true);
  assert.deepEqual(log, []);
});

test('unit yang sudah selesai (resume) dilewati di mode paralel', async () => {
  mem.clear();
  const { units, log } = makeUnits(['a', 'b', 'c'], { delay: 10 });

  const job = await runResumableJob({
    phase: 'phase1',
    label: 'uji',
    units,
    concurrency: 3,
    staggerMs: 0,
    resumeDone: ['a', 'b'],
    resumeData: { a: { id: 'a' }, b: { id: 'b' } },
  });

  assert.equal(job.completed, true);
  assert.deepEqual(log, ['start:c', 'end:c']);
});
