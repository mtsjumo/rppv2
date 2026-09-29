// Verifikasi artifact build produksi (dipakai manual + smoke test).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(DIST, 'assets', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(DIST, 'assets', 'style.css'), 'utf8');

const scriptTag = html.match(/<script[^>]*src="\.\/assets\/app\.js"[^>]*>/);
const styleTag = html.match(/<link[^>]*href="\.\/assets\/style\.css"[^>]*>/);

const checks = [
  ['script bundle adalah tag <script> klasik', !!scriptTag && !/type="module"/.test(scriptTag[0])],
  ['script bundle tidak memakai crossorigin', !!scriptTag && !/crossorigin/.test(scriptTag[0])],
  [
    'script bundle memakai path relatif',
    !!scriptTag && /src="\.\/assets\/app\.js"/.test(scriptTag[0]),
  ],
  [
    'stylesheet memakai path relatif',
    !!styleTag && /href="\.\/assets\/style\.css"/.test(styleTag[0]),
  ],
  ['tidak ada handler inline onclick', !/\sonclick\s*=/i.test(html)],
  ['tidak ada blok <style> inline', !/<style[\s>]/i.test(html)],
  ['bundle bukan ESM (tidak ada export)', !/^\s*export\s/m.test(js)],
  ['bundle tidak mengimpor path relatif', !/from\s*["']\.\//.test(js)],
  ['CSS dokumen ikut ter-emit', /\.rpp-document/.test(css)],
  ['CDN docx tetap dirujuk', /docx@8\.5\.0/.test(html)],
  ['sourcemap app.js ada', fs.existsSync(path.join(DIST, 'assets', 'app.js.map'))],
  ['tidak ada file sumber bocor ke dist', !fs.existsSync(path.join(DIST, 'src'))],
];

let ok = true;
for (const [name, pass] of checks) {
  if (!pass) ok = false;
  console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
}
console.log(ok ? '\nARTIFACT OK' : '\nPROBLEMS DITEMUKAN');
process.exit(ok ? 0 : 1);
