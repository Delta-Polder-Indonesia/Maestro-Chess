/**
 * Substrat penyimpanan basis data Analisa (IndexedDB + cadangan localStorage).
 *
 * Bagian ini hanya memuat hal-hal yang berubah BERSAMA ketika bentuk
 * penyimpanan berubah: nama basis, versi skema, nama object store, daftar
 * indeks saat `onupgradeneeded`, koneksi singleton, serta jalur cadangan
 * memori + localStorage ketika IndexedDB tidak bisa dibuka.
 *
 * Sengaja tidak memuat satu pun query/CRUD partai — semuanya ada di
 * `./partai.js`. Modul ini adalah daun: ia tidak mengimpor modul database
 * lain, sehingga tidak ada siklus impor.
 *
 * Pemecahan dari `basisData.js` (Fase 1, murni pemisahan berkas): tidak ada
 * perubahan perilaku, nama store, versi basis, maupun bentuk data.
 */

import { bacaGenerasiAkun, denganKunciAkun, kunciLintasTabTersedia, langgananPenghapusanAkun, penandaMilikAkun } from "../akun/koordinasiAkun.js";
import { perbaikiTanggalImpor } from "./tanggalPgn.js";

const NAMA_DB = "maestro_chess_database_v1";
/*
 * Versi 2 menambah indeks gabungan berakhiran `timestamp`
 * (`platformWaktu`, `usernameWaktu`, `kombinasiWaktu`). Tanpa indeks itu,
 * mengambil "halaman ke-N" berarti membaca SELURUH isi store lebih dulu —
 * ribuan partai berikut teks PGN-nya — lalu membuang 99% hasilnya. Dengan
 * indeks ini kursor bisa langsung melompat ke offset halaman dan hanya
 * membaca sebanyak baris yang ditampilkan.
 */
// Version 3 repairs dates of older PGN imports without changing their IDs.
const VERSI_DB = 3;
const STORE_PARTAI = "partai";
const STORE_KOLEKSI = "koleksi";
const AWALAN_STORAGE = "maestro-analisa-db-";

/* --- Penyimpanan Fallback (Memori + localStorage) --- */
const memoriPartai = new Map();
const memoriKoleksi = new Map();
let masalahIndexedDB = false;

function punyaIndexedDB() {
  try {
    return typeof window !== "undefined" && Boolean(window.indexedDB);
  } catch {
    masalahIndexedDB = true;
    return false;
  }
}

// Satu snapshot atomik mencegah koleksi dan partai berbeda versi ketika
// kuota habis di tengah penulisan. Kunci lama tetap dibaca untuk migrasi.
const KUNCI_SNAPSHOT = AWALAN_STORAGE + "snapshot-v2";
const KUNCI_KOLEKSI_LAMA = AWALAN_STORAGE + "koleksi";
const KUNCI_PARTAI_LAMA = AWALAN_STORAGE + "partai";
// Baseline menyimpan referensi yang sudah ada di snapshot. Perubahan lokal
// yang belum berhasil ditulis tetap dapat digabungkan saat tab lain menulis.
let dasarPartai = new Map();
let dasarKoleksi = new Map();
const generasiMemori = new Map();

