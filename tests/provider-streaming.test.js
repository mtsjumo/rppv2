/**
 * Klien provider: streaming SSE, timeout diam, dan pembatalan.
 *
 * fetch dipalsukan supaya test berjalan offline dan deterministik.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { store } from '../src/core/store.js';
import { callAIProvider } from '../src/services/ai-provider.js';

const encoder = new TextEncoder();

/** Response event-stream dari daftar potongan teks mentah. */
function sseResponse(chunks) {
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const delta = (text) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

function setup(fetchImpl) {
  globalThis.window = { location: { origin: 'https://uji.test' } };
  store.state.settings = {
    ...(store.state.settings || {}),
    provider: 'openrouter',
    openRouterKey: 'sk-or-v1-uji',
  };
  globalThis.fetch = fetchImpl;
}

const MESSAGES = [{ role: 'user', content: 'halo' }];

test('respons streaming digabung utuh dan progres dilaporkan', async () => {
  const seen = [];
  setup(async (_url, init) => {
    assert.equal(JSON.parse(init.body).stream, true, 'permintaan harus meminta stream');
    // Event kedua sengaja terpotong di tengah untuk menguji buffering.
    const second = delta('dunia');
    return sseResponse([
      ': OPENROUTER PROCESSING\n\n',
      delta('{"halo":"'),
      second.slice(0, 20),
      second.slice(20),
      delta('"}'),
      'data: [DONE]\n\n',
    ]);
  });

  const text = await callAIProvider('m', MESSAGES, 1000, 500, {
    onProgress: (p) => seen.push(p.chars),
  });

  assert.equal(text, '{"halo":"dunia"}');
  assert.ok(seen.length >= 1, 'onProgress harus dipanggil');
  assert.equal(seen.at(-1), text.length, 'laporan terakhir harus mencerminkan total karakter');
});

test('server yang mengabaikan stream (JSON biasa) tetap terbaca', async () => {
  setup(async () =>
    Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }, { status: 200 })
  );
  const text = await callAIProvider('m', MESSAGES, 1000, 500, { onProgress: () => {} });
  assert.equal(text, '{"ok":true}');
});

test('tanpa onProgress permintaan tidak meminta stream (perilaku lama)', async () => {
  setup(async (_url, init) => {
    assert.equal(JSON.parse(init.body).stream, undefined);
    return Response.json({ choices: [{ message: { content: 'x' } }] });
  });
  assert.equal(await callAIProvider('m', MESSAGES, 1000, 500), 'x');
});

test('error di tengah stream dilempar dengan pesan provider', async () => {
  setup(async () =>
    sseResponse([delta('a'), `data: ${JSON.stringify({ error: { message: 'kuota habis', code: 402 } })}\n\n`])
  );
  await assert.rejects(
    () => callAIProvider('m', MESSAGES, 1000, 500, { onProgress: () => {} }),
    /kuota habis/
  );
});

test('tidak ada data selama batas diam → error timeout (bukan AbortError)', async () => {
  setup(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      })
  );

  await assert.rejects(
    () => callAIProvider('m', MESSAGES, 50, 500),
    (err) => {
      assert.match(err.message, /timeout/i);
      assert.notEqual(err.name, 'AbortError', 'timeout harus bisa di-retry oleh job runner');
      return true;
    }
  );
});

test('pembatalan pengguna meng-abort fetch yang sedang berjalan', async () => {
  setup(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      })
  );

  const controller = new AbortController();
  const pending = callAIProvider('m', MESSAGES, 5000, 500, { signal: controller.signal });
  setTimeout(() => controller.abort(), 20);

  await assert.rejects(
    () => pending,
    (err) => {
      assert.equal(err.name, 'AbortError');
      assert.match(err.message, /dibatalkan/i);
      return true;
    }
  );
});
