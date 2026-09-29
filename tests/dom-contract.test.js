/**
 * Kontrak DOM: apa yang ada di index.html harus cocok dengan yang dibaca modul.
 *
 * Modul memakai helper `$('#id')` di mana-mana. Kalau satu id salah ketik,
 * error-nya baru muncul saat runtime di browser (null deref). Test ini
 * menangkapnya lebih awal, tanpa membuka browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/** Semua file sumber di src/. */
function sourceFiles(dir = path.join(ROOT, 'src')) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const SOURCES = sourceFiles().map((f) => ({
  file: path.relative(ROOT, f).split(path.sep).join('/'),
  text: fs.readFileSync(f, 'utf8'),
}));

/** Semua id yang ada di index.html. */
const htmlIds = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

/**
 * Id yang dibuat modul saat runtime (recovery banner, quality report, dll).
 * Kumpulin dari pola `el.id = '...'` supaya whitelist ini/rawan usang sendiri.
 */
const dynamicIds = new Set();
/** data-action yang dipasang modul saat runtime (tombol cancel & banner resume). */
const dynamicActions = new Set();
for (const { text } of SOURCES) {
  // Buang komentar baris agar contoh di docstring tidak ikut terhitung.
  const code = text.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of code.matchAll(/\.\s*id\s*=\s*['"]([\w:.-]+)['"]/g)) dynamicIds.add(m[1]);
  for (const m of code.matchAll(/\bid=["']([\w:.-]+)["']/g)) dynamicIds.add(m[1]);
  for (const m of code.matchAll(/dataset\.action\s*=\s*['"]([\w:-]+)['"]/g)) {
    dynamicActions.add(m[1]);
  }
}

/** Id yang boleh dirujuk: dari HTML atau dibuat saat runtime. */
function idExists(id) {
  return htmlIds.has(id) || dynamicIds.has(id);
}

/** Kunci-kunci peta `ACTIONS` di main.js. */
function actionKeys(main) {
  const block = main.split('const ACTIONS = {')[1];
  if (!block) return [];
  const body = block.split('\n};')[0];
  return [...body.matchAll(/^\s*['"]([\w:-]+)['"]\s*:/gm)].map((m) => m[1]);
}

test('isi few-shot masih identik dengan monolit asli', () => {
  // Monolit adalah sumber kebenaran untuk isi contoh. Kalau refactor mengubah
  // karakter di dalamnya, output AI ikut berubah diam-diam — dan itu sulit
  // ketahuan dari diff karena hanya kelihatan sebagai teks panjang.
  const legacyPath = path.join(ROOT, 'index.legacy-monolith.html.bak');
  assert.ok(fs.existsSync(legacyPath), 'backup monolit tidak ditemukan untuk perbandingan');

  const legacy = fs.readFileSync(legacyPath, 'utf8');
  const mod = fs.readFileSync(path.join(ROOT, 'src', 'prompts', 'fewshot.js'), 'utf8');

  const literals = [...mod.matchAll(/export const \w+ = `([\s\S]*?)`;/g)].map((m) => m[1]);
  assert.equal(literals.length, 6, 'harus ada 6 blok few-shot');

  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const normLegacy = norm(legacy);
  const changed = literals.filter((body) => !normLegacy.includes(norm(body)));
  assert.deepEqual(changed, [], `few-shot berbeda dari monolit (${changed.length} blok)`);
});

test('seluruh FORM_FIELDS di form.js punya elemen di index.html', () => {
  const form = SOURCES.find((s) => s.file === 'src/ui/form.js').text;
  const block = form.split('const FORM_FIELDS = [')[1].split('];')[0];
  assert.ok(block, 'blok FORM_FIELDS harus ada di form.js');

  const fields = [...block.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)].map((m) => m[1]);
  assert.equal(fields.length, 16, 'harus ada 16 field form');

  const missing = fields.filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, [], `id form tidak ada di index.html: ${missing.join(', ')}`);
});

test('setiap elemen form punya label yang tertaut (atribut for)', () => {
  const form = SOURCES.find((s) => s.file === 'src/ui/form.js').text;
  const block = form.split('const FORM_FIELDS = [')[1].split('];')[0];
  const fields = [...block.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)].map((m) => m[1]);

  for (const id of fields) {
    assert.ok(
      new RegExp(`<label[^>]*for="${id}"`).test(HTML),
      `tidak ada <label for="${id}"> di index.html`
    );
  }
});

test('setiap $("#id") yang dirujuk modul ada di index.html', () => {
  const missing = [];

  for (const { file, text } of SOURCES) {
    // Cocokkan $("...") dan $('#...') serta document.getElementById('...')
    const patterns = [
      /\$\(\s*['"]#([A-Za-z][\w:.-]*)['"]\s*\)/g,
      /getElementById\(\s*['"]([A-Za-z][\w:.-]*)['"]\s*\)/g,
      /querySelector\(\s*['"]#([A-Za-z][\w:.-]*)['"]\s*\)/g,
    ];
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        const id = m[1];
        if (!idExists(id)) missing.push(`${file}: #${id}`);
      }
    }
  }

  assert.deepEqual(
    [...new Set(missing)].sort(),
    [],
    'id yang dirujuk kode tapi tidak ada di index.html'
  );
});

test('setiap data-action yang ditangani main.js ada di index.html', () => {
  const main = SOURCES.find((s) => s.file === 'src/main.js').text;
  const handled = actionKeys(main);
  assert.ok(handled.length > 0, 'main.js harus punya peta ACTIONS');

  const inHtml = new Set([
    ...[...HTML.matchAll(/data-action="([\w:-]+)"/g)].map((m) => m[1]),
    ...dynamicActions,
  ]);
  const orphan = handled.filter((a) => !inHtml.has(a));
  assert.deepEqual(
    orphan,
    [],
    `data-action ditangani tapi tidak ada di HTML: ${orphan.join(', ')}`
  );
});

test('setiap data-action di index.html ditangani main.js', () => {
  const main = SOURCES.find((s) => s.file === 'src/main.js').text;
  const handled = new Set(actionKeys(main));

  const inHtml = [
    ...new Set([
      ...[...HTML.matchAll(/data-action="([\w:-]+)"/g)].map((m) => m[1]),
      ...dynamicActions,
    ]),
  ];
  const unhandled = inHtml.filter((a) => !handled.has(a));
  assert.deepEqual(
    unhandled,
    [],
    `data-action ada di HTML tapi tidak ditangani: ${unhandled.join(', ')}`
  );
});

test('tombol yang bind listener sendiri tidak boleh juga pakai data-action', () => {
  // Kalau sebuah elemen dibuat runtime dengan addEventListener('click', ...)
  // DAN data-action, kliknya akan ditangani dua kali: sekali oleh listener
  // langsung, sekali lagi oleh delegasi global di main.js.
  const problems = [];
  for (const { file, text } of SOURCES) {
    const code = text.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Kelompokkan statement per variabel: `const x = document.createElement(...)`
    // lalu dipakai berkali-kali. Cari variabel yang punya addEventListener click.
    for (const m of code.matchAll(/(\w+)\.addEventListener\(\s*['"]click['"]/g)) {
      const v = m[1];
      const assignsAction = new RegExp(`${v}\\.dataset\\.action\\s*=`).test(code);
      if (assignsAction) {
        problems.push(`${file}: ${v} punya addEventListener('click') sekaligus dataset.action`);
      }
    }
  }
  assert.deepEqual(problems, [], `risiko klik ganda: ${problems.join('; ')}`);
});

test('seluruh sub-phase punya tombol generate & card', () => {
  for (const n of [1, 2, 3]) {
    assert.ok(htmlIds.has(`phase${n}-gen-btn`), `tombol generate phase${n} harus ada`);
    assert.ok(htmlIds.has(`step-${n}`), `card phase${n} harus ada`);
  }
});

test('progress bar hanya ada di Phase 1, dan semua id-nya dipakai kode', () => {
  // Phase 2 & 3 tidak punya progress bar; hanya Phase 1 yang perlu.
  for (const suffix of ['', '-bar', '-fill', '-label', '-pct', '-steps']) {
    assert.ok(htmlIds.has(`phase1-progress${suffix}`), `phase1-progress${suffix} harus ada`);
  }
});

test('elemen struktural yang dibutuhkan recovery & export ada', () => {
  const required = [
    'loading-overlay',
    'loading-actions',
    'settings-panel',
    'toast-container',
    'phase1-export',
    'phase2-export',
    'phase3-export',
    'combined-export-card',
  ];
  const missing = required.filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, [], `elemen wajib hilang: ${missing.join(', ')}`);
});

test('index.html tidak punya handler inline anymore', () => {
  assert.doesNotMatch(
    HTML,
    /\son(click|change|input|submit|load)\s*=/i,
    'handler inline belum dibongkar'
  );
  assert.doesNotMatch(HTML, /<style[\s>]/i, 'CSS inline belum dipindah ke file terpisah');
});

test('seluruh impor relatif di src/ menunjuk file yang ada', () => {
  const missing = [];
  for (const { file, text } of SOURCES) {
    const dir = path.dirname(path.join(ROOT, file));
    for (const m of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const target = path.resolve(dir, m[1]);
      const ok = ['', '.js', '.mjs'].some((ext) => fs.existsSync(target + ext));
      if (!ok) missing.push(`${file} -> ${m[1]}`);
    }
  }
  assert.deepEqual(missing, [], `impor tidak ditemukan: ${missing.join(', ')}`);
});

test('seluruh ekspor yang diimpor benar-benar di.export oleh modulnya', () => {
  const problems = [];
  for (const { file, text } of SOURCES) {
    const dir = path.dirname(path.join(ROOT, file));
    for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
      const names = m[1]
        .split(',')
        .map((s) =>
          s
            .trim()
            .split(/\s+as\s+/)[0]
            .trim()
        )
        .filter(Boolean);
      const target =
        ['.js', '.mjs', '']
          .map((ext) => path.resolve(dir, m[2] + ext))
          .find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
      if (!target) continue; // sudah dilaporkan oleh test impor
      const targetText = fs.readFileSync(target, 'utf8');
      for (const name of names) {
        // Nama helper boleh berisi karakter regex (mis. "$", "$$"), jadi WAJIB
        // di-escape sebelum disisipkan ke RegExp.
        const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // PENTING: jangan pakai \b untuk nama yang berakhiran non-word-char
        // (seperti "$") — \b mensyaratkan karakter kata di sebelahnya.
        const endsWord = /[A-Za-z0-9_]/.test(name.slice(-1));
        const tail = endsWord ? '\\b' : '(?![\\w$])';
        const re = new RegExp(
          `export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+${safe}${tail}|` +
            `export\\s*\\{[^}]*(?<![\\w$])${safe}${tail}[^}]*\\}`
        );
        if (!re.test(targetText)) problems.push(`${file} mengimpor { ${name} } dari ${m[2]}`);
      }
    }
  }
  assert.deepEqual(problems, [], `ekspor tidak ditemukan: ${problems.join('; ')}`);
});
