/**
 * Riwayat pekerjaan lokal, terpisah dari database koleksi/partai.
 *
 * Metadata dan isi disimpan di dua object store agar menampilkan daftar tidak
 * perlu membaca seluruh hasil analisis. Tulisan untuk satu pekerjaan yang
 * berubah cepat digabung: hanya nilai terbaru yang menunggu transaksi aktif.
 * Bila IndexedDB gagal, pekerjaan tetap tersedia di memori tab dan status
 * kesalahan disiarkan supaya antarmuka tidak mengklaim penyimpanan permanen.
 */

import { validateFen } from "chess.js";

export const ID_DRAF_IMPOR = "draf:impor";
const ID_AKTIF = "meta:laporan-aktif";
const ID_DRAF_AKTIF = "meta:draf-aktif";
const NAMA_DB = "maestro_chess_pekerjaan_v1";
const STORE_DAFTAR = "daftar";
const STORE_ISI = "isi";

function idAcak() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function buatIdPekerjaan() {
  return `laporan:${idAcak()}`;
}

export function buatIdDrafImpor() {
  return `draf:${idAcak()}`;
}

/** Adapter IndexedDB tidak memakai database partai agar tidak mengubah skema lama. */
export function buatAdapterPekerjaan(indexedDB, batasBukaMs = 8000) {
  let koneksi = null;
  let membuka = null;

  function buka() {
    if (koneksi) return Promise.resolve(koneksi);
    if (membuka) return membuka;
    let sumber;
    try { sumber = indexedDB ?? globalThis.indexedDB; } catch { sumber = null; }
    if (!sumber) return Promise.reject(new Error("IndexedDB tidak tersedia"));
    membuka = new Promise((resolve, reject) => {
      let selesai = false;
      const timer = setTimeout(() => gagal(new Error("Penyimpanan tidak merespons")), batasBukaMs);
      function gagal(error) {
        if (selesai) return;
        selesai = true;
        clearTimeout(timer);
        reject(error);
      }
      try {
        const request = sumber.open(NAMA_DB, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_DAFTAR)) db.createObjectStore(STORE_DAFTAR, { keyPath: "id" });
          if (!db.objectStoreNames.contains(STORE_ISI)) db.createObjectStore(STORE_ISI, { keyPath: "id" });
        };
        request.onerror = () => gagal(request.error ?? new Error("Gagal membuka penyimpanan"));
        request.onblocked = () => gagal(new Error("Penyimpanan sedang diblokir tab lain"));
        request.onsuccess = () => {
          const db = request.result;
          if (selesai) {
            db.close();
            return;
          }
          selesai = true;
          clearTimeout(timer);
          db.onversionchange = () => { db.close(); koneksi = null; };
          db.onclose = () => { koneksi = null; };
          koneksi = db;
          resolve(db);
        };
      } catch (error) {
        gagal(error);
      }
    }).finally(() => { membuka = null; });
    return membuka;
  }

  function transaksi(db, mode, jalankan) {
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction([STORE_DAFTAR, STORE_ISI], mode);
        let hasil;
        tx.oncomplete = () => resolve(hasil);
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Transaksi penyimpanan gagal"));
        jalankan(tx, (nilai) => { hasil = nilai; });
      } catch (error) {
        // Misalnya `put` kedua melempar DataCloneError secara sinkron: abort
        // transaksi agar metadata pertama tidak tersimpan tanpa isi laporan.
        try { tx?.abort(); } catch { /* transaksi mungkin sudah berakhir */ }
        reject(error);
      }
    });
  }

  return {
    async daftar() {
      const db = await buka();
      return transaksi(db, "readonly", (tx, setHasil) => {
        const request = tx.objectStore(STORE_DAFTAR).getAll();
        request.onsuccess = () => setHasil(request.result);
      });
    },
    async ambil(id) {
      const db = await buka();
      return transaksi(db, "readonly", (tx, setHasil) => {
        const request = tx.objectStore(STORE_ISI).get(id);
        request.onsuccess = () => setHasil(request.result ?? null);
      });
    },
    async simpan(record, metadata) {
      const db = await buka();
      return transaksi(db, "readwrite", (tx) => {
        tx.objectStore(STORE_DAFTAR).put(metadata);
        tx.objectStore(STORE_ISI).put(record);
      });
    },
    async hapus(id) {
      const db = await buka();
      return transaksi(db, "readwrite", (tx) => {
        tx.objectStore(STORE_DAFTAR).delete(id);
        tx.objectStore(STORE_ISI).delete(id);
      });
    },
  };
}

