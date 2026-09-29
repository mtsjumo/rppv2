/**
 * Perbaikan & render LaTeX.
 *
 * Rumus dirender sebagai gambar SVG lewat CodeCogs supaya aman untuk
 * PDF/print, DOCX, dan export HTML. Fallback: bila CodeCogs gagal/down,
 * `onerror` mengganti <img> dengan teks rumus monospace agar dokumen tetap
 * terbaca.
 */

/**
 * Perbaiki karakter kontrol & perintah LaTeX rusak akibat pelarian JSON.
 * cth. "\neq" di-parse JSON menjadi newline + "eq".
 */
export function cleanLaTeX(s) {
  return (
    String(s)
      // Karakter kontrol yang sebelumnya jadi escape LaTeX asli setelah JSON.parse.
      /* eslint-disable no-control-regex */
      .replace(/\u0008/g, '\\b')
      .replace(/\u0009/g, '\\t')
      .replace(/\u000C/g, '\\f')
      .replace(/\u000D/g, '\\r')
      // Perbaiki perintah \n... yang rusak, cth. \neq terpotong jadi newline + "eq".
      // Daftar: \nabla \neq \neg \newcommand \newline \notin \nmid \not \num \ni
      .replace(/\n\s*(nabla|neq|neg|newcommand|newline|notin|nmid|not|num|ni)\b/g, '\\n$1')
  );
  /* eslint-enable no-control-regex */
}

/**
 * Normalisasi keluaran AI sebelum teks di-escape menjadi HTML.
 *
 * Model kadang mengirim entity spasi, double-backslash dari JSON, atau rumus
 * tanpa delimiter walaupun prompt sudah memintanya. Menambah delimiter di sini
 * membuat semua jalur render (preview, cetak, DOCX, HTML) konsisten.
 */
export function normalizeMathText(value) {
  const normalized = String(value ?? '')
    // Entity ini tidak perlu dipertahankan sebagai HTML; ia hanya menimbulkan
    // teks `&#x20;` ketika output AI sudah lebih dulu di-escape oleh renderer.
    .replace(/(?:&amp;)?&#x0*20;|(?:&amp;)?&#0*32;|&nbsp;/gi, ' ')
    // AI kadang menulis `\\\\frac` atau `\\\\{...\\\\}` di dalam nilai JSON.
    // Satu backslash cukup untuk perintah/delimiter LaTeX.
    .replace(/\\{2,}(?=[A-Za-z{}()[\]])/g, '\\');

  return normalized
    .split(/(\r?\n)/)
    .map((part) => (part === '\n' || part === '\r\n' ? part : wrapBareMathLine(part)))
    .join('');
}

function wrapBareMathLine(line) {
  if (!line.trim() || /\\\(|\\\[|\$/.test(line)) return line;

  const wrap = (formula) => `\\(${formula.trim()}\\)`;
  const option = line.match(/^(\s*[A-Da-d]\.?\s+)(.+)$/);
  if (option && looksLikeMath(option[2])) return `${option[1]}${wrap(option[2])}`;

  // Bentuk umum soal: "f(x) = ... dengan domain x \\neq ...".
  // Render kedua ekspresi tanpa ikut memasukkan frasa Bahasa Indonesia ke LaTeX.
  const domain = line.match(/^(.*?)(\s+dengan\s+domain\s+)(.+)$/i);
  if (domain && looksLikeMath(domain[1]) && looksLikeMath(domain[3])) {
    return `${wrap(domain[1])}${domain[2]}${wrap(domain[3])}`;
  }

  return looksLikeMath(line) ? wrap(line) : line;
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

/**
 * Deteksi apakah potongan `$...$` benar-benar rumus.
 * Menghindari false-positive seperti harga "$5000$" atau singkatan.
 */
export function looksLikeMath(expression) {
  return /\\|[\^_=]/.test(expression) && /[a-zA-Z0-9\\]/.test(expression);
}

const CODECOGS_ENDPOINT = 'https://latex.codecogs.com/svg.image?';

/**
 * Ubah seluruh blok matematika di `text` menjadi <img> CodeCogs.
 * Aman dipanggil pada HTML yang sudah ter-escape.
 */
export function renderCodeCogs(text) {
  if (typeof text !== 'string' || !text) return '';
  let out = cleanLaTeX(text);

  const toImg = (formula, display) => {
    // escapeHtml() sebelumnya sudah mengubah & menjadi &amp; — kembalikan agar rumus utuh
    const f = decodeEntities(cleanLaTeX(String(formula).trim()));
    if (!f) return '';
    const dpi = display ? 150 : 120;
    // SELURUH payload di-encode (sebelumnya prefix \inline \dpi... dibiarkan mentah
    // di URL sehingga sering gagal render).
    const payload = `\\inline \\dpi{${dpi}}${display ? ' \\large' : ''} ${f}`;
    const src = CODECOGS_ENDPOINT + encodeURIComponent(payload);
    const alt = f
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const style = display
      ? 'max-width:100%;'
      : 'display:inline;vertical-align:middle;max-width:100%;';
    const img = `<img src="${src}" alt="${alt}" style="${style}" loading="lazy" onerror="var s=document.createElement('span');s.style.cssText='font-family:monospace;font-size:0.85em;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:2px 6px;word-break:break-all;';s.textContent=this.alt||'rumus';this.replaceWith(s);">`;
    return display
      ? `<div style="text-align:center;margin:8px 0;overflow-x:auto;">${img}</div>`
      : img;
  };

  // Urutan penting: \[...\] dan $$...$$ dulu, baru \(...\), lalu $...$.
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (_, e) => toImg(e, true));
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_, e) => toImg(e, true));
  out = out.replace(/\\\(([\s\S]+?)\\\)/g, (_, e) => toImg(e, false));
  out = out.replace(/(?<!\$)\$([^\n$]+?)\$(?!\$)/g, (_, e) =>
    looksLikeMath(e) ? toImg(e, false) : `$${e}$`
  );
  return out;
}
