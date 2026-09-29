/**
 * Klien AI provider (OpenRouter & Poolside, OpenAI-compatible).
 *
 * Tanggung jawab modul ini murni: satu permintaan chat completion, dengan
 * timeout, retry rate-limit, dan normalisasi berbagai bentuk respons antar
 * model. Orquestrasi multi-model ada di `ai-client.js`.
 */

import { store } from '../core/store.js';
import { friendlyError } from './json.js';
import { OPENROUTER_BASE, POOLSIDE_BASE, REQUEST_TIMEOUT_MS } from '../config.js';
import { emit } from '../core/events.js';

export { friendlyError };

/**
 * Bungkus URL dengan CORS proxy bila dikonfigurasi.
 * Poolside tidak mengirim header CORS sehingga browser memblokir fetch langsung.
 * @param {string} url
 * @returns {string}
 */
export function withCorsProxy(url) {
  const proxy = (store.state.settings.corsProxy || '').trim();
  if (!proxy) return url;
  if (proxy.includes('{url}')) return proxy.replace('{url}', encodeURIComponent(url));
  return proxy + encodeURIComponent(url);
}

/** Provider aktif. */
export function currentProvider() {
  return store.state.settings.provider || 'openrouter';
}

/** API key untuk provider aktif. */
export function currentApiKey() {
  const s = store.state.settings;
  return currentProvider() === 'poolside' ? s.poolsideKey || '' : s.openRouterKey || s.apiKey || '';
}

/** Pesan error bila key belum diisi. */
function missingKeyMessage() {
  return currentProvider() === 'poolside'
    ? 'Poolside API Key belum diisi. Buka ⚙️ Pengaturan, pilih provider Poolside.'
    : 'API Key belum diisi. Buka ⚙️ Pengaturan.';
}

/**
 * Satu panggilan chat completion.
 *
 * @param {string} model
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} [timeoutMs]
 * @param {number} [maxTokens]
 * @returns {Promise<string>} konten teks dari model
 */
export async function callAIProvider(
  model,
  messages,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxTokens = 8000
) {
  const provider = currentProvider();
  const key = currentApiKey();
  if (!key) throw new Error(missingKeyMessage());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isPoolside = provider === 'poolside';
    let url = isPoolside
      ? `${POOLSIDE_BASE}/chat/completions`
      : `${OPENROUTER_BASE}/chat/completions`;
    if (isPoolside) url = withCorsProxy(url);

    const headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    if (!isPoolside) {
      headers['HTTP-Referer'] = window.location.origin || 'https://rpp-generator.github.io';
      headers['X-Title'] = 'AI RPP Generator';
    }

    const body = { model, messages, temperature: 0.3, max_tokens: maxTokens };
    // response_format & top_p hanya didukung OpenRouter — Poolside mengandalkan
    // instruksi JSON + extractJSON().
    if (!isPoolside) {
      body.response_format = { type: 'json_object' };
      body.top_p = 0.9;
    }

    emit('ai:request', { model, provider, phase: messages?.[0]?.meta?.phase });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err.error?.message || err.message || `HTTP ${res.status}: ${res.statusText}`;
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    const data = await res.json();
    emit('ai:response', { model, provider });

    return extractContent(data);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ambil konten teks dari berbagai bentuk respons yang dipakai model berbeda.
 * - string biasa
 * - array of content parts (OpenAI vision/part format)
 * - `reasoning_content` (model reasoning/agentic, cth. Laguna) saat `content` kosong
 */
function extractContent(data) {
  const msgObj = data.choices?.[0]?.message || data.choices?.[0]?.text || {};
  let content = msgObj.content ?? data.output_text;

  if (!content && typeof msgObj.reasoning_content === 'string' && msgObj.reasoning_content.trim()) {
    content = msgObj.reasoning_content;
  }
  if (Array.isArray(content)) {
    content = content
      .map((part) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('');
  }
  if (!content) {
    console.error('[ai] Respons tanpa content, dump:', data);
    throw new Error('AI mengembalikan konten kosong');
  }
  return String(content);
}

/**
 * Daftar model yang akan dicoba berurutan (utama → fallback).
 * Poolside hanya punya satu model; tidak ada fallback lintas provider.
 * @returns {string[]}
 */
export function candidateModels() {
  const s = store.state.settings;
  if (currentProvider() === 'poolside') {
    return [s.poolsideModel || 'poolside/laguna-s-2.1'];
  }
  const models = [];
  if (s.model) models.push(s.model);
  const fallback = s.fallbackModel || 'openrouter/free';
  if (fallback && fallback !== s.model) models.push(fallback);
  return models.length ? models : ['openrouter/free'];
}

/** Nama model yang enak dibaca untuk ditampilkan. */
export function prettyModelName(model) {
  return String(model || '')
    .split('/')
    .pop()
    .replace(/:free$/, '');
}
