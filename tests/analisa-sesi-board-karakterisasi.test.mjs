import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import * as konteksAsli from "../src/halaman/Analisa/konteks/boardKonteks.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const pathKonteks = "src/halaman/Analisa/konteks/boardKonteks.js";
const pathProvider = "src/halaman/Analisa/konteks/board.jsx";
const namaField = ["game", "players", "moveNumber", "forward", "white", "animation", "playing", "time", "materialAdvantage", "result", "tab", "customLine", "returnedToNormalGame", "depth"];
const namaKontrol = ["back", "forward", "first", "last", "togglePlay", "play", "pause"];
const terjemahan = (prefix) => (key) => `${prefix}:${key}`;

function lingkungan(tes, local = [], session = []) {
  const sebelumnya = Object.fromEntries(["localStorage", "sessionStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const operasi = [];
  const bersihkan = [];
  function buatStorage(nama, awal) {
    const data = new Map(awal);
    return {
      data,
      getItem(key) { operasi.push([nama, "get", key]); return data.get(key) ?? null; },
      setItem(key, value) { operasi.push([nama, "set", key, String(value)]); data.set(key, String(value)); },
      removeItem(key) { operasi.push([nama, "remove", key]); data.delete(key); },
    };
  }
  const lokal = buatStorage("local", local);
  const sesi = buatStorage("session", session);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: lokal });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: sesi });
  tes.after(() => {
    for (const lepas of bersihkan.reverse()) lepas();
    for (const key of ["localStorage", "sessionStorage"]) {
      if (sebelumnya[key]) Object.defineProperty(globalThis, key, sebelumnya[key]);
      else delete globalThis[key];
    }
  });
  return { lokal, sesi, operasi, locale: { t: terjemahan("id") }, sebelumPulih: (lepas) => bersihkan.push(lepas) };
}

function storePekerjaan() {
  return {
    initCalls: 0, drafAktif: [],
    async init() { this.initCalls++; },
    snapshot() { return { daftar: [], aktif: { id: null }, terakhirDrafId: null }; },
    tetapkanDrafAktif(id) { this.drafAktif.push(id); },
  };
}

function pemuat(ling, store = storePekerjaan()) {
  let id = 0;
  return buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: ling.locale.t }) },
    "src/modul/pekerjaan/index.js": {
      KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", buatIdDrafImpor: () => "draf:uji",
      buatIdPekerjaan: () => `laporan:uji-${++id}`, pekerjaan: store, simpanLaporanAktif: () => {},
    },
  });
}

function siapkan(ling, muat = pemuat(ling)) {
  const provider = muat(pathProvider);
  const konteks = muat(pathKonteks);
  let renderer;
  let nilai;
  function Probe() {
    const board = konteks.useBoard();
    const tampilan = konteks.useTampilan();
    const setTampilan = konteks.useSetTampilan();
    nilai = { board, tampilan, setTampilan, langsung: React.useContext(konteks.BoardContext) };
    return React.createElement("span", { "data-uji": "anak-board" });
  }
  const pohon = () => React.createElement(provider.BoardProvider, null, React.createElement(Probe));
  act(() => { renderer = TestRenderer.create(pohon()); });
  ling.sebelumPulih(() => { if (renderer) act(() => renderer.unmount()); });
  return {
    muat, provider, konteks,
    get nilai() { return nilai; },
    get renderer() { return renderer; },
    update() { act(() => renderer.update(pohon())); },
    unmount() { if (renderer) { act(() => renderer.unmount()); renderer = null; } },
  };
}

