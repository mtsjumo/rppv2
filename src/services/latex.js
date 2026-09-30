/**
 * Perbaikan & render LaTeX.
 *
 * Prinsip render: rumus dipakai HANYA bila perlu, tetapi tidak pernah dibuang.
 *   - Rumus sederhana (pangkat/indeks ringan, satuan, ×, ≤, →, huruf Yunani,
 *     H₂O, m², dst.) ditulis sebagai teks Unicode. Lebih tajam saat dicetak,
 *     tidak butuh internet, dan ikut ter-copy ke DOCX sebagai teks biasa.
 *   - Rumus struktural (pecahan, akar, sigma/integral, matriks, persamaan
 *     bertingkat) dirender sebagai gambar SVG lewat CodeCogs.
 *   - Rumus display `\[...\]` / `$$...$$` selalu gambar (penulis memang
 *     menghendaki tampilan tersendiri).
 *   - Fallback bila CodeCogs gagal/down: `onerror` mengganti <img> dengan
 *     versi teks yang terbaca (mis. `(1)/(2)`, `√(x)`), bukan LaTeX mentah.
 */

import { GREEK, KNOWN_COMMANDS, STRUCTURAL_RE, SYMBOLS } from './latex-commands.js';

// ---------------------------------------------------------------------------
// Perbaikan karakter kontrol akibat pelarian JSON
// ---------------------------------------------------------------------------

/**
 * Perbaiki perintah LaTeX yang rusak akibat pelarian JSON.
 *
 * `JSON.parse` mengubah `\frac` menjadi form-feed + "rac", `\times` menjadi tab
 * + "imes", `\neq` menjadi baris baru + "eq", dst. Karakter kontrol itu hanya
 * dikembalikan menjadi backslash bila yang mengikutinya memang membentuk
 * perintah LaTeX — tab, CR, dan baris baru biasa dalam teks TIDAK disentuh.
 */
export function cleanLaTeX(s) {
  /* eslint-disable no-control-regex */
  return (
    String(s)
      // Backspace & form-feed tidak pernah sah di dalam teks pembelajaran.
      .replace(/\u0008/g, '\\b')
      .replace(/\u000C/g, '\\f')
      // \t : \times \theta \text \textbf \textit \tau \tilde \tan \tanh \triangle \therefore \tfrac \top \to
      .replace(
        /\u0009(?=(?:imes|heta|extbf|extit|ext|au|ilde|anh|an|riangle|herefore|frac|op|o)(?![A-Za-z]))/g,
        '\\t'
      )
      // \r : \rightarrow \right \rho \rangle \rceil \rfloor \rm
      .replace(/\u000D(?=(?:ightarrow|ight|ho|angle|ceil|floor|m)(?![A-Za-z]))/g, '\\r')
      // \n : \nabla \neq \neg \newcommand \newline \notin \nmid \not \num \ni \nu \nleq ...
      .replace(
        /\n\s*(nabla|neq|neg|newcommand|newline|notin|nmid|not|num|ni|nu|nleq|ngeq|nless|ngtr|nsim|nsubseteq|nexists|nrightarrow|nleftarrow|nRightarrow|nparallel|ne)(?![A-Za-z])/g,
        '\\n$1'
      )
  );
  /* eslint-enable no-control-regex */
}

// ---------------------------------------------------------------------------
// Normalisasi teks sebelum di-escape
// ---------------------------------------------------------------------------

/**
 * Normalisasi keluaran AI sebelum teks di-escape menjadi HTML.
 *
 * Model kadang mengirim entity spasi, double-backslash dari JSON, atau rumus
 * tanpa delimiter walaupun prompt sudah memintanya. Menambah delimiter di sini
 * membuat semua jalur render (preview, cetak, DOCX, HTML) konsisten.
 */
