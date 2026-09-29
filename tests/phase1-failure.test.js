/**
 * Kegagalan generate harus bisa ditindaklanjuti.
 *
 * Regresi yang pernah terjadi: job runner mengembalikan `job.error` berisi
 * pesan asli (timeout, API key ditolak, JSON rusak), tapi orchestrator melempar
 * pesan generik "RPP Core tidak berhasil digenerate" — sehingga penyebabnya
 * hilang dan user tidak tahu harus memperbaiki apa.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { describeJobFailure } from '../src/phases/phase1.js';
import { classifyError, isFatalError, isRateLimitError } from '../src/services/ai-client.js';
import { friendlyError } from '../src/services/json.js';
import { createCheckpoint, saveCheckpoint } from '../src/recovery/checkpoint.js';

/** Penyimpanan in-memory supaya test tidak menyentuh localStorage sungguhan. */
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

test('describeJobFailure membaca lastError asli dari checkpoint', () => {
  mem.clear();
  const cp = createCheckpoint({ phase: 'phase1', label: 'RPP + Lampiran', total: 5 });
  cp.lastError = 'Koneksi timeout setelah 120000ms';
  saveCheckpoint(cp);

  const reason = describeJobFailure({ checkpointId: cp.id, failed: ['a'] });
  assert.equal(reason, 'Koneksi timeout setelah 120000ms');
});

test('describeJobFailure menyebutkan unit yang gagal bila tidak ada lastError', () => {
  mem.clear();
  const reason = describeJobFailure({ checkpointId: null, failed: ['c', 'e'] });
  assert.match(reason, /Evaluasi/);
  assert.match(reason, /Diagnostik/);
});

test('describeJobFailure tetap memberi saran konkret saat tidak ada info sama sekali', () => {
  mem.clear();
  const reason = describeJobFailure({});
  assert.match(reason, /API key|kuota|koneksi/i);
  assert.ok(reason.length > 20, 'pesan harus memberi arah, bukan sekadar "gagal"');
});

test('describeJobFailure tidak melempar saat checkpoint tidak ada', () => {
  mem.clear();
  assert.doesNotThrow(() => describeJobFailure({ checkpointId: 'cp_hilang' }));
});

test('friendlyError memetakan penyebab umum jadi pesan yang bisa ditindaklanjuti', () => {
  const cases = [
    ['Request timed out after 120s', /timeout/i],
    ['401 Unauthorized: invalid api key', /API Key tidak valid/i],
    ['429 Too Many Requests rate limit', /terlalu banyak permintaan/i],
    ['Insufficient credits / quota exceeded', /kuota/i],
    ['No endpoints found for model xyz', /tidak ditemukan/i],
    ['Failed to fetch', /CORS|blokir/i],
  ];
  for (const [raw, expected] of cases) {
    const friendly = friendlyError(raw);
    assert.match(friendly, expected, `"${raw}" -> "${friendly}"`);
  }
});

test('friendlyError untuk JSON rusak memberi saran ganti model', () => {
  const friendly = friendlyError('Gagal parse JSON dari respons AI');
  assert.match(friendly, /JSON/i);
  assert.match(friendly, /model lain|generate ulang/i, 'harus memberi jalan keluar');
});

test('friendlyError tidak menyembunyikan error tak dikenal', () => {
  const msg = friendlyError('Sesuatu yang sangat tidak terduga terjadi');
  assert.ok(msg.length > 0);
  assert.notEqual(msg, 'Error tidak diketahui');
});

test('friendlyError menangani input kosong tanpa melempar', () => {
  assert.doesNotThrow(() => friendlyError(''));
  assert.doesNotThrow(() => friendlyError(null));
  assert.doesNotThrow(() => friendlyError(undefined));
});

test('kuota tidak dianggap rate-limit yang layak dicoba ulang', () => {
  const err = new Error('Insufficient credits / quota exceeded');
  assert.equal(isRateLimitError(err.message), false);
  assert.equal(isFatalError(err), true);
  assert.equal(classifyError(err), 'quota');
});