test("the original board context exposes six named exports and neutral shared defaults", (tes) => {
  assert.deepEqual(Object.keys(konteksAsli).sort(), ["BoardContext", "SetTampilanContext", "TampilanContext", "useBoard", "useSetTampilan", "useTampilan"].sort());
  let nilai;
  function Probe() {
    nilai = { board: konteksAsli.useBoard(), tampilan: konteksAsli.useTampilan(), setter: konteksAsli.useSetTampilan(), langsung: React.useContext(konteksAsli.BoardContext) };
    return null;
  }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Probe)); });
  tes.after(() => act(() => renderer.unmount()));
  const { board, tampilan, setter } = nilai;
  assert.strictEqual(board, nilai.langsung);
  assert.deepEqual(Object.keys(board), [...namaField, "gameController"]);
  assert.deepEqual(board.game[0], []);
  assert.deepEqual(board.players[0], [{ name: "", elo: "NOELO" }, { name: "", elo: "NOELO" }]);
  assert.equal(Object.isFrozen(board.players[0]), true);
  assert.equal(Object.isFrozen(board.players[0][0]), true);
  assert.equal(Object.isFrozen(board.players[0][1]), true);
  assert.equal(board.moveNumber[0], 0);
  assert.equal(board.forward[0], true);
  assert.equal(board.white[0], true);
  assert.equal(board.animation[0], false);
  assert.equal(board.playing[0], false);
  assert.equal(board.time[0], 0);
  assert.equal(board.materialAdvantage[0], 0);
  assert.equal(board.result[0], "");
  assert.equal(board.tab[0], "analyze");
  assert.deepEqual(board.customLine[0], { moveNumber: -1, moves: [], arrows: {} });
  assert.equal(board.returnedToNormalGame[0], null);
  assert.equal(board.depth[0], 8);
  const noOp = board.game[1];
  for (const nama of namaField) {
    assert.strictEqual(board[nama][1], noOp, nama);
    assert.equal(board[nama][1](() => { throw new Error("default setter tidak menjalankan updater"); }), undefined);
  }
  assert.deepEqual(Object.keys(board.gameController), namaKontrol);
  for (const nama of namaKontrol) assert.strictEqual(board.gameController[nama], noOp, nama);
  assert.equal(tampilan[0], "papan");
  assert.strictEqual(tampilan[1], noOp);
  assert.strictEqual(setter, noOp);
  const lama = nilai;
  act(() => renderer.update(React.createElement(Probe)));
  assert.strictEqual(nilai.board, lama.board);
  assert.notStrictEqual(nilai.tampilan, lama.tampilan);
  assert.strictEqual(nilai.tampilan[1], lama.tampilan[1]);
});

test("the original provider has one named export and preserves initialization order and default values", (tes) => {
  const ling = lingkungan(tes);
  const translate = terjemahan("id");
  ling.locale.t = (key) => { ling.operasi.push(["i18n", "t", key]); return translate(key); };
  const app = siapkan(ling);
  assert.deepEqual(Object.keys(app.provider), ["BoardProvider"]);
  const { board, tampilan, setTampilan } = app.nilai;
  assert.strictEqual(board, app.nilai.langsung);
  assert.deepEqual(Object.keys(board), [...namaField, "gameController"]);
  assert.deepEqual(board.game[0], []);
  assert.deepEqual(board.players[0], [
    { name: "id:analisa.pemain.putih", elo: "?" }, { name: "id:analisa.pemain.hitam", elo: "?" },
  ]);
  assert.equal(board.moveNumber[0], 0);
  assert.equal(board.forward[0], true);
  assert.equal(board.white[0], true);
  assert.equal(board.animation[0], true);
  assert.equal(board.playing[0], false);
  assert.equal(board.time[0], 0);
  assert.equal(board.materialAdvantage[0], 0);
  assert.equal(board.result[0], "");
  assert.equal(board.tab[0], "analyze");
  assert.deepEqual(board.customLine[0], { moveNumber: -1, moves: [], arrows: {} });
  assert.equal(board.returnedToNormalGame[0], null);
  assert.equal(board.depth[0], 8);
  assert.deepEqual(Object.keys(board.gameController), namaKontrol);
  for (const nama of namaField) assert.equal(typeof board[nama][1], "function", nama);
  for (const nama of namaKontrol) assert.equal(typeof board.gameController[nama], "function", nama);
  assert.equal(tampilan[0], "papan");
  assert.strictEqual(tampilan[1], setTampilan);
  assert.ok(app.renderer.root.findByProps({ "data-uji": "anak-board" }));
  assert.deepEqual(ling.operasi, [
    ["i18n", "t", "analisa.pemain.putih"], ["i18n", "t", "analisa.pemain.hitam"],
    ["local", "get", "maestro-analisa-kedalaman"], ["local", "get", "depth"],
  ]);
});