export function normalizeMathText(value) {
  const normalized = cleanLaTeX(String(value ?? ''))
    // CR tersisa (akhir baris gaya Windows) bukan bagian rumus.
    .replace(/\r\n?/g, '\n')
    // Entity ini tidak perlu dipertahankan sebagai HTML; ia hanya menimbulkan
    // teks `&#x20;` ketika output AI sudah lebih dulu di-escape oleh renderer.
    .replace(/(?:&amp;)?&#x0*20;|(?:&amp;)?&#0*32;|&nbsp;/gi, ' ')
    // AI kadang menulis `\\frac` atau `\\{...\\}` di dalam nilai JSON. Satu
    // backslash cukup — tetapi `\\` sebagai pemisah baris (mis. di matriks)
    // dibiarkan: hanya dikurangi bila diikuti perintah dikenal atau kurung.
    .replace(/\\{2,}(?=([A-Za-z]+)|[{}()[\]|])/g, (m, run) =>
      run !== undefined && !KNOWN_COMMANDS.has(run) ? m : '\\'
    );

  return normalized
    .split(/(\n)/)
    .map((part) => (part === '\n' ? part : wrapBareMathLine(part)))
    .join('');
}

function wrapBareMathLine(line) {
  // Baris tabel Markdown diproses oleh richText(). Jangan menyisipkan
  // delimiter di sini karena itu akan merusak pemisah `|` antar sel.
  if (!line.trim() || line.includes('|') || /\\\(|\\\[|\$/.test(line)) return line;

  const wrap = (formula) => `\\(${formula.trim()}\\)`;
  const option = line.match(/^(\s*[A-Da-d]\.?\s+)(.+)$/);
  if (option && isBareMathExpression(option[2])) return `${option[1]}${wrap(option[2])}`;

  // Bentuk umum soal: "f(x) = ... dengan domain x \neq ...".
  // Render kedua ekspresi tanpa ikut memasukkan frasa Bahasa Indonesia ke LaTeX.
  const domain = line.match(/^(.*?)(\s+dengan\s+domain\s+)(.+)$/i);
  if (domain && isBareMathExpression(domain[1]) && isBareMathExpression(domain[3])) {
    return `${wrap(domain[1])}${domain[2]}${wrap(domain[3])}`;
  }

  return isBareMathExpression(line) ? wrap(line) : line;
}

/**
 * Auto-wrap hanya untuk satu baris yang seluruhnya adalah matematika.
 * Satu tanda `=` atau `\frac` di dalam kalimat biasa bukan alasan untuk
 * mengubah seluruh kalimat menjadi rumus.
 */
function isBareMathExpression(value) {
  const expression = String(value).trim();
  if (!looksLikeMath(expression)) return false;

  // Buang perintah dan simbol matematika, lalu tolak bila masih tersisa kata
  // natural yang cukup panjang. Nama perintah LaTeX sendiri sudah dihapus.
  const prose = expression
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[\\{}()[\]^_=+\-*/<>,.0-9\s]/g, ' ')
    .trim();
  return !/[a-zA-Z]{3,}/.test(prose);
}

/** Kebalikan escape HTML — perlu sebelum mengirim payload ke CodeCogs. */
export function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&'); // harus terakhir
}

/** Escape minimal untuk teks/atribut yang kita bangun sendiri. */
function escapeMarkup(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Deteksi apakah potongan `$...$` benar-benar rumus.
 * Menghindari false-positive seperti harga "$5000$" atau singkatan.
 */
export function looksLikeMath(expression) {
  return /\\|[\^_=]/.test(expression) && /[a-zA-Z0-9\\]/.test(expression);
}

// ---------------------------------------------------------------------------
// Rumus → teks Unicode
// ---------------------------------------------------------------------------

const SUPERSCRIPT = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
};

const SUBSCRIPT = {
  0: '₀',
  1: '₁',
  2: '₂',
  3: '₃',
  4: '₄',
  5: '₅',
  6: '₆',
  7: '₇',
  8: '₈',
  9: '₉',
  '+': '₊',
  '-': '₋',
  '−': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
};

/** Pengganti sementara untuk `\{` dan `\}` supaya tak tertukar dengan kurung grup. */
const LBRACE = '\uE000';
const RBRACE = '\uE001';

const FUNCTION_NAMES = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'exp',
  'max',
  'min',
  'gcd',
  'det',
  'dim',
  'deg',
  'arg',
  'mod',
]);

const ESCAPED_CHARS = {
  ',': ' ',
  ';': ' ',
  ':': ' ',
  '!': '',
  ' ': ' ',
  '%': '%',
  _: '_',
  '&': '&',
  '#': '#',
  $: '$',
  '|': '‖',
  '{': LBRACE,
  '}': RBRACE,
  '\\': ' ',
};

