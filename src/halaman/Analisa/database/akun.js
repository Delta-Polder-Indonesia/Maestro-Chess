/**
 * Operasi tingkat akun yang menyentuh banyak baris sekaligus: menggabungkan
 * nama pemain dalam satu koleksi dan mengosongkan seluruh basis data.
 *
 * Dependensi: `./migrasi.js` (koneksi, store, cadangan) dan bus revisi dari
 * `./revisiBasis.js`. Kode dipindahkan apa adanya dari `basisData.js`.
 */
import {
  STORE_PARTAI,
  STORE_KOLEKSI,
  memoriPartai,
  bukaDB,
  simpanFallbackKeStorage,
  hapusSeluruhFallback,
  indexedDBGagalDibuka,
} from "./migrasi.js";
import { naikkanRevisi } from "./revisiBasis.js";
import { denganKunciAkun } from "../akun/koordinasiAkun.js";

/**
 * Gabungkan dua pemain dalam satu koleksi: semua partai yang memakai nama
 * `namaAsli` (baik di baris putih maupun hitam) diganti menjadi `namaTujuan`.
 * Teks PGN ikut diselaraskan pada header `[White "…"]` / `[Black "…"]` agar
 * konsisten saat dianalisa / diekspor. ID partai sengaja dipertahankan agar
 * tidak mengubah kunci utama dan tidak menciptakan duplikat baru.
 *
 * @param {string} koleksiId koleksi tempat nama pemain digabungkan.
 * @param {string} namaAsli nama pemain yang akan diganti.
 * @param {string} namaTujuan nama pemain pengganti (tujuan penggabungan).
 * @returns {Promise<{diubah: number, nama: string}>}
 */
export async function gabungkanPemain(koleksiId, namaAsliRaw, namaTujuanRaw, { terkunci = false } = {}) {
  if (!terkunci) return denganKunciAkun(() => gabungkanPemain(koleksiId, namaAsliRaw, namaTujuanRaw, { terkunci: true }));
  const asli = String(namaAsliRaw || "").trim();
  const tujuan = String(namaTujuanRaw || "").trim();
  if (!koleksiId || !asli || !tujuan) return { diubah: 0, nama: "" };

  const cocokNama = (nama) => String(nama || "").trim().toLowerCase() === asli.toLowerCase();

  /** Ganti hanya header `[White "…"]` / `[Black "…"]` pada baris PGN. */
  function gantiTag(pgn, tag) {
    return String(pgn || "")
      .split("\n")
      .map((baris) => {
        const m = new RegExp(`^\\[${tag}\\s+"([^"]*)"\\]$`, "i").exec(baris.trim());
        if (m && m[1].trim().toLowerCase() === asli.toLowerCase()) {
          return `[${tag} "${tujuan}"]`;
        }
        return baris;
      })
      .join("\n");
  }
  const selaraskanPgn = (pgn) => gantiTag(gantiTag(pgn, "White"), "Black");

  let diubah = 0;
  const db = await bukaDB({ terkunci: true });

  /* --- Cadangan memori --- */
  if (!db) {
    const ids = [];
    for (const [id, p] of memoriPartai.entries()) {
      if (p.koleksiId === koleksiId && (cocokNama(p.whiteName) || cocokNama(p.blackName))) {
        ids.push(id);
      }
    }
    for (const id of ids) {
      const p = memoriPartai.get(id);
      const baru = { ...p, pgn: selaraskanPgn(p.pgn) };
      if (cocokNama(p.whiteName)) baru.whiteName = tujuan;
      if (cocokNama(p.blackName)) baru.blackName = tujuan;
      memoriPartai.set(id, baru);
      diubah++;
    }
    if (diubah > 0) {
      simpanFallbackKeStorage();
      naikkanRevisi();
    }
    return { diubah, nama: tujuan };
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_PARTAI], "readwrite");
      tx.oncomplete = () => {
        if (diubah > 0) naikkanRevisi();
        resolve({ diubah, nama: tujuan });
      };
      tx.onabort = () => resolve({ diubah: 0, nama: "" });
      tx.onerror = () => resolve({ diubah: 0, nama: "" });
      const store = tx.objectStore(STORE_PARTAI);
      const idx = store.index("koleksiWaktu");
      const BAWAH = -Infinity;
      const ATAS = Infinity;
      const req = idx.openCursor(IDBKeyRange.bound([koleksiId, BAWAH], [koleksiId, ATAS]), "next");

      req.onsuccess = (e) => {
        const kursor = e.target.result;
        if (!kursor) return; // tunggu commit sebelum melepas lock
        const p = kursor.value;
        if (p && (cocokNama(p.whiteName) || cocokNama(p.blackName))) {
          const baru = { ...p, pgn: selaraskanPgn(p.pgn) };
          if (cocokNama(p.whiteName)) baru.whiteName = tujuan;
          if (cocokNama(p.blackName)) baru.blackName = tujuan;
          kursor.update(baru);
          diubah++;
        }
        kursor.continue();
      };
      req.onerror = () => { try { tx.abort(); } catch { /* sudah batal */ } };
    } catch {
      resolve({ diubah: 0, nama: "" });
    }
  });
}

/**
 * Kosongkan seluruh basis data (semua partai & koleksi).
 */
export async function bersihkanBasisData({ terkunci = false } = {}) {
  if (!terkunci) return denganKunciAkun(() => bersihkanBasisData({ terkunci: true }));
  const db = await bukaDB({ terkunci: true });
  if (!db) {
    if (indexedDBGagalDibuka()) return false;
    const bersih = hapusSeluruhFallback();
    if (bersih) naikkanRevisi();
    return bersih;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_PARTAI, STORE_KOLEKSI], "readwrite");
      tx.objectStore(STORE_PARTAI).clear();
      tx.objectStore(STORE_KOLEKSI).clear();
      tx.oncomplete = () => {
        const bersih = hapusSeluruhFallback();
        naikkanRevisi();
        resolve(bersih);
      };
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
