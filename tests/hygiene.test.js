import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Kebersihan source: encoding, placeholder, dan tautan antar-file.
 *
 * Project ini ditulis dalam bahasa Indonesia. Karakter CJK/Hangul hanya
 * pernah muncul bila ada teks rusak yang ter-salin, dan itu sulit dilacak
 * karena hanya terlihat saat render. Test ini membuat masalahnya muncul
 * lebih awal.
 */
const ROOT = path.resolve(import.meta.dirname, '..');

/** Semua file yang constitutes sumber project. */
function projectFiles() {
  const out = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'coverage']);
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(ROOT);
  return out;
}

const TEXT_EXT = /\.(js|mjs|cjs|json|css|html|md|yml|yaml|txt)$/i;
const FILES = projectFiles().filter((f) => TEXT_EXT.test(f));

/**
 * File pemeriksa ini sendiri memuat pola yang dicari (mis. literal "TODO"),
 * jadi harus dikecualikan dari pemeriksaan berbasis literal — kalau tidak,
 * scanner akan selalu menandai dirinya sendiri sebagai pelanggaran.
 */
const SELF = path
  .relative(ROOT, import.meta.filename ?? '')
  .split(path.sep)
  .join('/');
const SCANNED = FILES.filter((f) => path.relative(ROOT, f).split(path.sep).join('/') !== SELF);

/** Hanya file .js di dalam src/ (dipakai untuk pemindaian host). */
function sourceFilesJs() {
  return projectFiles().filter(
    (f) => f.startsWith(path.join(ROOT, 'src')) && f.endsWith('.js')
  );
}

test('daftar file yang dipindai tidak kosong', () => {
  assert.ok(FILES.length > 10, `hanya ${FILES.length} file; cek filter`);
});

test('tidak ada karakter CJK / Hangul di file sumber mana pun', () => {
  const offenders = [];
  for (const file of FILES) {
    const text = fs.readFileSync(file, 'utf8');
    const matches = [...text.matchAll(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)];
    for (const m of matches) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      const line = text.slice(0, m.index).split('\n').length;
      offenders.push(`${rel}:${line} ${JSON.stringify(m[0])}`);
    }
  }
  assert.deepEqual(offenders, [], `indeks karakter asing:\n${offenders.join('\n')}`);
});

test('tidak ada karakter pengganti Unicode (U+FFFD) — tanda file rusak', () => {
  const offenders = FILES.filter((f) => fs.readFileSync(f, 'utf8').includes('\ufffd')).map((f) =>
    path.relative(ROOT, f).split(path.sep).join('/')
  );
  assert.deepEqual(offenders, [], `file mengandung U+FFFD: ${offenders.join(', ')}`);
});

test('setiap file sumber adalah UTF-8 yang valid', () => {
  const offenders = [];
  for (const file of FILES) {
    const buf = fs.readFileSync(file);
    // Node akan mengganti byte tak valid jadi U+FFFD saat decode UTF-8.
    if (buf.toString('utf8').includes('\ufffd')) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `bukan UTF-8 valid: ${offenders.join(', ')}`);
});

test('tidak ada mojibake khas di file sumber', () => {
  const offenders = [];
  for (const file of SCANNED) {
    const text = fs.readFileSync(file, 'utf8');
    // Tanda klasik mojibake: byte lead Latin-1 (mis. "â", "Ã") langsung
    // diikuti byte continuation (U+0080–U+00BF). Di teks UTF-8 yang benar,
    // kombinasi ini tidak pernah muncul.
    const patterns = [
      /[\u00c2-\u00f4][\u0080-\u00bf]/, // mis. "â€", "Ã©"
      /\u00e2[\u0080-\u00bf]?[\u201a-\u203a\u20ac]/, //EM DASH rusak
      /[\u0152\u0153\u0160\u0161\u0178\u0179]/, // huruf ter-encode dua kali
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        const line = text.slice(0, m.index).split('\n').length;
        offenders.push(`${rel}:${line} ${JSON.stringify(m[0])}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `mojibake:\n${offenders.join('\n')}`);
});

test('tidak ada sisa template atau placeholder yang tak terisi', () => {
  const offenders = [];
  const patterns = [
    /\$\{\s*TODO\s*\}/,
    /\bTODO\b/,
    /\bFIXME\b/,
    /\bXXX\b/,
    /lorem ipsum/i,
    /undefined undefined/,
    /\[object Object\]/,
  ];
  for (const file of SCANNED) {
    const text = fs.readFileSync(file, 'utf8');
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        const line = text.slice(0, m.index).split('\n').length;
        offenders.push(`${rel}:${line} ${JSON.stringify(m[0])}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `placeholder tertinggal:\n${offenders.join('\n')}`);
});

test('package.json valid dan punya script wajib', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const s of ['dev', 'build', 'lint', 'test']) {
    assert.ok(pkg.scripts?.[s], `script "${s}" harus ada`);
  }
  assert.equal(pkg.type, 'module', 'project harus ESM');
});

