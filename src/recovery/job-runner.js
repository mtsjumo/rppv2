/**
 * Job runner yang bisa dilanjutkan (resumable).
 *
 * Berbeda dengan loop `for` biasa, job di sini:
 *   1. menyimpan checkpoint setelah tiap unit sukses,
 *   2. bisa dihentikan (abort) tanpa kehilangan progress yang sudah tercapai,
 *   3. bisa dilanjutkan dari checkpoint terakhir setelah app dimuat ulang,
 *   4. melapor status lewat event sehingga UI (progress bar, banner recovery)
 *      tidak perlu tahu detail retry.
 *
 * Kontrak data: runResumableJob mengembalikan `data` sebagai record
 * `persistKey -> hasil`, bukan objek domain. Orchestrator phase yang memetakan
 * record itu ke bentuk RPP/Modul/Media.
 */

import {
  createCheckpoint,
  describeCheckpoint,
  discardCheckpoint,
  getCheckpoint,
  listResumable,
  markComplete,
  markFailed,
  patchCheckpoint,
  saveCheckpoint,
} from './checkpoint.js';
import { store } from '../core/store.js';
import { emit } from '../core/events.js';
import { classifyError, isRateLimitError } from '../services/ai-client.js';
import { SUBPHASE_ATTEMPTS, SUBPHASE_COOLDOWN_MS, RATE_LIMIT_PRETRY_SECONDS } from '../config.js';
import { sleep } from '../core/dom.js';

export { describeCheckpoint, listResumable, discardCheckpoint, getCheckpoint };

/**
 * @typedef {object} JobUnit
 * @property {string}  id           identifier unik unit
 * @property {string}  label        nama untuk UI
 * @property {string}  [description]
 * @property {string}  [persistKey] key di record `data`; default = id
 * @property {() => Promise<*>} run  menghasilkan data untuk unit ini
 * @property {boolean} [required]   kalau gagal, hentikan seluruh job (default: unit pertama)
 */

/**
 * @typedef {object} JobResult
 * @property {boolean}  completed   semua unit wajib sukses
 * @property {object}   data        record persistKey -> hasil
 * @property {string[]} failed      id unit yang gagal
 * @property {Error|null} error     error fatal
 * @property {boolean}  aborted     dihentikan pengguna
 * @property {string}   checkpointId
 */

/**
 * Jalankan job berisi beberapa unit dengan checkpoint per unit.
 *
 * @param {object} options
 * @param {string} options.phase
 * @param {string} options.label
 * @param {JobUnit[]} options.units
 * @param {object} [options.input]       input form; disalin ke checkpoint
 * @param {string} [options.checkpointId] checkpoint yang dilanjutkan
 * @param {string[]} [options.resumeDone] unit yang sudah selesai di sesi lalu
 * @param {object} [options.resumeData]  data dari checkpoint sebelumnya
 * @param {AbortSignal} [options.signal]
 * @param {(status: object) => void} [options.onStatus]
 * @param {(unit: JobUnit, result: any, data: object) => void} [options.onUnit]
 *     dipanggil tiap unit sukses, agar orchestrator bisa memperbarui konteks
 *     yang dipakai sub-phase berikutnya dalam run yang sama.
 * @returns {Promise<JobResult>}
 */
