/**
 * Orkestrasi pemanggilan AI: model fallback, retry JSON, rate-limit backoff,
 * dan completion retry bila hasil belum lengkap.
 *
 * Semua modul ini murni terhadap DOM — umpan balik UI lewat event.
 */

import { store } from '../core/store.js';
import { emit } from '../core/events.js';
import { sleep } from '../core/dom.js';
import { extractJSON, validatePhaseJSON, friendlyError } from './json.js';
import {
  callAIProvider as rawCallAIProvider,
  candidateModels,
  prettyModelName,
  currentProvider,
} from './ai-provider.js';
import { REQUEST_TIMEOUT_MS, RATE_LIMIT_BACKOFF_SECONDS } from '../config.js';

/** Umpan balik generik bila checker tidak menyediakan yang spesifik. */
const DEFAULT_COMPLETION_FEEDBACK =
  'Perbaiki dan kembalikan JSON LENGKAP dengan struktur SAMA, penuhi semua jumlah minimum yang diminta di instruksi sebelumnya. Output HANYA JSON, mulai dengan { dan akhiri dengan }.';

// Re-export supaya konsumen cukup mengimpor dari satu modul.
export { friendlyError };

/** Deteksi rate-limit sementara yang layak dicoba ulang. */
export function isRateLimitError(message) {
  return /429|too many|rate[\s_-]?limit/i.test(String(message || ''));
}

/** Deteksi error yang tidak akan hilang dengan mencoba ulang. */
export function isFatalError(error) {
  const msg = String(error?.message || '');
  if (isRateLimitError(msg)) return false;
  return /api[ _-]?key|unauthorized|403|401|authentication|insufficient credits|quota/i.test(msg);
}

/** Klasifikasi error untuk pesan yang tepat sasaran ke pengguna. */
export function classifyError(error) {
  const msg = String(error?.message || '');
  if (/quota|insufficient credits/i.test(msg)) return 'quota';
  if (isRateLimitError(msg)) return 'rate-limit';
  if (/timeout|aborted|etimedout/i.test(msg)) return 'timeout';
  if (/failed to fetch|network|load failed|cors/i.test(msg)) return 'network';
  if (/api[ _-]?key|unauthorized|403|401|authentication/i.test(msg)) return 'auth';
  if (/json/i.test(msg)) return 'invalid-json';
  if (error?.status) return 'http';
  return 'unknown';
}

/**
 * Generate satu unit kerja dengan seluruh strategi pemulihan.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string|number} phaseName untuk pesan UI & tagging checkpoint
 * @param {object} [opts]
 * @param {number} [opts.maxTokens]
 * @param {(json: object) => {ok: boolean, issues: string[]}} [opts.checkCompleteness]
 * @param {AbortSignal} [opts.signal] batalkan generate bila user menekan Batal
 * @param {(status: object) => void} [opts.onStatus] laporan progres detail
 * @returns {Promise<{data: object, meta: object}>}
 */