/**
 * Host yang BOLEH dipanggil aplikasi. Aplikasi ini statis dan tanpa backend,
 * jadi setiap host yang muncul di kode = data pengguna keluar ke pihak ketiga.
 * Menambah host baru harus disengaja, bukan tidak sengaja.
 *
 * - openrouter.ai / inference.poolside.ai : endpoint AI yang dipilih pengguna
 * - latex.codecogs.com                   : render rumus LaTeX jadi gambar
 * - rpp-generator.github.io              : fallback nilai header HTTP-Referer
 * - rpp.andys-riyans.workers.dev         : worker CORS milik project ini
 *                                          (dipakai hanya bila provider=Poolside)
 */
const ALLOWED_HOSTS = new Set([
  'openrouter.ai',
  'inference.poolside.ai',
  'latex.codecogs.com',
  'rpp-generator.github.io',
  'rpp.andys-riyans.workers.dev',
]);

/** Host yang TIDAK boleh muncul sebagai proxy bawaan (proxy publik gratis). */
const FORBIDDEN_PROXY_HOSTS = [
  'corsproxy.io',
  'allorigins',
  'codetabs',
  'cors.isomorphic-git.org',
  'thingproxy',
  'whateverorigin',
];

test('tidak ada host asing di kode yang bisa dieksekusi', () => {
  const offenders = [];
  const files = [...sourceFilesJs(), path.join(ROOT, 'vite.config.js')];

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    // Buang komentar supaya URL yang HANYA didokumentasikan tidak dihitung.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    for (const m of code.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
      const host = m[1];
      if (ALLOWED_HOSTS.has(host)) continue;
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      const line = code.slice(0, m.index).split('\n').length;
      offenders.push(`${rel}:${line} host tidak diizinkan: ${host}`);
    }
  }
  assert.deepEqual(offenders, [], `host asing di kode:\n${offenders.join('\n')}`);
});

test('proxy CORS bawaan memakai worker milik sendiri, bukan proxy publik', () => {
  const config = fs.readFileSync(path.join(ROOT, 'src', 'config.js'), 'utf8');
  const m = config.match(/export const DEFAULT_WORKER_URL\s*=\s*'([^']*)'/);
  assert.ok(m, 'DEFAULT_WORKER_URL harus ada di config.js');
  assert.notEqual(m[1], '', 'worker bawaan sebaiknya terisi agar Poolside langsung jalan');

  const lower = m[1].toLowerCase();
  for (const host of FORBIDDEN_PROXY_HOSTS) {
    assert.ok(
      !lower.includes(host),
      `proxy bawaan tidak boleh memakai layanan publik "${host}"`
    );
  }
});

test('bundle produksi tidak memakai proxy publik gratis', () => {
  const bundle = path.join(ROOT, 'dist', 'assets', 'app.js');
  if (!fs.existsSync(bundle)) return; // dist belum dibangun; artifacts.test.js menanganinya
  const js = fs.readFileSync(bundle, 'utf8').toLowerCase();
  for (const host of FORBIDDEN_PROXY_HOSTS) {
    assert.ok(!js.includes(host), `bundle memuat proxy publik "${host}"`);
  }
});

test('tidak ada API key yang ikut ter-bundle', () => {
  // Kunci diisi pengguna saat runtime dan hanya disimpan di localStorage.
  // Kalau muncul pola sk-xxx di source/bundle, berarti ada yang bocor.
  const bundle = path.join(ROOT, 'dist', 'assets', 'app.js');
  if (!fs.existsSync(bundle)) return;
  const js = fs.readFileSync(bundle, 'utf8');
  const leaks = [...js.matchAll(/\bsk-[A-Za-z0-9_-]{16,}/g)];
  assert.deepEqual(leaks, [], `kemungkinan API key bocor: ${leaks.length} temuan`);
});