/** Factory dipisah agar urutan tulis, kegagalan, dan balapan bisa diuji. */
export function buatPenyimpananPekerjaan(adapter = buatAdapterPekerjaan()) {
  const metadata = new Map();
  const cache = new Map();
  const disentuh = new Set();
  const pending = new Map();
  const pendengar = new Set();
  let nilai = {
    siap: false,
    tersedia: true,
    menyimpan: false,
    daftar: [],
    terakhirId: null,
    terakhirDrafId: null,
    aktif: { id: null, digunakan: false, berjalan: false },
  };
  let inisialisasi = null;
  let penulis = null;

  function terbitkan(perubahan = {}) {
    nilai = {
      ...nilai,
      ...perubahan,
      daftar: Array.from(metadata.values()).sort((a, b) => (b.waktu ?? 0) - (a.waktu ?? 0)),
    };
    for (const callback of Array.from(pendengar)) {
      try { callback(); } catch { /* Satu pelanggan tidak boleh menggagalkan penyimpanan. */ }
    }
  }

  function init() {
    if (inisialisasi) return inisialisasi;
    inisialisasi = (async () => {
      let tersedia = true;
      let terakhirId = nilai.terakhirId;
      let terakhirDrafId = nilai.terakhirDrafId;
      try {
        const daftar = await adapter.daftar();
        // Setelan baru mungkin sudah dibuat selagi pembacaan menunggu.
        terakhirId = nilai.terakhirId;
        terakhirDrafId = nilai.terakhirDrafId;
        for (const item of Array.isArray(daftar) ? daftar : []) {
          if (item?.id === ID_AKTIF && !disentuh.has(ID_AKTIF)) terakhirId = item.laporanId ?? null;
          else if (item?.id === ID_DRAF_AKTIF && !disentuh.has(ID_DRAF_AKTIF)) terakhirDrafId = item.drafId ?? null;
          else if (item?.id && ["laporan", "draf", "fitur"].includes(item.jenis) && !disentuh.has(item.id)) metadata.set(item.id, item);
        }
      } catch {
        tersedia = false;
        terakhirId = nilai.terakhirId;
        terakhirDrafId = nilai.terakhirDrafId;
      }
      terbitkan({ siap: true, tersedia, terakhirId, terakhirDrafId });
    })();
    return inisialisasi;
  }

  async function tulis() {
    await init();
    while (pending.size) {
      const [id, operasi] = pending.entries().next().value;
      pending.delete(id);
      try {
        if (operasi.hapus) await adapter.hapus(id);
        else await adapter.simpan(operasi.record, operasi.metadata);
      } catch {
        // Jangan buang salinan memori; UI harus memberi tahu bahwa tab belum
        // aman ditutup. Status tetap gagal sampai halaman dibuka ulang.
        terbitkan({ tersedia: false });
      }
    }
  }

  function mulaiTulis() {
    if (!penulis) {
      penulis = tulis().finally(() => {
        penulis = null;
        if (pending.size) mulaiTulis();
        else terbitkan({ menyimpan: false });
      });
    }
    return penulis;
  }

  function simpan(record) {
    if (!record?.id || !["laporan", "draf", "fitur"].includes(record.jenis)) return;
    const meta = {
      id: record.id,
      jenis: record.jenis,
      judul: String(record.judul ?? ""),
      status: String(record.status ?? ""),
      format: String(record.sumber?.format ?? record.isi?.tipe ?? ""),
      adaHasil: Boolean(record.snapshot),
      waktu: Number.isFinite(record.waktu) ? record.waktu : Date.now(),
      ...(record.jenis === "fitur" ? { fitur: record.fitur, targetId: record.targetId ?? null } : {}),
    };
    const lengkap = { ...record, ...meta };
    disentuh.add(meta.id);
    cache.set(meta.id, lengkap);
    metadata.set(meta.id, meta);
    pending.set(meta.id, { record: lengkap, metadata: meta });
    terbitkan({ menyimpan: true });
    mulaiTulis();
  }

  function hapus(id) {
    if (!id) return;
    disentuh.add(id);
    cache.set(id, null);
    metadata.delete(id);
    pending.set(id, { hapus: true });
    terbitkan({ menyimpan: true });
    mulaiTulis();
  }

  async function ambil(id) {
    await init();
    if (cache.has(id)) return cache.get(id);
    try {
      const record = await adapter.ambil(id);
      // Pengetikan/hapus dapat terjadi selagi transaksi baca menunggu.
      if (cache.has(id)) return cache.get(id);
      cache.set(id, record ?? null);
      return record ?? null;
    } catch {
      terbitkan({ tersedia: false });
      return null;
    }
  }

  async function tungguTulis() {
    while (penulis || pending.size) await (penulis ?? mulaiTulis());
  }

  return {
    init,
    simpan,
    hapus,
    ambil,
    tungguTulis,
    snapshot: () => nilai,
    tetapkanAktif(aktif) {
      const berikut = {
        id: aktif?.id ?? null,
        digunakan: Boolean(aktif?.digunakan),
        berjalan: Boolean(aktif?.berjalan),
      };
      const berubah = nilai.aktif.id !== berikut.id || nilai.aktif.digunakan !== berikut.digunakan || nilai.aktif.berjalan !== berikut.berjalan;
      if (berikut.digunakan && berikut.id && nilai.terakhirId !== berikut.id) {
        // Penunjuk disimpan terpisah dari urutan waktu: dua laporan dapat
        // disentuh dalam milidetik yang sama, tetapi hanya satu yang aktif.
        const penunjuk = { id: ID_AKTIF, jenis: "penunjuk", laporanId: berikut.id };
        disentuh.add(ID_AKTIF);
        pending.set(ID_AKTIF, { record: penunjuk, metadata: penunjuk });
        terbitkan({ aktif: berikut, terakhirId: berikut.id, menyimpan: true });
        mulaiTulis();
      } else if (berubah) {
        terbitkan({ aktif: berikut });
      }
    },
    tetapkanDrafAktif(id) {
      if (!id || nilai.terakhirDrafId === id) return;
      const penunjuk = { id: ID_DRAF_AKTIF, jenis: "penunjuk", drafId: id };
      disentuh.add(ID_DRAF_AKTIF);
      pending.set(ID_DRAF_AKTIF, { record: penunjuk, metadata: penunjuk });
      terbitkan({ terakhirDrafId: id, menyimpan: true });
      mulaiTulis();
    },
    langganan(callback) {
      pendengar.add(callback);
      return () => pendengar.delete(callback);
    },
  };
}