/** Properti milik sendiri saja (nama seperti `constructor` bukan perintah LaTeX). */
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Ganti `\perintah` dengan padanan Unicode-nya. `unknown` = ada perintah tak dikenal. */
function replaceCommands(str) {
  let unknown = false;
  const text = String(str).replace(/\\([A-Za-z]+|.)/g, (m, name) => {
    if (own(GREEK, name)) return GREEK[name];
    if (own(SYMBOLS, name)) return SYMBOLS[name];
    if (own(ESCAPED_CHARS, name)) return ESCAPED_CHARS[name];
    if (FUNCTION_NAMES.has(name)) return name;
    if (name === 'sum') return '∑';
    if (name === 'prod') return '∏';
    if (name === 'int') return '∫';
    if (KNOWN_COMMANDS.has(name)) return ''; // perintah tata letak (mis. \big) — abaikan
    unknown = true;
    return name;
  });
  return { text, unknown };
}

function mapScript(body, table) {
  let out = '';
  for (const ch of body.replace(/\s+/g, '')) {
    if (!own(table, ch)) return null;
    out += table[ch];
  }
  return out;
}

/** Ubah `^...` atau `_...` menjadi karakter naik/turun bila semua karakternya punya padanan. */
function convertScripts(s, marker, table, lenient) {
  const re =
    marker === '^'
      ? /\^\s*(?:\{([^{}]*)\}|(\\[A-Za-z]+|[A-Za-z0-9+\-−]))/g
      : /_\s*(?:\{([^{}]*)\}|(\\[A-Za-z]+|[A-Za-z0-9+\-−]))/g;
  let ok = true;
  const out = s.replace(re, (m, group, single) => {
    const { text: body } = replaceCommands(group ?? single);
    const mapped = mapScript(body, table);
    if (mapped !== null) return mapped;
    if (lenient) return `${marker}${body.length > 1 ? `(${body})` : body}`;
    ok = false;
    return m;
  });
  return { out, ok };
}

const bracketIfComplex = (t) => (/^[A-Za-z0-9.,]+$/.test(t.trim()) ? t.trim() : `(${t.trim()})`);

/** Ratakan struktur (pecahan, akar, dll.) menjadi teks linear — hanya untuk fallback yang terbaca. */
function flattenStructures(s) {
  let cur = s;
  for (let i = 0; i < 12; i++) {
    const next = cur
      .replace(
        /\\[dtc]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
        (_, a, b) => `${bracketIfComplex(a)}/${bracketIfComplex(b)}`
      )
      .replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (_, n, x) => `${n}√(${x})`)
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, x) => `√(${x})`)
      .replace(/\\sqrt\s*([A-Za-z0-9])/g, '√$1')
      .replace(
        /\\(?:overline|bar|vec|hat|tilde|overrightarrow|underline|boxed|cancel)\s*\{([^{}]*)\}/g,
        '$1'
      )
      .replace(/\\binom\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, 'C($1, $2)');
    if (next === cur) break;
    cur = next;
  }
  return cur
    .replace(/\\(?:begin|end)\s*\{[^{}]*\}/g, ' ')
    .replace(/\\(?:left|right|big|Big|bigg|Bigg)(?![A-Za-z])\s*/g, '')
    .replace(/\\\\/g, '; ')
    .replace(/&/g, ' ');
}

/**
 * Tulis rumus sebagai teks Unicode.
 *
 * Mode ketat (default) mengembalikan `null` bila rumus tidak bisa ditulis
 * tanpa kehilangan makna (pecahan, akar, sigma, indeks bersusun, dll.) —
 * pemanggil lalu memakai gambar. Mode `lenient` selalu mengembalikan teks
 * terbaca sebagai cadangan bila gambar gagal dimuat.
 *
 * @param {string} formula LaTeX tanpa delimiter
 * @param {{lenient?: boolean}} [opts]
 * @returns {string|null}
 */