test("depth reads the current key before legacy depth, rounds and clamps only its initial value", (tes) => {
  const ling = lingkungan(tes);
  const muat = pemuat(ling);
  const kasus = [
    [[], 8, ["maestro-analisa-kedalaman", "depth"]],
    [[["depth", "9.7"]], 10, ["maestro-analisa-kedalaman", "depth"]],
    [[["maestro-analisa-kedalaman", "18.6"], ["depth", "7"]], 19, ["maestro-analisa-kedalaman"]],
    [[["maestro-analisa-kedalaman", "-20"]], 6, ["maestro-analisa-kedalaman"]],
    [[["maestro-analisa-kedalaman", "200"]], 20, ["maestro-analisa-kedalaman"]],
    [[["maestro-analisa-kedalaman", "0x10"]], 16, ["maestro-analisa-kedalaman"]],
    [[["maestro-analisa-kedalaman", "Infinity"], ["depth", "8"]], 8, ["maestro-analisa-kedalaman"]],
    [[["maestro-analisa-kedalaman", ""], ["depth", "8"]], 8, ["maestro-analisa-kedalaman"]],
  ];
  for (const [awal, expected, dibaca] of kasus) {
    ling.lokal.data.clear();
    for (const [key, value] of awal) ling.lokal.data.set(key, value);
    ling.operasi.length = 0;
    const app = siapkan(ling, muat);
    assert.equal(app.nilai.board.depth[0], expected, JSON.stringify(awal));
    assert.deepEqual(ling.operasi.filter(([nama, aksi]) => nama === "local" && aksi === "get").map(([, , key]) => key), dibaca);
    assert.equal(ling.operasi.some(([, aksi]) => aksi === "set" || aksi === "remove"), false);
    app.unmount();
  }
});

test("depth is read once per mount; its setter is not clamped and does not write storage", (tes) => {
  const ling = lingkungan(tes, [["maestro-analisa-kedalaman", "6.5"]]);
  const muat = pemuat(ling);
  const app = siapkan(ling, muat);
  assert.equal(app.nilai.board.depth[0], 7);
  ling.lokal.data.set("maestro-analisa-kedalaman", "17");
  ling.operasi.length = 0;
  act(() => app.nilai.board.depth[1](44.25));
  app.update();
  assert.equal(app.nilai.board.depth[0], 44.25);
  assert.deepEqual(ling.operasi, []);
  app.unmount();
  const baru = siapkan(ling, muat);
  assert.equal(baru.nilai.board.depth[0], 17);
  assert.deepEqual(ling.operasi, [["local", "get", "maestro-analisa-kedalaman"]]);
});

test("a failed depth read logs and uses 8 without attempting a write", (tes) => {
  const ling = lingkungan(tes);
  const asli = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  tes.after(() => { console.error = asli; });
  const gagal = new Error("storage blocked");
  ling.lokal.getItem = () => { throw gagal; };
  const app = siapkan(ling);
  assert.equal(app.nilai.board.depth[0], 8);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], "Gagal membaca pengaturan Analisa:");
  assert.strictEqual(errors[0][1], gagal);
  assert.equal(ling.operasi.some(([, aksi]) => aksi === "set" || aksi === "remove"), false);
});

test("players preserve extra fields and zero Elo, normalize missing names, and retranslate blank names", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const controller = app.nilai.board.gameController;
  const tambahan = { asli: true };
  const input = [{ name: "  Alice  ", elo: 0, tambahan }, { name: "  ", elo: null }];
  act(() => app.nilai.board.players[1](input));
  assert.deepEqual(app.nilai.board.players[0], [
    { name: "Alice", elo: 0, tambahan }, { name: "id:analisa.pemain.hitam", elo: "NOELO" },
  ]);
  assert.notStrictEqual(app.nilai.board.players[0], input);
  assert.strictEqual(app.nilai.board.players[0][0].tambahan, tambahan);
  ling.locale.t = terjemahan("en");
  app.update();
  assert.deepEqual(app.nilai.board.players[0], [
    { name: "Alice", elo: 0, tambahan }, { name: "en:analisa.pemain.hitam", elo: "NOELO" },
  ]);
  assert.strictEqual(app.nilai.board.gameController, controller);
  act(() => app.nilai.board.players[1](null));
  assert.deepEqual(app.nilai.board.players[0], [
    { name: "en:analisa.pemain.putih", elo: "NOELO" }, { name: "en:analisa.pemain.hitam", elo: "NOELO" },
  ]);
});