/** Teks sumber dipisahkan dari snapshot supaya ekspor tetap memakai PGN asli. */
export function sumberPekerjaan(data) {
  const format = data?.format === "pgn" ? "pgn" : "fen";
  return { format, string: String(data?.string ?? "") };
}

export function judulPekerjaan(players) {
  const nama = [0, 1].map((i) => String(players?.[i]?.name ?? "").trim());
  return nama.some(Boolean) ? `${nama[0] || "?"} vs ${nama[1] || "?"}` : "";
}

function panahAman(panah, panjang) {
  const hasil = {};
  for (let i = 0; i < panjang; i++) {
    const daftar = Array.isArray(panah?.[i]) ? panah[i] : [];
    hasil[i] = daftar.filter((garis) => Array.isArray(garis) && garis.length === 2 && garis.every(
      (kotak) => Number.isInteger(kotak?.row) && kotak.row >= 0 && kotak.row < 8 &&
        Number.isInteger(kotak?.col) && kotak.col >= 0 && kotak.col < 8,
    ));
  }
  return hasil;
}

/** Tolak snapshot yang rusak/tidak dikenal, bukan menimpanya dengan papan kosong. */
export function snapshotLaporanAman(snapshot) {
  if (!snapshot || snapshot.versi !== 1 || !Array.isArray(snapshot.game) || !snapshot.game.length) return null;
  const sah = (langkah) => typeof langkah?.fen === "string" && validateFen(langkah.fen).ok;
  if (!snapshot.game.every(sah)) return null;
  const garis = snapshot.customLine;
  if (!garis || !Array.isArray(garis.moves) || !garis.moves.every(sah)) return null;
  const moveNumber = Number.isInteger(snapshot.moveNumber)
    ? Math.max(0, Math.min(snapshot.game.length - 1, snapshot.moveNumber)) : 0;
  const nomorGaris = Number.isInteger(garis.moveNumber)
    ? Math.max(-1, Math.min(garis.moves.length - 1, garis.moveNumber)) : -1;
  // Langkah manual yang belum sempat dinilai tetap bisa ditampilkan di posisi
  // terakhir, tetapi tidak boleh disangka sebagai hasil evaluasi selesai.
  const moves = garis.moves.map((langkah) => !langkah.previousStaticEvals && !langkah.statusEvaluasi
    ? { ...langkah, statusEvaluasi: "dibatalkan" } : langkah);
  return {
    ...snapshot,
    moveNumber,
    white: snapshot.white !== false,
    tab: snapshot.tab === "moves" ? "moves" : "summary",
    pageState: ["default", "analyzeCustom"].includes(snapshot.pageState) ? snapshot.pageState : "analyze",
    arrows: panahAman(snapshot.arrows, snapshot.game.length),
    customLine: { moveNumber: nomorGaris, moves, arrows: panahAman(garis.arrows, moves.length) },
    players: [0, 1].map((i) => ({
      name: String(snapshot.players?.[i]?.name ?? ""),
      elo: snapshot.players?.[i]?.elo ?? "?",
    })),
  };
}