export async function generateWithFallback(systemPrompt, userPrompt, phaseName, opts = {}) {
  const { maxTokens = 8000, checkCompleteness = null, signal = null, onStatus = null } = opts;
  const provider = currentProvider();
  const models = candidateModels();
  const phaseKey = String(phaseName);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let lastError = null;
  let rateRetried = false;

  const report = (status) => {
    emit('ai:progress', { phase: phaseKey, ...status });
    if (onStatus) onStatus({ phase: phaseKey, ...status });
  };

  const assertNotAborted = () => {
    if (signal?.aborted) {
      const err = new Error('Generate dibatalkan pengguna');
      err.name = 'AbortError';
      throw err;
    }
  };

  // Bungkus panggilan provider: teruskan sinyal batal (fetch yang sedang jalan
  // ikut di-abort) dan laporkan progres streaming ke UI. Nama sengaja sama
  // dengan fungsi aslinya agar seluruh pemanggilan di bawah otomatis memakainya.
  const callAIProvider = (model, msgs, timeoutMs, tokens) =>
    rawCallAIProvider(model, msgs, timeoutMs, tokens, {
      signal,
      onProgress: ({ chars, thinking }) =>
        report({ state: 'streaming', model, label: prettyModelName(model), chars, thinking }),
    });

  const jsonRetryMessages = (content) => [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
    { role: 'assistant', content },
    {
      role: 'user',
      content:
        'Response di atas bukan JSON valid. Kembalikan HANYA JSON sesuai struktur yang diminta, tanpa teks apapun di luar JSON. Mulai langsung dengan { dan akhiri dengan }.',
    },
  ];

  for (const model of models) {
    try {
      assertNotAborted();

      report({ state: 'calling', model, label: prettyModelName(model), provider });
      const content = await callAIProvider(model, messages, REQUEST_TIMEOUT_MS, maxTokens);

      assertNotAborted();

      // --- Retry 1: paksa JSON valid -----------------------------------
      let json = extractJSON(content);
      if (!json) {
        report({ state: 'json-retry', model, label: prettyModelName(model) });
        const retryContent = await callAIProvider(
          model,
          jsonRetryMessages(content),
          REQUEST_TIMEOUT_MS,
          maxTokens
        );
        json = extractJSON(retryContent);
      }
      if (!json) throw new Error('AI tidak menghasilkan JSON yang valid');

      let validated = validatePhaseJSON(json, phaseKey);

      // --- Completion retry: hasil kurang lengkap ---------------------
      let completionAttempts = 0;
      let check = null;
      if (checkCompleteness) {
        check = checkCompleteness(validated);
        if (!check.ok) {
          console.warn(`[ai] Kelengkapan kurang (phase ${phaseKey}):`, check.issues);
          report({
            state: 'completing',
            model,
            label: prettyModelName(model),
            issues: check.issues,
          });

          // Maks 2x percobaan melengkapi — model gratis sering macet di sini.
          for (let attempt = 0; attempt < 2 && !check.ok; attempt++) {
            completionAttempts++;
            assertNotAborted();
            try {
              const fixContent = await callAIProvider(
                model,
                [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                  { role: 'assistant', content: JSON.stringify(validated) },
                  {
                    role: 'user',
                    content: `Hasil di atas BELUM lengkap. Masalah: ${check.issues.join(
                      '; '
                    )}.\n${check.feedback || DEFAULT_COMPLETION_FEEDBACK}`,
                  },
                ],
                REQUEST_TIMEOUT_MS,
                maxTokens
              );
              const fixJson = extractJSON(fixContent);
              if (!fixJson) break;
              const fixValidated = validatePhaseJSON(fixJson, phaseKey);
              const second = checkCompleteness(fixValidated);
              if (second.ok) {
                validated = fixValidated;
                check = second;
                break;
              }
              // Terima hasil baru hanya kalau memang lebih lengkap.
              if (JSON.stringify(fixValidated).length > JSON.stringify(validated).length) {
                validated = fixValidated;
                check = second;
              }
            } catch (fixErr) {
              console.warn('[ai] Gagal melengkapi, pakai hasil awal:', fixErr.message);
              break;
            }
          }
        }
      }

      const warnings = check?.warnings ?? [];
      if (warnings.length) {
        console.warn(`[ai] Peringatan kualitas (phase ${phaseKey}):`, warnings);
      }

      report({ state: 'done', model, label: prettyModelName(model) });
      return {
        data: validated,
        meta: {
          phase: phaseKey,
          model,
          provider,
          completionAttempts,
          warnings,
          issues: check?.issues ?? [],
        },
      };
    } catch (e) {
      assertNotAborted();
      lastError = e;

      // Rate-limit: jeda, lalu coba model yang sama tepat 1x.
      if (isRateLimitError(e.message) && !rateRetried) {
        rateRetried = true;
        report({
          state: 'rate-limited',
          model,
          label: prettyModelName(model),
          seconds: RATE_LIMIT_BACKOFF_SECONDS,
        });
        await sleep(RATE_LIMIT_BACKOFF_SECONDS * 1000);
        try {
          report({ state: 'calling', model, label: prettyModelName(model), retry: true });
          const content2 = await callAIProvider(model, messages, REQUEST_TIMEOUT_MS, maxTokens);
          const json2 = extractJSON(content2);
          if (!json2) throw new Error('AI tidak menghasilkan JSON yang valid');
          return {
            data: validatePhaseJSON(json2, phaseKey),
            meta: {
              phase: phaseKey,
              model,
              provider,
              completionAttempts: 0,
              warnings: [],
              retriedAfterRateLimit: true,
            },
          };
        } catch (e2) {
          lastError = e2;
        }
      }

      console.warn(`[ai] Model ${model} gagal:`, e.message);
      if (isFatalError(e)) {
        // Tidak akan membaik dengan ganti model — hentikan di sini.
        break;
      }
      if (model !== models[models.length - 1]) {
        report({
          state: 'falling-back',
          model,
          label: prettyModelName(model),
          message: friendlyError(e.message),
        });
      }
    }
  }

  const finalError =
    lastError || new Error('Semua model gagal. Cek API Key/provider di ⚙️ Pengaturan.');
  // Simpan error asli agar bisa dilihat di Console tanpa reload.
  store.state.lastError = {
    phase: phaseKey,
    kind: classifyError(finalError),
    message: finalError.message,
    time: new Date().toISOString(),
  };
  console.error(`[ai] Phase ${phaseKey} gagal:`, finalError.message);
  throw finalError;
}
