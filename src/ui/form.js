/**
 * Form identitas RPP: baca, validasi, dan autosave.
 *
 * Autosave menutup salah satu celah recovery yang complained di audit: kalau
 * tab tertutup setelah mengisi 15 field tapi sebelum klik Generate, semua
 * input hilang. Sekarang draft disimpan (debounced) dan dipulihkan saat app
 * dibuka.
 */

import { $, debounce, scrollIntoViewSafe } from '../core/dom.js';
import { store } from '../core/store.js';
import { STORAGE_KEYS, readJson, writeJson, remove } from '../core/storage.js';
import { showToast } from './toast.js';

const FORM_FIELDS = [
  ['inp-madrasah', 'madrasah'],
  ['inp-mapel', 'mapel'],
  ['inp-materi', 'materi'],
  ['inp-elemen', 'elemen'],
  ['inp-guru', 'guru'],
  ['inp-nuptk', 'nuptk'],
  ['inp-fase', 'fase'],
  ['inp-tahun-pelajaran', 'tahunPelajaran'],
  ['inp-alkok', 'alkok'],
  ['inp-kepsek', 'kepsek'],
  ['inp-kepsek-nuptk', 'kepsekNuptk'],
  ['inp-tempat', 'tempat'],
  ['inp-tanggal', 'tanggal'],
  ['inp-cp', 'cp'],
  ['inp-tp', 'tp'],
  ['inp-atp', 'atp'],
];

/** Field wajib beserta label untuk pesan error. */
const REQUIRED = [
  ['madrasah', 'Nama Madrasah'],
  ['guru', 'Nama Guru'],
  ['mapel', 'Mata Pelajaran'],
  ['fase', 'Fase/Kelas'],
  ['tahunPelajaran', 'Tahun Ajaran'],
  ['alkok', 'Alokasi Waktu'],
  ['kepsek', 'Nama Kepala Madrasah'],
  ['tempat', 'Tempat'],
  ['tanggal', 'Tanggal'],
  ['cp', 'Capaian Pembelajaran'],
  ['tp', 'Tujuan Pembelajaran'],
];

/** Tandai field yang gagal validasi agar pengguna cepat menemukan. */
function markInvalid(key, invalid) {
  const field = FORM_FIELDS.find(([, k]) => k === key);
  if (!field) return;
  const el = $(`#${field[0]}`);
  if (el) el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

/**
 * Baca & validasi form.
 * @returns {object|null} data form, atau null bila ada field wajib kosong
 */
export function collectForm() {
  const form = {};
  for (const [id, key] of FORM_FIELDS) {
    form[key] = $(`#${id}`)?.value?.trim() ?? '';
  }

  for (const [key, label] of REQUIRED) {
    if (!form[key]) {
      markInvalid(key, true);
      const el = $(`#${FORM_FIELDS.find(([, k]) => k === key)?.[0]}`);
      el?.focus();
      scrollIntoViewSafe(el, { behavior: 'smooth', block: 'center' });
      showToast(`❌ "${label}" harus diisi!`, 'error');
      return null;
    }
    markInvalid(key, false);
  }

  store.state.input = form;
  return form;
}

// ---------------------------------------------------------------------------
// Autosave / restore draft
// ---------------------------------------------------------------------------

const saveDraft = debounce(() => {
  const draft = {};
  for (const [id, key] of FORM_FIELDS) {
    const v = $(`#${id}`)?.value?.trim();
    if (v) draft[key] = v;
  }
  if (Object.keys(draft).length) writeJson(STORAGE_KEYS.formDraft, draft);
  else remove(STORAGE_KEYS.formDraft);
}, 600);

/** Tulis nilai draft ke form. */
function fillForm(values) {
  for (const [id, key] of FORM_FIELDS) {
    if (values[key] !== undefined) {
      const el = $(`#${id}`);
      if (el) el.value = values[key];
    }
  }
}

/**
 * Aktifkan autosave + pulihkan draft tersimpan.
 * @returns {boolean} true bila draft dipulihkan
 */
export function initFormAutosave() {
  const form = $('#rpp-form');
  form?.addEventListener('input', () => {
    // Hapus penanda invalid begitu user mengoreksi field.
    const target = form.querySelector('[aria-invalid="true"]');
    if (target && target === document.activeElement) {
      target.setAttribute('aria-invalid', 'false');
    }
    saveDraft();
  });
  form?.addEventListener('change', saveDraft);

  const draft = readJson(STORAGE_KEYS.formDraft, null);
  if (draft && typeof draft === 'object' && Object.keys(draft).length) {
    fillForm(draft);
    return true;
  }
  // Fallback: pulihkan dari checkpoint terakhir yang punya input.
  return restoreFromCheckpoint();
}

function restoreFromCheckpoint() {
  try {
    const checkpoints = readJson(STORAGE_KEYS.checkpoints, []);
    if (!Array.isArray(checkpoints) || !checkpoints.length) return false;
    const latest = checkpoints
      .filter((cp) => cp?.input && Object.keys(cp.input).length)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    if (!latest) return false;
    fillForm(latest.input);
    return true;
  } catch {
    return false;
  }
}

/** Hapus draft tersimpan (dipakai tombol Reset). */
export function clearDraft() {
  saveDraft.cancel();
  remove(STORAGE_KEYS.formDraft);
  saveDraft();
}

/** Kembalikan isi form saat ini sebagai objek. */
export function currentFormValues() {
  const values = {};
  for (const [id, key] of FORM_FIELDS) {
    const v = $(`#${id}`)?.value?.trim();
    if (v) values[key] = v;
  }
  return values;
}

export { FORM_FIELDS };
