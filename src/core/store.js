/**
 * Store status aplikasi (pengganti object APP monolitik).
 *
 * Sifat:
 *  - `state` adalah objek biasa yang bisa dibaca langsung ( ergonomic, tanpa
 *    ceremony) — semua modul memakai `store.state.x`.
 *  - Perubahan state tetap memicu event lewat `store.setState()` supaya UI bisa
 *    bereaksi tanpa saling memanggil.
 */

import { emit } from './events.js';
import { DEFAULT_WORKER_URL } from '../config.js';

const initialSettings = {
  provider: 'openrouter',
  apiKey: '', // alias lama (OpenRouter) — dipertahankan untuk kompatibilitas
  openRouterKey: '',
  poolsideKey: '',
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  customModel: '',
  fallbackModel: 'openrouter/free',
  poolsideModel: 'poolside/laguna-s-2.1',
  corsProxy: DEFAULT_WORKER_URL,
};

const state = {
  settings: { ...initialSettings },
  input: {},
  phase1: null,
  phase2: null,
  phase3: null,
  currentStep: 0,
  /** Status tiap phase: 'idle' | 'running' | 'success' | 'error' | 'partial' */
  phaseStatus: { 1: 'idle', 2: 'idle', 3: 'idle' },
  /** Laporan validasi tiap phase (issues + ringkasan kognitif). */
  phaseReports: { 1: null, 2: null, 3: null },
  /** Job generate yang sedang berjalan (lihat recovery/job-runner.js). */
  activeJob: null,
  /** Error terakhir — untuk diagnostik di console tanpa reload. */
  lastError: null,
  _busy: {},
};

export const store = {
  state,

  get(key) {
    return state[key];
  },

  /**
   * Update state dan memancing event bila ada perubahan.
   * @param {Partial<typeof state>} patch
   * @param {string} [event] nama event yang di-emit (default 'change')
   */
  setState(patch, event = 'change') {
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (state[k] !== v) {
        state[k] = v;
        changed = true;
      }
    }
    if (changed) emit(event, state);
    return changed;
  },

  /** Set satu field numerik/objek di dalam state (mutasi dalam-place). */
  setPhase(phase, data) {
    state[phase] = data;
    emit('change', state);
  },

  resetPhases() {
    state.phase1 = null;
    state.phase2 = null;
    state.phase3 = null;
    state.phaseStatus = { 1: 'idle', 2: 'idle', 3: 'idle' };
    state.phaseReports = { 1: null, 2: null, 3: null };
    emit('change', state);
  },

  /** Reset penuh (dipakai tombol ↺ Reset). */
  resetAll() {
    state.input = {};
    state.currentStep = 0;
    state.lastError = null;
    state.activeJob = null;
    this.resetPhases();
  },

  /** Semua phase sudah ter-generate? */
  allPhasesReady() {
    return !!(state.phase1 && state.phase2 && state.phase3);
  },
};

export { initialSettings };
