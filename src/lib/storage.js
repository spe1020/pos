/**
 * Data lives in localStorage, which means it lives in *this browser on this
 * machine*. It survives refreshes, reboots and closing the laptop. It does not
 * follow you to another browser, and clearing site data wipes it.
 *
 * That's why Backup exists — see exportBackup / importBackup below.
 */

const PREFIX = 'pos:';
const memory = {}; // fallback if localStorage is unavailable (private mode, file://)

const available = (() => {
  try {
    const k = PREFIX + '__probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

export const storageIsPersistent = available;

export function load(key, fallback) {
  const full = PREFIX + key;
  try {
    if (!available) return full in memory ? memory[full] : fallback;
    const raw = window.localStorage.getItem(full);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  const full = PREFIX + key;
  memory[full] = value;
  try {
    if (available) window.localStorage.setItem(full, JSON.stringify(value));
  } catch (err) {
    // Quota exceeded is the realistic failure here — a very long sales history.
    console.warn('Could not save', key, err);
  }
}

export const KEYS = {
  catalog: 'catalog',
  sales: 'sales',
  discounts: 'discounts',
  settings: 'settings',
};

/* ------------------------------ backup ------------------------------ */

export function exportBackup() {
  const payload = {
    format: 'pos-terminal-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    catalog: load(KEYS.catalog, {}),
    sales: load(KEYS.sales, []),
    discounts: load(KEYS.discounts, []),
    settings: load(KEYS.settings, {}),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `register-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (data.format !== 'pos-terminal-backup')
    throw new Error("That file isn't a register backup.");
  return {
    catalog: data.catalog || {},
    sales: Array.isArray(data.sales) ? data.sales : [],
    discounts: Array.isArray(data.discounts) ? data.discounts : [],
    settings: data.settings || {},
  };
}