export async function runResumableJob(options) {
  const {
    phase,
    label,
    units,
    input = {},
    signal,
    onStatus = null,
    onUnit = null,
    resumeDone = [],
    resumeData = {},
    checkpointId = null,
  } = options;

  // Tandai unit pertama sebagai wajib: kalau ini gagal, unit lain tak berguna.
  const unitsWithRequired = units.map((u, i) => ({
    ...u,
    persistKey: u.persistKey || u.id,
    required: u.required ?? i === 0,
  }));

  let cp = checkpointId ? getCheckpoint(checkpointId) : null;
  const isResume = !!cp;

  if (!cp) {
    // Checkpoint harus ada di storage sebelum unit pertama dimulai. Tanpa ini,
    // patchCheckpoint() tidak menemukan record baru dan progress tidak pernah
    // bisa di-resume setelah koneksi atau tab terputus.
    cp = saveCheckpoint(createCheckpoint({ phase, label, total: unitsWithRequired.length, input }));
  } else {
    cp = patchCheckpoint(cp.id, {
      status: 'running',
      lastError: null,
      attempts: (cp.attempts || 1) + 1,
    });
  }

  // Unit yang dianggap sudah selesai: dari sesi ini atau dari checkpoint.
  const doneSet = new Set([...resumeDone, ...(cp.completed || [])]);

  store.state.activeJob = {
    id: cp.id,
    phase,
    label,
    total: unitsWithRequired.length,
    done: doneSet.size,
    startedAt: Date.now(),
    resumed: isResume,
  };
  emit('job:start', { job: { ...store.state.activeJob }, resumed: isResume });

  const data = { ...resumeData };
  const failed = [];
  let fatalError = null;
  let aborted = false;

  const report = (status) => {
    const payload = {
      jobId: cp.id,
      phase,
      done: doneSet.size,
      total: unitsWithRequired.length,
      ...status,
    };
    emit('job:progress', payload);
    if (onStatus) onStatus(payload);
  };

  const persistProgress = () => {
    cp = patchCheckpoint(cp.id, { data, completed: Array.from(doneSet) }) || cp;
  };

  for (let i = 0; i < unitsWithRequired.length; i++) {
    const unit = unitsWithRequired[i];

    if (signal?.aborted) {
      aborted = true;
      break;
    }

    // Sudah selesai di sesi sebelumnya → lewati, data diambil dari resumeData.
    if (doneSet.has(unit.id)) {
      report({ state: 'unit-skipped', unit: unit.id, index: i, label: unit.label });
      continue;
    }

    report({ state: 'unit-start', unit: unit.id, index: i, label: unit.label });

    let unitResult = null;
    let lastError = null;

    for (let attempt = 1; attempt <= SUBPHASE_ATTEMPTS; attempt++) {
      try {
        unitResult = await unit.run({ signal, attempt, checkpointId: cp.id, report });
        lastError = null;
        break;
      } catch (e) {
        if (e?.name === 'AbortError' || signal?.aborted) {
          lastError = e;
          break;
        }
        lastError = e;
        const willRetry = attempt < SUBPHASE_ATTEMPTS;
        report({
          state: willRetry ? 'unit-retry' : 'unit-failed',
          unit: unit.id,
          label: unit.label,
          attempt,
          maxAttempts: SUBPHASE_ATTEMPTS,
          error: e.message,
          kind: classifyError(e),
        });
        if (!willRetry) break;
        if (isRateLimitError(e.message)) {
          report({
            state: 'rate-limit-wait',
            unit: unit.id,
            label: unit.label,
            seconds: RATE_LIMIT_PRETRY_SECONDS,
          });
          await sleep(RATE_LIMIT_PRETRY_SECONDS * 1000);
        } else {
          await sleep(1000 * attempt); // backoff pendek antar percobaan
        }
      }
    }

    if (lastError) {
      failed.push(unit.id);
      if (signal?.aborted || lastError?.name === 'AbortError') {
        aborted = true;
        break;
      }
      if (unit.required) {
        fatalError = lastError;
        break;
      }
      // Unit pelengkap gagal: lewati saja, bisa di-generate ulang terpisah.
      report({ state: 'unit-failed-skipped', unit: unit.id, label: unit.label });
      continue;
    }

    // Sukses → simpan ke checkpoint SEBELUM lanjut ke unit berikutnya.
    data[unit.persistKey] = unitResult;
    doneSet.add(unit.id);
    persistProgress();

    // Beri tahu orchestrator bahwa unit ini sudah punya data final.
    // Ini yang membuat sub-phase berikutnya di run YANG SAMA bisa memakai
    // hasil sub-phase sebelumnya (mis. lampiran butuh RPP Core).
    if (onUnit) {
      try {
        onUnit(unit, unitResult, data);
      } catch {
        // Callback murni untuk pembaruan konteks; kegagalan di sini tidak
        // boleh menggagalkan job yang sudah berhasil.
      }
    }

    report({ state: 'unit-done', unit: unit.id, index: i, label: unit.label });

    if (i < unitsWithRequired.length - 1) {
      report({ state: 'cooldown', unit: unit.id, seconds: SUBPHASE_COOLDOWN_MS / 1000 });
      await sleep(SUBPHASE_COOLDOWN_MS);
    }
  }

  persistProgress();

  const allDone = !fatalError && !aborted && failed.length === 0;

  if (allDone) {
    markComplete(cp.id);
  } else {
    const reason = aborted
      ? 'Generate dibatalkan pengguna'
      : fatalError
        ? fatalError.message
        : `${failed.length} dari ${unitsWithRequired.length} bagian gagal`;
    markFailed(cp.id, new Error(reason));
  }

  const result = {
    completed: allDone,
    data,
    failed,
    error: fatalError,
    aborted,
    checkpointId: cp.id,
    doneCount: doneSet.size,
    total: unitsWithRequired.length,
  };

  store.state.activeJob = null;
  emit('job:end', { jobId: cp.id, phase, ...result });

  return result;
}

/**
 * Konteks lanjutan untuk sebuah phase, atau null bila tidak ada yang perlu
 * dilanjutkan.
 * @param {string} phase
 */
export function getResumeContext(phase) {
  const cp = listResumable().find((c) => c.phase === phase);
  if (!cp) return null;
  return {
    checkpoint: cp,
    summary: describeCheckpoint(cp),
    data: cp.data || {},
    completed: cp.completed || [],
    input: cp.input || {},
  };
}

/** Buang semua checkpoint sebuah phase. */
export function clearCheckpointFor(phase) {
  for (const cp of listResumable()) {
    if (cp.phase === phase) discardCheckpoint(cp.id);
  }
}
