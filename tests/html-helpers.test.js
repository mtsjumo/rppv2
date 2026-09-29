import test from 'node:test';
import assert from 'node:assert/strict';

import { richText, table } from '../src/render/html-helpers.js';

test('tabel Markdown pada soal tetap menjadi tabel dan merender rumus di sel', () => {
  const out = richText(String.raw`| Bentuk | Nilai |
| --- | --- |
| Pecahan | \frac{1}{2} |`);

  assert.match(out, /<table>/);
  assert.match(out, /<th>Bentuk<\/th>/);
  assert.match(out, /<img /, 'rumus pada sel tabel harus dirender');
});

test('helper tabel dokumen merender rumus di sel tanpa mengubah teks biasa', () => {
  const out = table(['Keterangan', 'Nilai'], [['Hasil percobaan', String.raw`\frac{6}{x-2}`]]);

  assert.match(out, /Hasil percobaan/);
  assert.match(out, /<img /, 'rumus pada tabel lampiran harus dirender');
});
