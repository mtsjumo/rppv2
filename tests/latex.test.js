import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanLaTeX,
  looksLikeMath,
  normalizeMathText,
  renderCodeCogs,
} from '../src/services/latex.js';

test('rumus inline \\( \\) diubah menjadi img CodeCogs', () => {
  const out = renderCodeCogs(String.raw`Nilai \(x^2 + y^2\) positif.`);
  assert.match(out, /<img src="https?:\/\/[^"]*codecogs/);
  assert.match(out, /loading="lazy"/, 'gambar rumus harus lazy-load');
});

test('rumus display \\[ \\] dibungkus div rata tengah', () => {
  const out = renderCodeCogs(String.raw`Nilai \[\frac{1}{2}\] positif.`);
  assert.match(out, /text-align:center/);
  assert.match(out, /<img/);
});

test('delimiter eksplisit \\( \\), \\[ \\], dan $$ $$ selalu jadi gambar', () => {
  // Delimiter ini tidak ambigu, jadi tidak lewat filter looksLikeMath.
  const cases = [
    [String.raw`\(a\)`, 'inline \\( \\)'],
    [String.raw`\[a+b\]`, 'display \\[ \\]'],
    [String.raw`$$a+b$$`, 'dollar-dollar'],
  ];
  for (const [src, name] of cases) {
    assert.match(renderCodeCogs(src), /<img/, `${name} seharusnya jadi gambar`);
  }
});

test('looksLikeMath hanya menerima rumus yang terlihat seperti matematika', () => {
  for (const ok of [String.raw`\frac{1}{2}`, 'x^2', 'a_1', 'x = 5', String.raw`\alpha`]) {
    assert.equal(looksLikeMath(ok), true, `"${ok}" seharusnya dianggap rumus`);
  }
  // Tanpa \, ^, _, atau = => dianggap teks biasa (mis. mata uang/singkatan).
  for (const no of ['a+b', 'x', '5000', 'AB', 'a b c']) {
    assert.equal(looksLikeMath(no), false, `"${no}" seharusnya bukan rumus`);
  }
});

test('rumus $...$ sederhana dibiarkan apa adanya (anti-false-positive mata uang)', () => {
  // Sengaja TIDAK jadi gambar: "$a+b$" tanpa \,^,_ atau = dianggap teks.
  assert.equal(renderCodeCogs(String.raw`$a+b$`), String.raw`$a+b$`);
  assert.equal(renderCodeCogs(String.raw`$x$`), String.raw`$x$`);

  // Harga dalam dolar tidak boleh jadi gambar.
  const price = 'Budget Needed $5000$ untuk alat praktikum.';
  assert.doesNotMatch(
    renderCodeCogs(price),
    /<img/,
    'angka harga tidak boleh dirender sebagai rumus'
  );
});

test('rumus $...$ yang memang matematika tetap jadi gambar', () => {
  assert.match(renderCodeCogs(String.raw`Nilai $x^2$ di sini.`), /<img/);
  assert.match(renderCodeCogs(String.raw`Nilai $\frac{1}{2}$ di sini.`), /<img/);
  assert.match(renderCodeCogs(String.raw`Nilai $v_1$ di sini.`), /<img/);
});

