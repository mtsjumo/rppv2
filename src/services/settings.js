/**
 * Layanan pengaturan: baca/tulis localStorage, sinkronkan UI, uji API.
 */

import { store, initialSettings } from '../core/store.js';
import { STORAGE_KEYS, readJson, writeJson } from '../core/storage.js';
import { withCorsProxy } from './ai-provider.js';
import { showToast } from '../ui/toast.js';
import { DEFAULT_WORKER_URL, OPENROUTER_BASE, POOLSIDE_BASE } from '../config.js';

/** Muat pengaturan dari localStorage dan terapkan ke state. */
export function loadSettings() {
  const saved = readJson(STORAGE_KEYS.settings, null);
  if (saved && typeof saved === 'object') {
    store.state.settings = { ...initialSettings, ...saved };
    // Migrasi: settings lama hanya punya `apiKey` (OpenRouter) — pertahankan.
    if (store.state.settings.apiKey && !store.state.settings.openRouterKey) {
      store.state.settings.openRouterKey = store.state.settings.apiKey;
    }
  }

  // Default SELALU berlaku, termasuk di origin/profil baru yang belum punya
  // simpanan. (Versi lama hanya menerapkan default bila sudah ada simpanan —
  // itu sebabnya kolom Worker pernah kosong.)
  const s = store.state.settings;
  if (!s.provider) s.provider = 'openrouter';
  if (!s.poolsideModel) s.poolsideModel = 'poolside/laguna-s-2.1';
  if (!s.corsProxy) s.corsProxy = DEFAULT_WORKER_URL;
  if (!s.fallbackModel) s.fallbackModel = 'openrouter/free';
  if (!s.model) s.model = initialSettings.model;

  return s;
}

/** Simpan pengaturan ke localStorage. */
export function persistSettings() {
  return writeJson(STORAGE_KEYS.settings, store.state.settings);
}

/** API key aktif untuk provider aktif. */
export function activeApiKey() {
  const s = store.state.settings;
  return s.provider === 'poolside' ? s.poolsideKey || '' : s.openRouterKey || s.apiKey || '';
}

/**
 * Uji autentikasi ke provider aktif.
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function testConnection() {
  const provider = store.state.settings.provider || 'openrouter';
  const key = activeApiKey();

  if (!key) {
    return {
      ok: false,
      message: provider === 'poolside' ? '❌ Poolside API Key kosong' : '❌ API Key kosong',
    };
  }

  try {
    if (provider === 'poolside') {
      // Poolside OpenAI-compatible: daftar model sebagai uji autentikasi.
      // Catatan: Poolside tidak mengirim header CORS, jadi tanpa proxy browser
      // pasti memblokir.
      const res = await fetch(withCorsProxy(`${POOLSIDE_BASE}/models`), {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        return { ok: true, message: '✅ Poolside: key valid' };
      }
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        message: `❌ ${err.error?.message || err.message || res.statusText}`,
      };
    }

    const res = await fetch(`${OPENROUTER_BASE}/auth/key`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        message: `✅ ${data.data?.label || 'Valid'} | Sisa: ${data.data?.limit_remaining ?? '?'}`,
      };
    }
    const err = await res.json().catch(() => ({}));
    return { ok: false, message: `❌ ${err.error?.message || res.statusText}` };
  } catch (e) {
    const msg = e.message || String(e);
    if (/failed to fetch|load failed|networkerror|network request failed/i.test(msg)) {
      return {
        ok: false,
        message:
          provider === 'poolside' && !(store.state.settings.corsProxy || '').trim()
            ? '⛔ Browser memblokir request (CORS): Poolside tidak mengizinkan panggilan langsung dari browser. Isi Worker / Proxy URL milik sendiri lalu Test lagi.'
            : `❌ Jaringan diblokir: ${msg}`,
      };
    }
    return { ok: false, message: `❌ ${msg}` };
  }
}

/** Simpan pengaturan saat test API berhasil (key baru langsung terpakai). */
export function adoptTestedKey() {
  const s = store.state.settings;
  if (s.provider === 'poolside') {
    s.poolsideKey = s.poolsideKey || '';
  } else {
    s.openRouterKey = s.openRouterKey || s.apiKey || '';
    s.apiKey = s.openRouterKey;
  }
  persistSettings();
}

export { showToast };
