/**
 * Kontrak artifact build produksi.
 *
 * Aplikasi harus tetap bisa dibuka langsung dari `file://` (sifat "zero-config
 * static site" project ini), jadi tag <script> hasil build WAJIB berupa
 * classic script — `type="module"` akan ditolak browser di origin file://
 * karena aturan CORS. Test ini mengunci hal tersebut agar tidak rusak diam-diam
 * saat ada perubahan konfigurasi Vite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const hasBuild = fs.existsSync(path.join(DIST, 'index.html'));

/** Jalankan skrip pemeriksaan artifact, atau skip bila dist belum ada. */
function checkArtifacts() {
  return execFileSync(process.execPath, [path.join(ROOT, 'tests', 'check-artifacts.mjs')], {
    encoding: 'utf8',
  });
}

test('dist/ sudah dibangun (dibuat oleh `pretest`)', () => {
  assert.ok(hasBuild, 'dist/index.html tidak ada — `npm test` menjalankan build lebih dulu');
});

test('semua pemeriksaan artifact lulus', { skip: !hasBuild }, () => {
  const out = checkArtifacts();
  assert.doesNotMatch(out, /FAIL/, `pemeriksaan artifact gagal:\n${out}`);
  assert.match(out, /ARTIFACT OK/);
});

test('tag script bundle adalah classic script', { skip: !hasBuild }, () => {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const tag = html.match(/<script[^>]*src="\.\/assets\/app\.js"[^>]*>/);
  assert.ok(tag, 'tag script untuk assets/app.js harus ada');
  assert.doesNotMatch(tag[0], /type="module"/, 'type="module" merusak pemakaian file://');
  assert.doesNotMatch(tag[0], /crossorigin/, 'crossorigin tidak relevan untuk script lokal');
});

test('build hanya menghasilkan satu chunk JS', { skip: !hasBuild }, () => {
  const assets = fs.readdirSync(path.join(DIST, 'assets'));
  const js = assets.filter((f) => f.endsWith('.js'));
  assert.deepEqual(js, ['app.js'], `bundle harus tunggal, ditemukan: ${js.join(', ')}`);
});

test('path di dalam dist tidak mengarah ke direktori sistem', { skip: !hasBuild }, () => {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  // Path relatif wajib: aplikasi di-host di sub-path GitHub Pages.
  assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/, 'foundasi absolut akan rusak di sub-path');
  assert.match(html, /src="\.\/assets\/app\.js"/);
});

test('bundle tidak membocorkan isi modul ESM', { skip: !hasBuild }, () => {
  const js = fs.readFileSync(path.join(DIST, 'assets', 'app.js'), 'utf8');
  assert.doesNotMatch(js, /^\s*export\s/m, 'bundle IIFE tidak boleh punya export');
  assert.doesNotMatch(js, /from\s*["']\.\//, 'bundle tidak boleh mengimpor path relatif');
});
