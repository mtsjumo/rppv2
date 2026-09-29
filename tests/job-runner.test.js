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

test('job baru menyimpan checkpoint sebelum dan sesudah unit selesai', async () => {
  mem.clear();
  const job = await runResumableJob({
    phase: 'phase1',
    label: 'RPP + Lampiran',
    input: { mapel: 'IPA' },
    units: [
      {
        id: 'a',
        persistKey: 'rpp',
        run: async ({ checkpointId }) => {
          assert.ok(getCheckpoint(checkpointId), 'checkpoint harus ada sebelum unit pertama jalan');
          return { rpp: { judul: 'Sel' } };
        },
      },
    ],
  });

  const checkpoint = getCheckpoint(job.checkpointId);
  assert.ok(checkpoint, 'checkpoint job baru harus tersimpan');
  assert.equal(checkpoint.status, 'complete');
  assert.deepEqual(checkpoint.completed, ['a']);
  assert.deepEqual(checkpoint.input, { mapel: 'IPA' });
  assert.deepEqual(checkpoint.data.rpp, { rpp: { judul: 'Sel' } });
});
