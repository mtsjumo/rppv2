import test from 'node:test';
import assert from 'node:assert/strict';

import { anyBusy, enterBusy, isBusy, releaseAll, releaseBusy } from '../src/core/busy.js';
import { on } from '../src/core/events.js';

test('enterBusy mengunci sekali lalu menolak pemanggilan kedua', () => {
  releaseAll();
  assert.equal(isBusy('phase1'), false);

  assert.equal(enterBusy('phase1'), true, 'pengambilan pertama harus berhasil');
  assert.equal(isBusy('phase1'), true);

  assert.equal(enterBusy('phase1'), false, 'pengambilan kedua harus ditolak');
  assert.equal(enterBusy('phase1'), false, 'dan tetap ditolak');
});

test('kunci berbeda tidak saling mengganggu', () => {
  releaseAll();
  assert.equal(enterBusy('phase1'), true);
  assert.equal(enterBusy('phase2'), true, 'key berbeda = kunci berbeda');
  assert.equal(enterBusy('regen'), true);
  assert.equal(anyBusy(), true);

  releaseBusy('phase1');
  assert.equal(enterBusy('phase1'), true, 'phase1 bisa diambil lagi setelah dilepas');
  assert.equal(isBusy('phase2'), true, 'phase2 tidak boleh ikut terlempar');
  releaseAll();
});

test('releaseBusy idempoten dan aman untuk key yang tidak ada', () => {
  releaseAll();
  assert.doesNotThrow(() => releaseBusy('tidak-ada'));

  enterBusy('phase1');
  releaseBusy('phase1');
  assert.doesNotThrow(() => releaseBusy('phase1'));
  assert.doesNotThrow(() => releaseBusy('phase1'));
  assert.equal(isBusy('phase1'), false);
});

test('releaseBusy menghapus key, bukan hanya men-set false', () => {
  releaseAll();
  enterBusy('phase1');
  releaseBusy('phase1');
  // Kalau key tidak dihapus, anyBusy() akan salah menghitung.
  assert.equal(anyBusy(), false, 'key yang sudah dilepas tidak boleh ikut terhitung');
});

test('enterBusy memancarkan event rejected beserta pesannya', () => {
  releaseAll();
  const seen = [];
  const off = on('busy:rejected', (payload) => seen.push(payload));

  enterBusy('phase1');
  enterBusy('phase1');

  assert.equal(seen.length, 1, 'penolakan harus memicu event');
  assert.equal(seen[0].key, 'phase1');
  assert.match(seen[0].message, /Masih memproses/);

  off?.();
  releaseAll();
});

test('pesan penolakan bisa dioverride per operasi', () => {
  releaseAll();
  const seen = [];
  const off = on('busy:rejected', (payload) => seen.push(payload));

  enterBusy('phase1');
  enterBusy('phase1', { message: 'Khusus regenerate' });

  assert.equal(seen[0].message, 'Khusus regenerate');
  off?.();
  releaseAll();
});

test('releaseAll mengosongkan seluruh kunci', () => {
  releaseAll();
  enterBusy('a');
  enterBusy('b');
  enterBusy('c');
  assert.equal(anyBusy(), true);

  releaseAll();
  assert.equal(anyBusy(), false);
  for (const k of ['a', 'b', 'c']) assert.equal(isBusy(k), false);
});

test('anyBusy false saat idle (state awal setelah import)', () => {
  releaseAll();
  assert.equal(anyBusy(), false);
});