export function mathToUnicode(formula, { lenient = false } = {}) {
  let s = String(formula).trim();
  if (!s) return lenient ? '' : null;

  if (STRUCTURAL_RE.test(s) || /\\\\|&/.test(s)) {
    if (!lenient) return null;
    s = flattenStructures(s);
  }

  s = s
    .replace(/\\(?:text|mathrm|textbf|mathbf|textit|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:displaystyle|textstyle)(?![A-Za-z])\s*/g, '')
    .replace(/\^\s*(?:\{\s*\\circ\s*\}|\\circ)/g, '°');

  const sup = convertScripts(s, '^', SUPERSCRIPT, lenient);
  const sub = convertScripts(sup.out, '_', SUBSCRIPT, lenient);
  if (!lenient && (!sup.ok || !sub.ok)) return null;

  const { text, unknown } = replaceCommands(sub.out);
  if (!lenient && unknown) return null;

  let result = text;
  if (!lenient && /[{}^_\\]/.test(result)) return null; // masih ada struktur tak terselesaikan
  if (lenient) result = result.replace(/[{}]/g, '');

  return result.replaceAll(LBRACE, '{').replaceAll(RBRACE, '}').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const CODECOGS_ENDPOINT = 'https://latex.codecogs.com/svg.image?';

const INLINE_TEXT_STYLE =
  "font-family:'Cambria Math','STIX Two Math','Times New Roman',serif;white-space:nowrap;";

/** Potongan `\(`…`\)` yang menelan terlalu banyak teks hampir pasti delimiter yatim. */
const isRunaway = (formula) => formula.length > 600 || /\\[([]/.test(formula);

/**
 * Ubah blok matematika di `text` menjadi teks Unicode (rumus sederhana) atau
 * <img> CodeCogs (rumus struktural). Aman dipanggil pada HTML yang sudah
 * ter-escape, dan idempoten (dipanggil dua kali hasilnya sama).
 */
export function renderCodeCogs(text) {
  if (typeof text !== 'string' || !text) return '';
  let out = cleanLaTeX(text);

  const toImg = (f, display) => {
    const dpi = display ? 150 : 120;
    // SELURUH payload di-encode (sebelumnya prefix \inline \dpi... dibiarkan mentah
    // di URL sehingga sering gagal render).
    const payload = `\\inline \\dpi{${dpi}}${display ? ' \\large' : ''} ${f}`;
    const src = CODECOGS_ENDPOINT + encodeURIComponent(payload);
    // alt = teks terbaca; itulah yang tampil bila gambar gagal dimuat.
    const alt = escapeMarkup(mathToUnicode(f, { lenient: true }) || f);
    const style = display
      ? 'max-width:100%;'
      : 'display:inline;vertical-align:middle;max-width:100%;';
    const img = `<img src="${src}" alt="${alt}" style="${style}" loading="lazy" onerror="var s=document.createElement('span');s.style.cssText='font-family:serif;font-size:0.95em;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:2px 6px;';s.textContent=this.alt||'rumus';this.replaceWith(s);">`;
    return display
      ? `<div style="text-align:center;margin:8px 0;overflow-x:auto;">${img}</div>`
      : img;
  };

  const renderFormula = (formula, display) => {
    // escapeHtml() sebelumnya sudah mengubah & menjadi &amp; — kembalikan agar rumus utuh.
    const f = decodeEntities(cleanLaTeX(String(formula).trim())).replace(/\s*\n\s*/g, ' ');
    if (!f) return '';
    if (!display) {
      const plain = mathToUnicode(f);
      if (plain !== null) {
        return `<span class="math-inline" style="${INLINE_TEXT_STYLE}">${escapeMarkup(plain)}</span>`;
      }
    }
    return toImg(f, display);
  };

  // Urutan penting: \[...\] dan $$...$$ dulu, baru \(...\), lalu $...$.
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (m, e) => (isRunaway(e) ? m : renderFormula(e, true)));
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (m, e) => (isRunaway(e) ? m : renderFormula(e, true)));
  out = out.replace(/\\\(([\s\S]+?)\\\)/g, (m, e) => (isRunaway(e) ? m : renderFormula(e, false)));
  // `$...$` paling ambigu (harga, tag HTML): wajib terlihat seperti rumus, tanpa
  // tag di dalamnya, dan tanpa spasi tepat di dalam kedua `$` (aturan TeX).
  out = out.replace(/(?<!\$)\$([^\n$]+?)\$(?!\$)/g, (m, e) =>
    !/[<>]/.test(e) && !/^\s|\s$/.test(e) && looksLikeMath(e) ? renderFormula(e, false) : m
  );
  return out;
}