test("provider setters and controller identity are stable while non-player values are passed through unchanged", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const awal = app.nilai.board;
  const setters = Object.fromEntries(namaField.map((nama) => [nama, awal[nama][1]]));
  const controller = awal.gameController;
  const line = { moveNumber: -1, moves: [], arrows: {}, extra: true };
  app.update();
  assert.strictEqual(app.nilai.board, awal);
  act(() => {
    setters.white("white-as-is"); setters.time(-2.5); setters.depth("depth-as-is");
    setters.customLine(line); setters.result({ arbitrary: true });
  });
  const sekarang = app.nilai.board;
  assert.notStrictEqual(sekarang, awal);
  assert.equal(sekarang.white[0], "white-as-is");
  assert.equal(sekarang.time[0], -2.5);
  assert.equal(sekarang.depth[0], "depth-as-is");
  assert.strictEqual(sekarang.customLine[0], line);
  assert.deepEqual(sekarang.result[0], { arbitrary: true });
  assert.strictEqual(sekarang.gameController, controller);
  for (const nama of namaField) assert.strictEqual(sekarang[nama][1], setters[nama], nama);
});

test("two providers in one module registry isolate their board and screen states and controllers", (tes) => {
  const ling = lingkungan(tes);
  const muat = pemuat(ling);
  const satu = siapkan(ling, muat);
  const dua = siapkan(ling, muat);
  assert.strictEqual(satu.konteks.BoardContext, dua.konteks.BoardContext);
  assert.notStrictEqual(satu.nilai.board, dua.nilai.board);
  assert.notStrictEqual(satu.nilai.board.gameController, dua.nilai.board.gameController);
  assert.notStrictEqual(satu.nilai.setTampilan, dua.nilai.setTampilan);
  act(() => { satu.nilai.board.depth[1](9); satu.nilai.setTampilan("akun"); });
  assert.equal(satu.nilai.board.depth[0], 9);
  assert.equal(satu.nilai.tampilan[0], "akun");
  assert.equal(dua.nilai.board.depth[0], 8);
  assert.equal(dua.nilai.tampilan[0], "papan");
  const controller = satu.nilai.board.gameController;
  satu.unmount();
  const baru = siapkan(ling, muat);
  assert.equal(baru.nilai.board.depth[0], 8);
  assert.equal(baru.nilai.tampilan[0], "papan");
  assert.notStrictEqual(baru.nilai.board.gameController, controller);
});

test("screen changes notify only screen consumers; board changes do not notify screen or setter-only consumers", (tes) => {
  const ling = lingkungan(tes);
  const muat = pemuat(ling);
  const { BoardProvider } = muat(pathProvider);
  const ctx = muat(pathKonteks);
  const hitung = { board: 0, layar: 0, setter: 0 };
  const nilai = {};
  const Board = React.memo(function Board() { hitung.board++; nilai.board = ctx.useBoard(); return null; });
  const Layar = React.memo(function Layar() { hitung.layar++; nilai.layar = ctx.useTampilan(); return null; });
  const Setter = React.memo(function Setter() { hitung.setter++; nilai.setter = ctx.useSetTampilan(); return null; });
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(BoardProvider, null, React.createElement(Board), React.createElement(Layar), React.createElement(Setter))); });
  ling.sebelumPulih(() => act(() => renderer.unmount()));
  const awal = { ...hitung };
  const board = nilai.board;
  const setTampilan = nilai.setter;
  act(() => nilai.setter("pengaturan"));
  assert.equal(nilai.layar[0], "pengaturan");
  assert.strictEqual(nilai.layar[1], setTampilan);
  assert.strictEqual(nilai.board, board);
  assert.deepEqual(hitung, { board: awal.board, layar: awal.layar + 1, setter: awal.setter });
  act(() => nilai.board.depth[1](13));
  assert.equal(nilai.board.depth[0], 13);
  assert.deepEqual(hitung, { board: awal.board + 1, layar: awal.layar + 1, setter: awal.setter });
});

test("screen setters accept arbitrary values and remain stable independently of the board", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const board = app.nilai.board;
  const pair = app.nilai.tampilan;
  const setter = app.nilai.setTampilan;
  act(() => setter("layar-custom"));
  assert.equal(app.nilai.tampilan[0], "layar-custom");
  assert.strictEqual(app.nilai.tampilan[1], setter);
  assert.strictEqual(app.nilai.board, board);
  assert.notStrictEqual(app.nilai.tampilan, pair);
  act(() => setter((lama) => `${lama}-updater`));
  assert.equal(app.nilai.tampilan[0], "layar-custom-updater");
  assert.equal(ling.operasi.some(([, aksi]) => aksi === "set"), false);
});

