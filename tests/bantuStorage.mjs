/** localStorage dengan injeksi kegagalan untuk uji penyimpanan. */
export function storageMemori(awal = []) {
  const values = new Map(awal);
  return {
    values,
    gagalBaca: false,
    gagalTulis: false,
    gagalHapus: false,
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) {
      if (this.gagalBaca) throw new DOMException("blocked", "SecurityError");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.gagalTulis) throw new DOMException("full", "QuotaExceededError");
      values.set(key, String(value));
    },
    removeItem(key) {
      if (this.gagalHapus) throw new DOMException("blocked", "SecurityError");
      values.delete(key);
    },
  };
}