function validasiFallback(koleksi, partai) {
  const berId = (item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "string" && item.id.trim();
  if (!Array.isArray(koleksi) || !Array.isArray(partai) ||
    !koleksi.every(berId) || !partai.every((p) => berId(p) && typeof p.koleksiId === "string" && p.koleksiId.trim())) {
    throw new Error("Cadangan tidak valid");
  }
}

function bacaFallback(storage) {
  const mentah = storage.getItem(KUNCI_SNAPSHOT);
  const koleksiLama = storage.getItem(KUNCI_KOLEKSI_LAMA);
  const partaiLama = storage.getItem(KUNCI_PARTAI_LAMA);
  if (mentah !== null) {
    const snapshot = JSON.parse(mentah);
    validasiFallback(snapshot?.koleksi, snapshot?.partai);
    return { ...snapshot, ada: true, warisan: koleksiLama !== null || partaiLama !== null };
  }
  const koleksi = koleksiLama === null ? [] : JSON.parse(koleksiLama);
  const partai = partaiLama === null ? [] : JSON.parse(partaiLama);
  validasiFallback(koleksi, partai);
  return { koleksi, partai, ada: koleksiLama !== null || partaiLama !== null, warisan: koleksiLama !== null || partaiLama !== null };
}

function keadaanKoleksi(id) {
  const i = String(id || "").indexOf(":");
  return i < 0 ? { tersedia: false } : bacaGenerasiAkun(id.slice(0, i), id.slice(i + 1));
}

/**
 * Gabungkan snapshot terkini dengan perubahan lokal yang belum tersimpan.
 * Hanya perbedaan terhadap baseline yang diterapkan kembali, sehingga partai
 * yang sudah dihapus tab lain tidak bangkit dari salinan memori lama.
 */
function sinkronkanFallback() {
  try {
    if (typeof localStorage === "undefined") return false;
    const data = bacaFallback(localStorage);
    const diskPartai = new Map(data.partai.filter((p) => p?.id).map((p) => [p.id, perbaikiTanggalImpor(p)]));
    const diskKoleksi = new Map(data.koleksi.filter((k) => k?.id).map((k) => [k.id, k]));
    const ids = new Set([
      ...generasiMemori.keys(), ...memoriKoleksi.keys(), ...diskKoleksi.keys(),
      ...[...memoriPartai.values(), ...diskPartai.values()].map((p) => p?.koleksiId).filter(Boolean),
    ]);
    const sahLokal = new Map();
    for (const id of ids) {
      const sekarang = keadaanKoleksi(id);
      const lama = generasiMemori.get(id);
      sahLokal.set(id, !sekarang.tersedia || (sekarang.status === "aktif" &&
        (lama === undefined || lama === sekarang.versi || (lama === null && sekarang.versi === "0"))));
      generasiMemori.set(id, sekarang.tersedia ? sekarang.versi : null);
    }

    function gabung(memori, dasar, disk, idKoleksi) {
      const lokal = new Map(memori);
      memori.clear();
      for (const [id, nilai] of disk) memori.set(id, nilai);
      for (const [id, nilai] of lokal) {
        const koleksiId = idKoleksi(nilai);
        if (sahLokal.get(koleksiId) === false) continue;
        if (!dasar.has(id) || dasar.get(id) !== nilai) memori.set(id, nilai);
      }
      for (const [id, nilai] of dasar) {
        if (!lokal.has(id) && sahLokal.get(idKoleksi(nilai)) !== false) memori.delete(id);
      }
    }
    gabung(memoriPartai, dasarPartai, diskPartai, (p) => p?.koleksiId);
    gabung(memoriKoleksi, dasarKoleksi, diskKoleksi, (k) => k?.id);
    dasarPartai = diskPartai;
    dasarKoleksi = diskKoleksi;
    return true;
  } catch {
    // Jangan menimpa cadangan yang gagal dibaca dengan data kosong.
    return false;
  }
}
sinkronkanFallback();
// Setelah penghapusan selesai, buang salinan fallback di memori tab lain
// juga, termasuk perubahan sementara yang belum sempat disimpan.
langgananPenghapusanAkun((status, penanda, versi) => {
  if (status !== "terhapus") return;
  // Event membawa penanda akun sehingga salinan sementara bisa dibersihkan
  // meski getter storage ditolak. Pakai ID koleksi juga untuk rekaman lama
  // yang tidak memiliki platform atau username terpisah.
  const keputusan = new Map();
  const perluDihapus = (id) => {
    if (keputusan.has(id)) return keputusan.get(id);
    const i = String(id || "").indexOf(":");
    let hapus = false;
    if (i >= 0 && penandaMilikAkun(id.slice(0, i), id.slice(i + 1), penanda)) {
      const sekarang = keadaanKoleksi(id);
      // Event dapat tiba setelah reaktivasi dan penulisan baru pada tab ini.
      hapus = !(sekarang.tersedia && sekarang.status === "aktif" && sekarang.versi !== versi && generasiMemori.get(id) === sekarang.versi);
    }
    keputusan.set(id, hapus);
    return hapus;
  };
  for (const [id, item] of memoriPartai) if (perluDihapus(item.koleksiId)) memoriPartai.delete(id);
  for (const [id] of memoriKoleksi) if (perluDihapus(id)) memoriKoleksi.delete(id);
  for (const [id, item] of dasarPartai) if (perluDihapus(item.koleksiId)) dasarPartai.delete(id);
  for (const [id] of dasarKoleksi) if (perluDihapus(id)) dasarKoleksi.delete(id);
  void denganKunciAkun(sinkronkanFallback).catch(() => {});
});

/** Simpan seluruh cadangan atau tidak sama sekali; tidak ada pemotongan 100 partai.
 * Pemanggil memegang lock yang sama dengan penghapusan dan pemulihan. */
function simpanFallbackKeStorage() {
  // Tandai juga data yang hanya berada di memori saat storage tidak dapat
  // dibaca, supaya tidak dipulihkan setelah generasi akun berubah.
  for (const id of new Set([...memoriKoleksi.keys(), ...[...memoriPartai.values()].map((p) => p?.koleksiId).filter(Boolean)])) {
    if (!generasiMemori.has(id)) {
      const keadaan = keadaanKoleksi(id);
      generasiMemori.set(id, keadaan.tersedia ? keadaan.versi : null);
    }
  }
  try {
    // Tanpa Web Locks dua tab dapat saling menimpa snapshot. Dalam peramban
    // seperti itu simpan hanya di memori dan laporkan sebagai sementara.
    if (typeof window !== "undefined" && typeof document !== "undefined" && !kunciLintasTabTersedia()) return false;
    if (!sinkronkanFallback() || typeof localStorage === "undefined") return false;
    const storage = localStorage;
    storage.setItem(KUNCI_SNAPSHOT, JSON.stringify({
      koleksi: Array.from(memoriKoleksi.values()),
      partai: Array.from(memoriPartai.values()),
    }));
    dasarPartai = new Map(memoriPartai);
    dasarKoleksi = new Map(memoriKoleksi);
    // Snapshot sudah lengkap sebelum kunci lama dihapus. Jika penghapusan
    // gagal, snapshot tetap valid; penghapusan akun akan mencoba lagi.
    try {
      storage.removeItem(KUNCI_KOLEKSI_LAMA);
      storage.removeItem(KUNCI_PARTAI_LAMA);
    } catch { /* kunci lama tidak boleh dianggap sudah dihapus */ }
    return true;
  } catch {
    return false;
  }
}

/** Hapus cadangan akun juga saat IndexedDB aktif; jangan klaim sukses jika gagal. */
function hapusFallbackKoleksi(koleksiId) {
  try {
    if (typeof localStorage !== "undefined") {
      const storage = localStorage;
      const data = bacaFallback(storage);
      const koleksi = data.koleksi.filter((k) => k?.id !== koleksiId);
      const partai = data.partai.filter((p) => p?.koleksiId !== koleksiId);
      if (data.warisan || koleksi.length !== data.koleksi.length || partai.length !== data.partai.length) {
        storage.setItem(KUNCI_SNAPSHOT, JSON.stringify({ koleksi, partai }));
        storage.removeItem(KUNCI_KOLEKSI_LAMA);
        storage.removeItem(KUNCI_PARTAI_LAMA);
      }
    }
    memoriKoleksi.delete(koleksiId);
    for (const [id, partai] of memoriPartai) {
      if (partai.koleksiId === koleksiId) memoriPartai.delete(id);
    }
    return true;
  } catch {
    return false;
  }
}

/** Hapus snapshot juga saat pengguna mengosongkan seluruh basis data. */
function hapusSeluruhFallback() {
  try {
    if (typeof localStorage !== "undefined") {
      const storage = localStorage;
      storage.removeItem(KUNCI_KOLEKSI_LAMA);
      storage.removeItem(KUNCI_PARTAI_LAMA);
      storage.removeItem(KUNCI_SNAPSHOT);
    } else if (typeof window !== "undefined" && typeof document !== "undefined") {
      return false;
    }
    memoriPartai.clear();
    memoriKoleksi.clear();
    dasarPartai.clear();
    dasarKoleksi.clear();
    generasiMemori.clear();
    return true;
  } catch {
    return false;
  }
}

/**
 * Saat IndexedDB pulih, gabungkan cadangan ke basis sebelum ia dipakai lagi.
 * Jangan menimpa baris IndexedDB yang lebih baru. Snapshot dihapus hanya
 * setelah transaksi selesai dan hanya bila tidak diubah tab lain selama itu.
 */
function pulihkanFallbackKeIndexedDB(db, { fallbackTerbaca }) {
  const dapatDipulihkan = (id) => {
    const keadaan = keadaanKoleksi(id);
    return !keadaan.tersedia || keadaan.status === "aktif";
  };
  const partai = [...memoriPartai.values()].filter((p) => dapatDipulihkan(p.koleksiId));
  const koleksi = new Map([...memoriKoleksi].filter(([id]) => dapatDipulihkan(id)));
  const adaDitahan = partai.length !== memoriPartai.size || koleksi.size !== memoriKoleksi.size;
  if (!partai.length && !koleksi.size) return Promise.resolve(true);
  for (const p of partai) {
    if (p.koleksiId && !koleksi.has(p.koleksiId)) {
      koleksi.set(p.koleksiId, { id: p.koleksiId, platform: p.platform, username: p.username, label: p.username || p.koleksiId });
    }
  }

  let storage;
  let sebelum;
  try {
    if (typeof localStorage !== "undefined") {
      storage = localStorage;
      sebelum = [KUNCI_SNAPSHOT, KUNCI_KOLEKSI_LAMA, KUNCI_PARTAI_LAMA].map((k) => storage.getItem(k));
    }
  } catch { /* data di memori masih bisa dipindahkan */ }

  return new Promise((resolve) => {
    let tx;
    let selesai = false;
    const akhiri = (ok) => {
      if (selesai) return;
      selesai = true;
      resolve(ok);
    };
    const gagal = () => { try { tx?.abort(); } catch { /* sudah batal */ } akhiri(false); };
    try {
      tx = db.transaction([STORE_PARTAI, STORE_KOLEKSI], "readwrite");
      const sPartai = tx.objectStore(STORE_PARTAI);
      const sKoleksi = tx.objectStore(STORE_KOLEKSI);
      tx.onerror = () => akhiri(false);
      tx.onabort = () => akhiri(false);
      tx.oncomplete = () => {
        try {
          const kunci = [KUNCI_SNAPSHOT, KUNCI_KOLEKSI_LAMA, KUNCI_PARTAI_LAMA];
          if (fallbackTerbaca && !adaDitahan && storage && sebelum && kunci.every((k, i) => storage.getItem(k) === sebelum[i])) {
            // Cadangan kanonis dihapus paling akhir, agar kunci lama tidak
            // bangkit kembali bila penghapusan salah satu kunci gagal.
            storage.removeItem(KUNCI_KOLEKSI_LAMA);
            storage.removeItem(KUNCI_PARTAI_LAMA);
            storage.removeItem(KUNCI_SNAPSHOT);
            memoriPartai.clear();
            memoriKoleksi.clear();
            dasarPartai.clear();
            dasarKoleksi.clear();
            generasiMemori.clear();
          }
        } catch { /* data di IndexedDB sudah aman; cadangan tetap ada */ }
        akhiri(true);
      };

      function perbaruiKoleksi() {
        for (const [id, cadangan] of koleksi) {
          const reqCount = sPartai.index("koleksiWaktu").count(IDBKeyRange.bound([id, -Infinity], [id, Infinity]));
          reqCount.onsuccess = () => {
            try {
              const reqKol = sKoleksi.get(id);
              reqKol.onsuccess = () => {
                try {
                  const lama = reqKol.result;
                  const cadanganLebihBaru = (Number(cadangan.terakhirDisinkronkan) || 0) > (Number(lama?.terakhirDisinkronkan) || 0);
                  const data = cadanganLebihBaru ? { ...lama, ...cadangan } : { ...cadangan, ...lama };
                  sKoleksi.put({ ...data, id, jumlahPartai: reqCount.result });
                } catch { gagal(); }
              };
            } catch { gagal(); }
          };
        }
      }

      let tersisa = partai.length;
      if (!tersisa) perbaruiKoleksi();
      for (const p of partai) {
        const req = sPartai.get(p.id);
        req.onsuccess = () => {
          try {
            const lama = req.result;
            if (!lama || (Number(p.disimpanPada) || 0) > (Number(lama.disimpanPada) || 0)) {
              // Rekaman cadangan lama tanpa timestamp tidak akan masuk indeks
              // gabungan, jadi beri nilai numerik sebelum dipulihkan.
              const timestamp = Number(p.timestamp);
              sPartai.put({ ...p, timestamp: Number.isFinite(timestamp) ? timestamp : 0 });
            }
            if (--tersisa === 0) perbaruiKoleksi();
          } catch { gagal(); }
        };
      }
    } catch { gagal(); }
  });
}

/* Satu koneksi dipakai ulang dan operasi menunggu pemulihan fallback. */
let koneksiDB = null;
let janjiKoneksi = null;

function indexedDBGagalDibuka() {
  return masalahIndexedDB;
}

function bukaKoneksi() {
  if (koneksiDB) return Promise.resolve(koneksiDB);
  if (janjiKoneksi) return janjiKoneksi;
  const membuka = new Promise((resolve) => {
    let selesai = false;
    const akhiri = (hasil) => {
      if (selesai) {
        try { hasil?.close(); } catch { /* koneksi terlambat */ }
        return;
      }
      selesai = true;
      resolve(hasil);
    };
    try {
      const req = window.indexedDB.open(NAMA_DB, VERSI_DB);
      req.onerror = () => { masalahIndexedDB = true; akhiri(null); };
      req.onblocked = () => { masalahIndexedDB = true; akhiri(null); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        let sPartai;
        if (!db.objectStoreNames.contains(STORE_PARTAI)) {
          sPartai = db.createObjectStore(STORE_PARTAI, { keyPath: "id" });
        } else {
          sPartai = e.target.transaction.objectStore(STORE_PARTAI);
        }
        const pastikanIndeks = (nama, jalur) => {
          if (!sPartai.indexNames.contains(nama)) sPartai.createIndex(nama, jalur, { unique: false });
        };
        pastikanIndeks("platform", "platform");
        pastikanIndeks("username", "username");
        pastikanIndeks("kombinasi", ["platform", "username"]);
        pastikanIndeks("timestamp", "timestamp");
        pastikanIndeks("platformWaktu", ["platform", "timestamp"]);
        pastikanIndeks("usernameWaktu", ["username", "timestamp"]);
        pastikanIndeks("kombinasiWaktu", ["platform", "username", "timestamp"]);
        pastikanIndeks("koleksiWaktu", ["koleksiId", "timestamp"]);
        if (!db.objectStoreNames.contains(STORE_KOLEKSI)) db.createObjectStore(STORE_KOLEKSI, { keyPath: "id" });
        if (e.oldVersion < 3) {
          // An upgrade transaction is atomic: no old import is partially
          // rewritten if the cursor/update fails or another tab blocks it.
          const reqPartai = sPartai.openCursor();
          reqPartai.onsuccess = () => {
            const cursor = reqPartai.result;
            if (!cursor) return;
            const lama = cursor.value;
            let baru = perbaikiTanggalImpor(lama);
            // Legacy records without a numeric timestamp are otherwise absent
            // from IndexedDB's time indexes, and disappear from whole-collection
            // queries. Zero explicitly means an unknown date.
            if (typeof baru.timestamp !== "number" || !Number.isFinite(baru.timestamp)) {
              const angka = Number(baru.timestamp);
              baru = { ...baru, timestamp: Number.isFinite(angka) ? angka : 0 };
            }
            if (baru !== lama) cursor.update(baru);
            cursor.continue();
          };
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (selesai) { try { db.close(); } catch { /* terlambat */ } return; }
        db.onversionchange = () => {
          try { db.close(); } catch { /* abaikan */ }
          if (koneksiDB === db) koneksiDB = null;
        };
        db.onclose = () => { if (koneksiDB === db) koneksiDB = null; };
        koneksiDB = db;
        akhiri(db);
      };
    } catch {
      masalahIndexedDB = true;
      akhiri(null);
    }
  });
  janjiKoneksi = membuka;
  void membuka.then(() => { if (janjiKoneksi === membuka) janjiKoneksi = null; });
  return membuka;
}

/** Buka database dan pulihkan cadangan dalam lock yang sama dengan tulisan. */
async function bukaDB({ terkunci = false } = {}) {
  if (!terkunci) return denganKunciAkun(() => bukaDB({ terkunci: true }));
  const fallbackTerbaca = sinkronkanFallback();
  if (!punyaIndexedDB()) return null;
  const db = await bukaKoneksi();
  if (!db) return null;
  if (!(await pulihkanFallbackKeIndexedDB(db, { fallbackTerbaca }))) {
    masalahIndexedDB = true;
    try { db.close(); } catch { /* abaikan */ }
    if (koneksiDB === db) koneksiDB = null;
    return null;
  }
  masalahIndexedDB = false;
  return db;
}

/** Buat ID deterministik untuk satu partai agar tidak terjadi duplikasi. */

/*
 * Permukaan internal modul ini. Hanya nama-nama di bawah yang boleh dipakai
 * modul database lain; `NAMA_DB`, `VERSI_DB`, `AWALAN_STORAGE`,
 * `punyaIndexedDB`, dan `muatFallbackDariStorage` sengaja tetap privat.
 */
export {
  STORE_PARTAI,
  STORE_KOLEKSI,
  memoriPartai,
  memoriKoleksi,
  simpanFallbackKeStorage,
  sinkronkanFallback,
  hapusFallbackKoleksi,
  hapusSeluruhFallback,
  indexedDBGagalDibuka,
  bukaDB,
};
