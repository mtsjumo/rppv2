/**
 * Utilitas DOM kecil. Tidak ada framework; cukup selector, event delegation,
 * dan pelarian HTML yang konsisten.
 */

/** @returns {HTMLElement|null} */
export function $(selector, root = document) {
  return root.querySelector(selector);
}

/** @returns {HTMLElement[]} */
export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** Tampilkan/sembunyikan elemen lewat kelas `hidden`. */
export function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', !!hidden);
}

/**
 * `scrollIntoView` yang aman.
 *
 * API ini tidak ada di semua lingkungan (browser lama, beberapa webview
 * tertanam, dan jsdom). Memanggilnya langsung akan melempar TypeError dan
 * menghentikan alur wizard — jadi error-nya ditelan di sini dengan sengaja:
 * menggulir halaman memang bonus, bukan fungsi inti.
 */
export function scrollIntoViewSafe(el, options) {
  try {
    el?.scrollIntoView?.(options);
  } catch {
    // diabaikan — scroll_to_element tidak boleh menggagalkan interaksi
  }
}

/** Tulis teks dengan aman (tidak mengurai HTML). */
export function setText(el, text) {
  if (el) el.textContent = text ?? '';
}

/**
 * Delegated event listener.
 * Satu listener di `root` menangani semua elemen dengan atribut
 * `data-action="nama"`. Ini menggantikan inline `onclick=` di HTML —
 * menjaga markup tetap bersih dan memungkinkan Content-Security-Policy ketat.
 *
 * @param {string} type jenis event, mis. 'click'
 * @param {Record<string, (el: HTMLElement, event: Event) => void>} handlers
 * @param {HTMLElement|Document} [root]
 */
export function delegate(type, handlers, root = document) {
  root.addEventListener(type, (event) => {
    const el = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!el || !root.contains(el)) return;
    const handler = handlers[el.dataset.action];
    if (!handler) return;
    handler(el, event);
  });
}

/** Promise yang tertunda. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Escape HTML — wajib untuk semua data dari AI sebelum masuk innerHTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Unggah-underline blok HTML dari string (untuk teks soal berformat markdown). */
export function unwrap(text, fallback = '') {
  const s = String(text ?? '')
    .replace(/<\/?[^>]+>/g, '')
    .trim();
  return s || fallback;
}

/** Ambil teks pertama dari sebuah kontainer. */
export function textOf(el, fallback = '') {
  return unwrap(el?.textContent, fallback);
}

/** Ambil nilai input/textarea/select berdasarkan id. */
export function inputValue(id) {
  return $(`#${id}`)?.value?.trim() ?? '';
}

/** Daftar semua stylesheet sebagai teks CSS (untuk export HTML mandiri). */
export function collectStylesheetText() {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules || [])
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        // Cross-origin stylesheet (CDN) tidak bisa dibaca — lewati diam-diam.
        return '';
      }
    })
    .join('\n');
}

/** Unduh blob sebagai file. */
export function saveAs(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** Ambil nilai setting dari localStorage untuk penyimpan otomatis form. */
export function debounce(fn, waitMs = 300) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