test('LaTeX polos dari AI dinormalisasi sebelum dirender', () => {
  const raw = String.raw`A \times B &#x20;
(x) = \sqrt{5 - 2x}&#x20;
\\{(a,1),(b,2),(c,1)\\} &#x20;
A. x \le \frac{5}{2}
B. x \ge \frac{5}{2}
C. x < \frac{5}{2}
D. x > \frac{5}{2}
f(x) = \frac{6}{x-2} dengan domain x \neq 2 &#x20;`;

  const normalized = normalizeMathText(raw);
  const out = renderCodeCogs(normalized);

  assert.doesNotMatch(normalized, /&#x20;|\\\\\{/, 'entity spasi dan double-backslash harus dibersihkan');
  assert.equal((out.match(/<img /g) || []).length, 9, 'seluruh ekspresi harus menjadi gambar rumus');
  assert.match(out, /A\. <img/, 'label opsi harus tetap menjadi teks');
  assert.match(out, /dengan domain/, 'frasa domain tidak boleh ikut menjadi LaTeX');
});

test('kalimat biasa yang memuat simbol matematika tidak dibungkus sebagai rumus', () => {
  const prose = String.raw`Peserta didik menggunakan rumus x = 5 untuk memeriksa hasil percobaan.`;
  assert.equal(normalizeMathText(prose), prose);

  const proseWithCommand = String.raw`Guru menjelaskan \frac{1}{2} bagian pizza melalui diskusi kelompok.`;
  assert.equal(normalizeMathText(proseWithCommand), proseWithCommand);
});

test('baris tabel Markdown tidak dirusak oleh normalisasi matematika', () => {
  const row = String.raw`| Nilai x | \frac{1}{2} |`;
  assert.equal(normalizeMathText(row), row);
});

test('environment LaTeX tidak dirender (batasan yang diketahui)', () => {
  // Sengaja dibiarkan apa adanya: renderCodeCogs hanya mendukung
  // \[..\], $$..$$, \(..\), dan $..$. Environment \begin{...} belum
  // ditangani, jadi akan muncul sebagai teks mentah. Prompt ke AI yang
  // menentukan delimiter yang dipakai, bukan renderer.
  const out = renderCodeCogs(String.raw`\begin{equation}a+b\end{equation}`);
  assert.doesNotMatch(out, /<img/);
  assert.match(out, /\\begin\{equation\}/, 'teks mentah tetap terbaca, tidak hilang');
});

test('teks tanpa rumus tidak diubah', () => {
  const plain = 'Ini kalimat biasa tanpa matematika.';
  assert.equal(renderCodeCogs(plain), plain);
});

test('input bukan string ditangani tanpa melempar', () => {
  assert.equal(renderCodeCogs(null), '');
  assert.equal(renderCodeCogs(undefined), '');
  assert.equal(renderCodeCogs(123), '');
  assert.equal(renderCodeCogs(''), '');
});

/**
 * Penting: output renderCodeCogs bisa ikut di-proses lagi di level phase
 * (`container.innerHTML = renderCodeCogs(buildXHTML(...))`) sementara tiap
 * field sudah di-render sendiri lewat html-helpers. Kalau pass kedua mengubah
 * hasil, `<img>` yang sudah jadi bisa rusak atau ter-nested.
 */
test('renderCodeCogs idempoten untuk input yang sudah di-render', () => {
  const once = renderCodeCogs(String.raw`Nilai \(\frac{1}{2}\) dan \(x^2\).`);
  const twice = renderCodeCogs(once);

  assert.equal(
    twice,
    once,
    'pass kedua harus tidak mengubah apa pun — kalau tidak, render ganda merusak hasil'
  );
  assert.equal((twice.match(/<img /g) || []).length, 2, 'kedua gambar harus utuh');
});

test('pass kedua tidak membuat gambar bersarang', () => {
  const once = renderCodeCogs(String.raw`\(a\) dan \(b\)`);
  const twice = renderCodeCogs(once);
  assert.doesNotMatch(twice, /<img[^>]*<img/, 'tidak boleh ada <img> di dalam <img>');
  assert.doesNotMatch(
    twice,
    /<img[^>]*src="[^"]*%3Cimg/i,
    'rumus tidak boleh berisi HTML ter-encode'
  );
});

test('payload rumus ter-encode penuh di URL', () => {
  const out = renderCodeCogs(String.raw`\(x^2\)`);
  const src = out.match(/src="([^"]+)"/)[1];
  assert.ok(!/\\frac/.test(src), 'payload tidak boleh memuat backslash mentah');
  assert.match(src, /%5C/, 'backslash harus ter-encode');
});

test('cleanLaTeX tidak merusak delimiter yang masih dipakai', () => {
  // cleanLaTeX tidak boleh membuang delimiter sebelum renderInfo memakainya.
  const raw = String.raw`\(\frac{1}{2}\)`;
  assert.ok(cleanLaTeX(raw).length > 0, 'hasil cleanLaTeX tidak boleh kosong');
});

test('rumus yang sudah jadi <img> tidak diubah oleh cleanLaTeX', () => {
  const once = renderCodeCogs(String.raw`\(a\)`);
  assert.equal(cleanLaTeX(once), once, 'HTML gambar harus lolos tanpa modifikasi');
});