test("with an empty game, last sets moveNumber to minus one and first resets it to zero", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  act(() => kontrol.last());
  assert.equal(app.nilai.board.moveNumber[0], -1);
  assert.equal(app.nilai.board.animation[0], false);
  act(() => kontrol.first());
  assert.equal(app.nilai.board.moveNumber[0], 0);
  assert.equal(app.nilai.board.animation[0], false);
  act(() => kontrol.back());
  assert.equal(app.nilai.board.moveNumber[0], 0);
});

test("main-line back and forward respect boundaries and set movement flags", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  act(() => {
    app.nilai.board.game[1]([{ pos: 0 }, { pos: 1 }, { pos: 2 }]);
    app.nilai.board.forward[1](false); app.nilai.board.animation[1](false);
    app.nilai.board.returnedToNormalGame[1]("lama");
  });
  act(() => kontrol.forward());
  assert.equal(app.nilai.board.moveNumber[0], 1);
  assert.equal(app.nilai.board.forward[0], true);
  assert.equal(app.nilai.board.animation[0], true);
  assert.equal(app.nilai.board.returnedToNormalGame[0], null);
  act(() => kontrol.forward());
  assert.equal(app.nilai.board.moveNumber[0], 2);
  act(() => kontrol.forward());
  assert.equal(app.nilai.board.moveNumber[0], 2);
  act(() => kontrol.back());
  assert.equal(app.nilai.board.moveNumber[0], 1);
  assert.equal(app.nilai.board.forward[0], false);
  assert.equal(app.nilai.board.animation[0], true);
  act(() => kontrol.back());
  assert.equal(app.nilai.board.moveNumber[0], 0);
  act(() => { app.nilai.board.animation[1](false); app.nilai.board.returnedToNormalGame[1]("tetap"); });
  act(() => kontrol.back());
  assert.equal(app.nilai.board.moveNumber[0], 0);
  assert.equal(app.nilai.board.animation[0], false);
  assert.equal(app.nilai.board.returnedToNormalGame[0], "tetap");
});

test("main-line first and last select endpoints, clear return state, and disable animation without changing direction", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  act(() => {
    app.nilai.board.game[1]([0, 1, 2, 3]); app.nilai.board.moveNumber[1](2);
    app.nilai.board.forward[1](false); app.nilai.board.returnedToNormalGame[1]("lama");
  });
  act(() => kontrol.first());
  assert.equal(app.nilai.board.moveNumber[0], 0);
  assert.equal(app.nilai.board.animation[0], false);
  assert.equal(app.nilai.board.forward[0], false);
  assert.equal(app.nilai.board.returnedToNormalGame[0], null);
  act(() => { app.nilai.board.animation[1](true); app.nilai.board.returnedToNormalGame[1]("lagi"); });
  act(() => kontrol.last());
  assert.equal(app.nilai.board.moveNumber[0], 3);
  assert.equal(app.nilai.board.animation[0], false);
  assert.equal(app.nilai.board.forward[0], false);
  assert.equal(app.nilai.board.returnedToNormalGame[0], null);
});

test("moving within a custom line preserves its moves and arrows while setting direction", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  const moves = [{ movement: ["a", "b"] }, { movement: ["c", "d"] }];
  const arrows = { 0: ["arrow"] };
  act(() => {
    app.nilai.board.game[1]([0, 1, 2]);
    app.nilai.board.customLine[1]({ moveNumber: 1, moves, arrows, ekstra: true });
    app.nilai.board.returnedToNormalGame[1]("lama");
  });
  act(() => kontrol.back());
  assert.equal(app.nilai.board.customLine[0].moveNumber, 0);
  assert.strictEqual(app.nilai.board.customLine[0].moves, moves);
  assert.strictEqual(app.nilai.board.customLine[0].arrows, arrows);
  assert.equal(app.nilai.board.customLine[0].ekstra, true);
  assert.equal(app.nilai.board.forward[0], false);
  assert.equal(app.nilai.board.animation[0], true);
  assert.equal(app.nilai.board.returnedToNormalGame[0], null);
  act(() => kontrol.forward());
  assert.equal(app.nilai.board.customLine[0].moveNumber, 1);
  assert.equal(app.nilai.board.forward[0], true);
  act(() => kontrol.forward());
  assert.equal(app.nilai.board.customLine[0].moveNumber, 1);
});

