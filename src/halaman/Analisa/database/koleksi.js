/**
 * CRUD koleksi (satu koleksi = satu akun/platform) + ekspor PGN koleksi.
 *
 * Dependensi: `./migrasi.js` (koneksi, store, cadangan), bus revisi dari
 * `./revisiBasis.js`, dan `ambilDaftarPartai` dari `./partai.js` untuk ekspor.
 * Kode dipindahkan apa adanya dari `basisData.js`.
 */
import {
  STORE_PARTAI,
  STORE_KOLEKSI,
  memoriKoleksi,
  bukaDB,
  simpanFallbackKeStorage,
  hapusFallbackKoleksi,
  indexedDBGagalDibuka,
} from "./migrasi.js";
import { naikkanRevisi } from "./revisiBasis.js";
import { akunSedangDihapus, daftarkanOperasiAkun, denganKunciAkun } from "../akun/koordinasiAkun.js";
import { ambilDaftarPartai } from "./partai.js";

/**
 * Pastikan sebuah koleksi akun ada di basis (meski belum ada partai).
 * Dipakai saat user mendaftar akun baru — agar langsung muncul di Database
 * tanpa harus tarik data dulu.
 */
export async function pastikanKoleksi({ platform = "", username = "" } = {}) {
  const plat = String(platform || "").trim();
  const user = String(username || "").trim();
  if (!plat || !user || akunSedangDihapus(plat, user)) return null;
  const operasi = daftarkanOperasiAkun(plat, user);
  try {
    return await denganKunciAkun(() => pastikanKoleksiTerkunci(plat, user, operasi), { signal: operasi.signal });
  } catch (error) {
    if (error?.name === "AbortError") return null;
    throw error;
  } finally {
    operasi.selesai();
  }
}

async function pastikanKoleksiTerkunci(plat, user, operasi) {
  operasi.periksa();
  if (operasi.signal.aborted || akunSedangDihapus(plat, user)) return null;
  const koleksiId = `${plat}:${user.toLowerCase()}`;
  const label = user
    ? `${user} ${plat === "chessCom" ? "Chess.com" : plat === "lichessOrg" ? "Lichess.org" : plat}`
    : plat;

  const db = await bukaDB({ terkunci: true });
  operasi.periksa();
  if (operasi.signal.aborted || akunSedangDihapus(plat, user)) return null;
  if (!db) {
    if (!memoriKoleksi.has(koleksiId)) {
      memoriKoleksi.set(koleksiId, {
        id: koleksiId,
        platform: plat,
        username: user,
        label,
        jumlahPartai: 0,
        terakhirDisinkronkan: Date.now(),
        dibuatPada: Date.now(),
      });
      simpanFallbackKeStorage();
      naikkanRevisi();
    }
    return memoriKoleksi.get(koleksiId) || null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_KOLEKSI], "readwrite");
      const store = tx.objectStore(STORE_KOLEKSI);
      const reqGet = store.get(koleksiId);
      reqGet.onsuccess = () => {
        const ada = reqGet.result;
        if (ada) {
          resolve(ada);
          return;
        }
        const baru = {
          id: koleksiId,
          platform: plat,
          username: user,
          label,
          jumlahPartai: 0,
          terakhirDisinkronkan: Date.now(),
          dibuatPada: Date.now(),
        };
        store.put(baru);
        tx.oncomplete = () => {
          naikkanRevisi();
          resolve(baru);
        };
        tx.onerror = () => resolve(baru);
      };
      reqGet.onerror = () => {
        const baru = {
          id: koleksiId,
          platform: plat,
          username: user,
          label,
          jumlahPartai: 0,
          terakhirDisinkronkan: Date.now(),
          dibuatPada: Date.now(),
        };
        try {
          store.put(baru);
          naikkanRevisi();
        } catch { /* IndexedDB penuh/tutup — data tetap dikirim ke pemanggil */ }
        resolve(baru);
      };
    } catch {
      resolve(null);
    }
  });
}


/**
 * Ambil daftar semua koleksi / akun yang tersimpan di basis data.
 */
export async function ambilSemuaKoleksi() {
  const db = await bukaDB();
  if (!db) {
    return Array.from(memoriKoleksi.values()).sort((a, b) => b.terakhirDisinkronkan - a.terakhirDisinkronkan);
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_KOLEKSI], "readonly");
      const store = tx.objectStore(STORE_KOLEKSI);
      const req = store.getAll();
      req.onsuccess = () => {
        const daftar = Array.isArray(req.result) ? req.result : [];
        daftar.sort((a, b) => (b.terakhirDisinkronkan || 0) - (a.terakhirDisinkronkan || 0));
        resolve(daftar);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Hapus seluruh partai dalam satu koleksi akun.
 */
export async function hapusKoleksi(koleksiId, { terkunci = false, dbTerbuka } = {}) {
  if (!koleksiId) return false;
  if (!terkunci) return denganKunciAkun(() => hapusKoleksi(koleksiId, { terkunci: true }));
  const db = dbTerbuka !== undefined ? dbTerbuka : await bukaDB({ terkunci: true });
  if (!db) {
    // Bila IndexedDB ada tetapi gagal dibuka, mungkin masih ada partai di
    // sana; tidak aman mengaku semuanya terhapus hanya dari cadangan.
    if (indexedDBGagalDibuka() || !hapusFallbackKoleksi(koleksiId)) return false;
    naikkanRevisi();
    return true;
  }

  return new Promise((resolve) => {
    let selesai = false;
    const akhiri = (ok) => {
      if (!selesai) {
        selesai = true;
        resolve(ok);
      }
    };
    let tx;
    const gagal = () => {
      try { tx?.abort(); } catch { /* transaksi sudah batal */ }
      akhiri(false);
    };
    try {
      tx = db.transaction([STORE_PARTAI, STORE_KOLEKSI], "readwrite");
      const storePartai = tx.objectStore(STORE_PARTAI);
      const storeKoleksi = tx.objectStore(STORE_KOLEKSI);

      tx.oncomplete = () => {
        // Data fallback dari sesi lama bisa tetap ada meski IndexedDB kini
        // berfungsi. Bersihkan juga agar tidak muncul kembali atau bocor.
        const cadanganBersih = hapusFallbackKoleksi(koleksiId);
        naikkanRevisi();
        akhiri(cadanganBersih);
      };
      tx.onerror = () => akhiri(false);
      tx.onabort = () => akhiri(false);

      storeKoleksi.delete(koleksiId);

      /* Rekaman lama tanpa timestamp tidak tercakup indeks koleksiWaktu.
       * Pindai kursor store agar penghapusan benar-benar mencakup semuanya,
       * tanpa memuat seluruh PGN ke memori sekaligus lewat getAll(). */
      const req = storePartai.openCursor();
      req.onsuccess = (e) => {
        try {
          const kursor = e.target.result;
          if (!kursor) return; // selesai — tx.oncomplete yang menyelesaikan
          if (kursor.value?.koleksiId === koleksiId) kursor.delete();
          kursor.continue();
        } catch { gagal(); }
      };
      req.onerror = gagal;
    } catch {
      gagal();
    }
  });
}

/**
 * Ekspor semua partai (atau hasil filter) menjadi satu berkas string PGN multi-game.
 */
export async function eksporPgnKoleksi(opsi = {}) {
  const { partai } = await ambilDaftarPartai({ ...opsi, limit: 0 });
  return partai.map((p) => p.pgn.trim()).filter(Boolean).join("\n\n");
}
