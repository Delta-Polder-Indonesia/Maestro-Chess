/** Pengelola satu papan aktif; laporan-laporan lainnya tetap di penyimpanan. */
import { judulPekerjaan, pekerjaan, sumberPekerjaan } from "./pekerjaan.js";

const GARIS_KOSONG = () => ({ moveNumber: -1, moves: [], arrows: {} });
const PEMAIN_KOSONG = () => [{ name: "", elo: "?" }, { name: "", elo: "?" }];

function panahKosong(panjang) {
  return Object.fromEntries(Array.from({ length: panjang }, (_, i) => [i, []]));
}

/**
 * `bacaPapan` membaca render terakhir; selama data baru belum selesai dimuat,
 * board masih berisi partai lama dan tidak boleh disimpan sebagai partai baru.
 */
export function buatManajerLaporan(bacaPapan, store = pekerjaan) {
  let aktif = null;

  function tandaiAktif() {
    store.tetapkanAktif({
      id: aktif?.id ?? null,
      digunakan: Boolean(aktif?.digunakan),
      berjalan: aktif?.fase === "berjalan",
    });
  }

  function fotoPapan(papan, record) {
    return {
      versi: 1,
      game: papan.game,
      players: record?.snapshot?.players ?? PEMAIN_KOSONG(),
      time: papan.time,
      result: papan.result,
      moveNumber: papan.moveNumber,
      white: papan.white,
      tab: papan.tab,
      customLine: papan.customLine,
      arrows: papan.arrows,
      pageState: papan.pageState,
      kedalaman: record?.snapshot?.kedalaman ?? papan.depth,
    };
  }

  function baca() {
    if (!aktif) return null;
    const papan = bacaPapan();
    if (papan.data?.pekerjaanId !== aktif.id || !Array.isArray(papan.game) || !papan.game.length) {
      return aktif.record;
    }
    if (aktif.fase === "berjalan" || aktif.fase === "terputus") return aktif.record;
    // Callback selesai/pulih terjadi sebelum React memasang game yang baru.
    if (aktif.menungguGame && (papan.game !== aktif.menungguGame || papan.pageState !== aktif.menungguPageState)) return aktif.record;
    if (!["default", "analyze", "analyzeCustom"].includes(papan.pageState)) return aktif.record;
    aktif.menungguGame = null;

    const adaPanah = Object.values(papan.arrows ?? {}).some((daftar) => Array.isArray(daftar) && daftar.length);
    const adaIsi = Boolean(papan.customLine?.moves?.length || adaPanah || papan.white === false);
    if (aktif.fase === "kosong") {
      // Papan awal yang belum dipakai bukan pekerjaan. Namun "Mulai baru"
      // yang dipilih secara eksplisit tetap menjadi pekerjaan aktif, termasuk
      // jika halaman dimuat ulang sebelum pengguna memainkan langkah pertama.
      if (!adaIsi && !aktif.digunakan) return null;
      aktif.fase = "selesai";
      aktif.digunakan = true;
      aktif.record = {
        id: aktif.id, jenis: "laporan", judul: "", status: adaIsi ? "selesai" : "baru",
        sumber: sumberPekerjaan(papan.data), snapshot: null,
      };
      tandaiAktif();
    }
    const status = aktif.record.status === "baru" && adaIsi ? "selesai" : aktif.record.status;
    aktif.record = { ...aktif.record, status, snapshot: fotoPapan(papan, aktif.record), waktu: Date.now() };
    return aktif.record;
  }

  function simpan() {
    const record = baca();
    if (record) store.simpan(record);
    return record;
  }

  function tinggalkan(idBerikut) {
    if (!aktif) return null;
    const sebelumnya = baca();
    if (aktif.id !== idBerikut && sebelumnya) {
      const record = aktif.fase === "berjalan"
        ? { ...sebelumnya, status: "terputus", waktu: Date.now() }
        : sebelumnya;
      store.simpan(record);
    }
    return aktif.id === idBerikut ? sebelumnya : null;
  }

  function mulai({ data, depth }) {
    const lama = tinggalkan(data.pekerjaanId) ?? data.rekamAwal ?? null;
    const sumber = sumberPekerjaan(data);
    if (sumber.format === "fen" && !sumber.string.trim()) {
      aktif = {
        id: data.pekerjaanId, fase: "kosong", record: null,
        digunakan: !data.awalPekerjaan, menungguGame: Symbol("papan kosong"), menungguPageState: "default",
      };
      tandaiAktif();
      return;
    }
    const sumberSama = lama?.sumber?.format === sumber.format && lama?.sumber?.string === sumber.string;
    aktif = {
      id: data.pekerjaanId,
      fase: "berjalan",
      digunakan: true,
      menungguGame: null,
      record: {
        id: data.pekerjaanId, jenis: "laporan", judul: sumberSama ? lama?.judul ?? "" : "",
        status: "berjalan", sumber, snapshot: sumberSama ? lama?.snapshot ?? null : null,
        kedalamanDiminta: depth, waktu: Date.now(),
      },
    };
    tandaiAktif();
    store.simpan(aktif.record);
  }

  function siapKosong(id, game) {
    if (aktif?.id === id && aktif.fase === "kosong") aktif.menungguGame = game;
  }

  function metadata(id, info) {
    if (aktif?.id !== id || aktif.fase !== "berjalan") return;
    aktif.record = { ...aktif.record, judul: judulPekerjaan(info?.players), waktu: Date.now() };
    store.simpan(aktif.record);
  }

  function selesai({ id, metadata: info, moves, pageState, depth, pertahankan }) {
    if (aktif?.id !== id || aktif.fase !== "berjalan") return;
    const papan = bacaPapan();
    const lama = pertahankan ? aktif.record.snapshot : null;
    const snapshot = {
      versi: 1,
      game: moves,
      players: info?.players ?? PEMAIN_KOSONG(),
      time: info?.time ?? 0,
      result: info?.result ?? "",
      moveNumber: lama?.moveNumber ?? 0,
      white: lama?.white ?? (pageState === "analyzeCustom" ? true : papan.white),
      tab: lama?.tab ?? (pageState === "analyzeCustom" ? "moves" : "summary"),
      customLine: lama?.customLine ?? GARIS_KOSONG(),
      arrows: lama?.arrows ?? panahKosong(moves.length),
      pageState,
      kedalaman: depth,
    };
    aktif.fase = "selesai";
    aktif.menungguGame = moves;
    aktif.menungguPageState = pageState;
    aktif.record = {
      ...aktif.record, judul: judulPekerjaan(snapshot.players),
      status: "selesai", snapshot, waktu: Date.now(),
    };
    tandaiAktif();
    store.simpan(aktif.record);
  }

  function gagal(id) {
    if (aktif?.id !== id || aktif.fase !== "berjalan") return;
    aktif.fase = "terputus";
    aktif.record = { ...aktif.record, status: "terputus", waktu: Date.now() };
    tandaiAktif();
    store.simpan(aktif.record);
  }

  function pulih(data, record, snapshot) {
    tinggalkan(data.pekerjaanId);
    aktif = {
      id: data.pekerjaanId, fase: "selesai", digunakan: true, menungguGame: snapshot.game,
      menungguPageState: snapshot.pageState,
      record: {
        ...record, snapshot,
        // Status "berjalan" dari sesi lain tidak berarti engine masih hidup.
        status: record.status === "berjalan" ? "terputus" : record.status,
        waktu: Date.now(),
      },
    };
    tandaiAktif();
    store.simpan(aktif.record);
  }

  function tutup() {
    if (!aktif) return;
    const record = baca();
    if (record) store.simpan(aktif.fase === "berjalan" ? { ...record, status: "terputus", waktu: Date.now() } : record);
    if (store.snapshot().aktif.id === aktif.id) store.tetapkanAktif(null);
    aktif = null;
  }

  return {
    baca, simpan, mulai, siapKosong, metadata, selesai, gagal, pulih, tutup,
    punyaSnapshot: (id) => Boolean(aktif?.id === id && aktif.record?.snapshot),
  };
}