test("back from the first PGN variation clears the line and returns the first movement", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  const movement = [{ col: 1, row: 2 }, { col: 3, row: 4 }];
  act(() => {
    app.nilai.board.game[1]([0, 1, 2]); app.nilai.board.moveNumber[1](1);
    app.nilai.board.customLine[1]({ moveNumber: 0, moves: [{ movement }], arrows: { 0: ["x"] } });
  });
  act(() => kontrol.back());
  assert.deepEqual(app.nilai.board.customLine[0], { moveNumber: -1, moves: [], arrows: {} });
  assert.strictEqual(app.nilai.board.returnedToNormalGame[0], movement);
  assert.equal(app.nilai.board.moveNumber[0], 1);
  act(() => kontrol.forward());
  assert.equal(app.nilai.board.moveNumber[0], 2);
  assert.equal(app.nilai.board.returnedToNormalGame[0], null);
});

test("first in a PGN variation clears the line, exposes its first movement and keeps the main position", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  const movement = ["from", "to"];
  act(() => {
    app.nilai.board.game[1]([0, 1, 2]); app.nilai.board.moveNumber[1](1);
    app.nilai.board.customLine[1]({ moveNumber: 1, moves: [{ movement }, {}], arrows: { 0: [] } });
  });
  act(() => kontrol.first());
  assert.deepEqual(app.nilai.board.customLine[0], { moveNumber: -1, moves: [], arrows: {} });
  assert.strictEqual(app.nilai.board.returnedToNormalGame[0], movement);
  assert.equal(app.nilai.board.moveNumber[0], 1);
  assert.equal(app.nilai.board.animation[0], false);
});

test("a single-position FEN line survives return to origin, forward, first and last", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  const movement = ["start", "finish"];
  const moves = [{ movement }, { movement: ["another"] }];
  const arrows = { 0: ["arrow"], 1: [] };
  act(() => {
    app.nilai.board.game[1]([{ fen: "awal" }]);
    app.nilai.board.customLine[1]({ moveNumber: 0, moves, arrows });
  });
  act(() => kontrol.back());
  assert.equal(app.nilai.board.customLine[0].moveNumber, -1);
  assert.strictEqual(app.nilai.board.customLine[0].moves, moves);
  assert.strictEqual(app.nilai.board.customLine[0].arrows, arrows);
  assert.strictEqual(app.nilai.board.returnedToNormalGame[0], movement);
  act(() => kontrol.forward());
  assert.equal(app.nilai.board.customLine[0].moveNumber, 0);
  assert.equal(app.nilai.board.returnedToNormalGame[0], null);
  act(() => kontrol.first());
  assert.equal(app.nilai.board.customLine[0].moveNumber, -1);
  assert.strictEqual(app.nilai.board.customLine[0].moves, moves);
  assert.equal(app.nilai.board.animation[0], false);
  act(() => kontrol.last());
  assert.equal(app.nilai.board.customLine[0].moveNumber, 1);
  assert.strictEqual(app.nilai.board.customLine[0].arrows, arrows);
  assert.equal(app.nilai.board.animation[0], false);
});

test("a missing first variation movement returns null rather than inventing a movement", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  act(() => { app.nilai.board.game[1]([0, 1]); app.nilai.board.customLine[1]({ moveNumber: 0, moves: [{}], arrows: {} }); });
  act(() => app.nilai.board.gameController.back());
  assert.equal(app.nilai.board.returnedToNormalGame[0], null);
  assert.deepEqual(app.nilai.board.customLine[0], { moveNumber: -1, moves: [], arrows: {} });
});

test("commands in one batch read pre-effect refs, including repeated forward beyond the last main position", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  act(() => { app.nilai.board.game[1]([0, 1, 2]); kontrol.last(); });
  assert.equal(app.nilai.board.moveNumber[0], -1, "last uses the previous empty-game length in the same batch");
  act(() => kontrol.last());
  assert.equal(app.nilai.board.moveNumber[0], 2);
  act(() => { app.nilai.board.game[1]([0, 1]); app.nilai.board.moveNumber[1](0); });
  act(() => { kontrol.forward(); kontrol.forward(); });
  assert.equal(app.nilai.board.moveNumber[0], 2, "both calls compare the same pre-effect move ref");
});