export const pekerjaan = buatPenyimpananPekerjaan();

/** Satu pembaca aktif: Game tetap terpasang meskipun layar lain dibuka. */
let pembacaLaporan = null;
export function daftarkanPembacaLaporan(pembaca) {
  pembacaLaporan = pembaca;
  return () => { if (pembacaLaporan === pembaca) pembacaLaporan = null; };
}
export function simpanLaporanAktif() {
  const record = pembacaLaporan?.();
  if (record) pekerjaan.simpan(record);
}

export function simpanDrafImpor(draf, id = ID_DRAF_IMPOR, store = pekerjaan) {
  const isi = {
    tipe: ["pgn", "fen", "online"].includes(draf?.tipe) ? draf.tipe : "pgn",
    pgn: String(draf?.pgn ?? ""),
    fen: String(draf?.fen ?? ""),
    tautan: String(draf?.tautan ?? ""),
  };
  if (![isi.pgn, isi.fen, isi.tautan].some((teks) => teks.length)) {
    store.hapus(id);
    return;
  }
  const pilihan = isi.tipe === "online" ? isi.tautan : isi[isi.tipe];
  const contoh = [pilihan, isi.pgn, isi.fen, isi.tautan].find((teks) => teks.trim()) ?? "";
  // Cuplikan membedakan beberapa draf di daftar, tanpa mengubah teks aslinya.
  const judul = contoh.slice(0, 160).replace(/\s+/g, " ").trim().slice(0, 80);
  store.simpan({ id, jenis: "draf", judul, status: "draf", waktu: Date.now(), isi });
}