test("play, pause and togglePlay only update playing and preserve the controller object", (tes) => {
  const ling = lingkungan(tes);
  const app = siapkan(ling);
  const kontrol = app.nilai.board.gameController;
  act(() => kontrol.play());
  assert.equal(app.nilai.board.playing[0], true);
  act(() => kontrol.play());
  assert.equal(app.nilai.board.playing[0], true);
  act(() => kontrol.togglePlay());
  assert.equal(app.nilai.board.playing[0], false);
  act(() => kontrol.togglePlay());
  assert.equal(app.nilai.board.playing[0], true);
  act(() => kontrol.pause());
  assert.equal(app.nilai.board.playing[0], false);
  assert.strictEqual(app.nilai.board.gameController, kontrol);
  assert.equal(app.nilai.board.moveNumber[0], 0);
});

test("the real Analyze provider forwards every board pair and controller while import state remains independent", (tes) => {
  const ling = lingkungan(tes);
  const muat = pemuat(ling);
  const Analyze = muat("src/halaman/Analisa/konteks/analyze.jsx").default;
  const { AnalyzeContext } = muat("src/halaman/Analisa/konteks/analyzeKonteks.js");
  const boardApi = muat(pathKonteks);
  const { useImport } = muat("src/halaman/Analisa/konteks/importKonteks.js");
  let board;
  let imp;
  let gabungan;
  let tampilan;
  function Probe() { board = boardApi.useBoard(); tampilan = boardApi.useTampilan(); imp = useImport(); gabungan = React.useContext(AnalyzeContext); return null; }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Analyze, null, React.createElement(Probe))); });
  ling.sebelumPulih(() => act(() => renderer.unmount()));
  for (const nama of namaField) assert.strictEqual(gabungan[nama], board[nama], nama);
  assert.strictEqual(gabungan.gameController, board.gameController);
  assert.equal(Object.hasOwn(gabungan, "tampilan"), false);
  const imporAwal = imp;
  act(() => board.game[1]([{ fen: "awal" }, { fen: "berikut" }]));
  assert.strictEqual(gabungan.game, board.game);
  assert.equal(gabungan.game[0].length, 2);
  assert.strictEqual(imp, imporAwal);
  const boardAwal = board;
  act(() => imp.progress[1](30));
  assert.strictEqual(board, boardAwal);
  assert.strictEqual(gabungan.progress, imp.progress);
  assert.equal(gabungan.progress[0], 30);
  act(() => tampilan[1]("akun"));
  assert.equal(tampilan[0], "akun");
  assert.strictEqual(board, boardAwal);
});

test("the real TabKerja provider observes the Board navigation contexts and retains its draft coordination", async (tes) => {
  const ling = lingkungan(tes);
  const store = storePekerjaan();
  const muat = pemuat(ling, store);
  const { BoardProvider } = muat(pathProvider);
  const boardApi = muat(pathKonteks);
  const { TabKerjaProvider, useTabKerja } = muat("src/modul/sesi/TabKerjaProvider.jsx");
  let tab;
  let tampilan;
  function Probe() { tab = useTabKerja(); tampilan = boardApi.useTampilan(); return null; }
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(BoardProvider, null, React.createElement(TabKerjaProvider, null, React.createElement(Probe)))); await flush(); });
  ling.sebelumPulih(() => act(() => renderer.unmount()));
  assert.equal(tampilan[0], "papan");
  await act(async () => { tampilan[1]("akun"); await flush(); });
  assert.equal(tampilan[0], "akun");
  await act(async () => { assert.equal(tab.bukaPapan(), undefined); await flush(); });
  assert.equal(tampilan[0], "papan");
  let hasil;
  await act(async () => { hasil = await tab.bukaImpor("draf:lama"); await flush(); });
  assert.equal(hasil, true);
  assert.equal(tampilan[0], "impor");
  assert.equal(store.initCalls, 1);
  assert.deepEqual(store.drafAktif, ["draf:lama"]);
  assert.equal(tab.daftar.find((item) => item.id === tab.aktifId).drafId, "draf:lama");
  assert.ok(ling.sesi.data.has("maestro-analisa-tab-v1"));
});
