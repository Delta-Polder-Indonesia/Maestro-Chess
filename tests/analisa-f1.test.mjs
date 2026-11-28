// Pengunci tier F1 adopsi En Croissant: tampilan WDL (ScoreBubble), batas
// kekuatan UCI_LimitStrength/UCI_Elo, dan tablebase endgame Lichess
// (TablebaseInfo). Menguji modul murni tablebase, plumbing opsi Elo ke worker,
// FormatEval WDL + toggle, katalog "1 pintu", i18n, dan CSP connect-src.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import TestRenderer from "react-test-renderer";
import ts from "typescript";
import { EngineCatur } from "../src/modul/analisis/engineCatur.js";
import { RENTANG_ELO } from "../src/halaman/Analisa/mesin/rentangElo.js";
import {
  URL_TABLEBASE, jumlahBidak, hasilPihak, urutkanLangkah, ambilTablebase, bersihkanCacheTablebase,
} from "../src/modul/analisis/tablebase.js";
import { ConfigContext } from "../src/modul/sesi/configKonteks.js";
import { BARIS_STATIS, GRUP_META } from "../src/halaman/Analisa/komponen/pengaturan/katalogPengaturan.js";
import { analisa as analisaId } from "../src/lib/terjemahan/id/analisa.js";
import { analisa as analisaEn } from "../src/lib/terjemahan/en/analisa.js";

const require = createRequire(import.meta.url);
const { act } = TestRenderer;
const noop = () => {};

function kompilasi(path, dependencies) {
  const filename = new URL(path, import.meta.url);
  const out = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename.pathname,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const factory = runInThisContext(`(function (require, module, exports) {\n${out}\n})`);
  const result = { exports: {} };
  factory((id) => {
    if (id === "react" || id === "react/jsx-runtime") return require(id);
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, result, result.exports);
  return result.exports;
}

function gantiGlobal(tes, values) {
  const lama = Object.fromEntries(Object.keys(values).map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(values)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v });
  tes.after(() => { for (const [k, d] of Object.entries(lama)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } });
}

function pasangWorker(tes) {
  const daftar = [];
  class WorkerTiruan {
    constructor(url) { this.url = url; this.perintah = []; this.terminasi = 0; daftar.push(this); }
    postMessage(p) { this.perintah.push(p); }
    terminate() { this.terminasi++; }
    kirim(baris) { this.onmessage?.({ data: baris }); }
  }
  gantiGlobal(tes, { Worker: WorkerTiruan });
  return daftar;
}

/* ------------------------------ Tablebase ------------------------------ */

test("jumlahBidak counts pieces from the FEN board field only", () => {
  assert.equal(jumlahBidak("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), 32);
  assert.equal(jumlahBidak("8/8/8/4k3/8/8/4K3/4R3 w - - 0 1"), 3);
  assert.equal(jumlahBidak("8/8/8/8/8/8/8/8 w - - 0 1"), 0);
  assert.equal(jumlahBidak(null), 0);
});

test("hasilPihak maps every category to the correct outcome for both turns", () => {
  assert.equal(hasilPihak("win", "white"), "putih");
  assert.equal(hasilPihak("win", "black"), "hitam");
  assert.equal(hasilPihak("loss", "white"), "hitam");
  assert.equal(hasilPihak("loss", "black"), "putih");
  for (const k of ["draw", "blessed-loss", "cursed-win"]) {
    assert.equal(hasilPihak(k, "white"), "seri", k);
    assert.equal(hasilPihak(k, "black"), "seri", k);
  }
  for (const k of ["unknown", "maybe-win", "maybe-loss"]) {
    assert.equal(hasilPihak(k, "white"), "tidakDiketahui", k);
  }
});

test("urutkanLangkah puts opponent-loss (best) first and opponent-win last", () => {
  const moves = [{ uci: "a", category: "win" }, { uci: "b", category: "draw" }, { uci: "c", category: "loss" }, { uci: "d", category: "unknown" }];
  assert.deepEqual(urutkanLangkah(moves).map((m) => m.uci), ["c", "b", "d", "a"]);
  // Tidak memutasi masukan.
  assert.equal(moves[0].uci, "a");
});

test("ambilTablebase fetches the encoded FEN, normalises, sorts, and caches per FEN", async () => {
  bersihkanCacheTablebase();
  const panggilan = [];
  const fen = "8/8/8/4k3/8/8/4K3/4R3 w - - 0 1";
  const fetchImpl = async (url, opts) => {
    panggilan.push({ url, signal: opts?.signal });
    return {
      ok: true,
      json: async () => ({
        category: "win", dtz: 5, dtm: 9,
        moves: [
          { uci: "e1e2", san: "Ke2", category: "win", dtz: -3, dtm: null },
          { uci: "e1d1", san: "Kd1", category: "loss", dtz: 2, dtm: 4 },
          { uci: "", san: "X", category: "draw" },
        ],
      }),
    };
  };
  const hasil = await ambilTablebase(fen, { fetchImpl });
  assert.equal(panggilan.length, 1);
  assert.equal(panggilan[0].url, `${URL_TABLEBASE}?fen=${encodeURIComponent(fen)}`);
  assert.equal(hasil.category, "win");
  assert.equal(hasil.dtm, 9);
  // loss dulu (langkah terbaik), lalu win; entri tanpa uci dibuang.
  assert.deepEqual(hasil.moves.map((m) => m.uci), ["e1d1", "e1e2"]);
  assert.equal(hasil.moves[0].dtm, 4);
  // Cache: pemanggilan kedua tidak.fetch lagi.
  await ambilTablebase(fen, { fetchImpl });
  assert.equal(panggilan.length, 1, "FEN sama dipakai dari cache");
  bersihkanCacheTablebase();
});

test("ambilTablebase does not cache failures and propagates abort signal", async () => {
  bersihkanCacheTablebase();
  let percobaan = 0;
  const fetchImpl = async () => {
    percobaan++;
    if (percobaan === 1) return { ok: false, status: 500 };
    return { ok: true, json: async () => ({ category: "draw", moves: [] }) };
  };
  const controller = new AbortController();
  await assert.rejects(() => ambilTablebase("fen-gagal", { fetchImpl, signal: controller.signal }), /HTTP 500/);
  // Gagal tidak di-cache → percobaan berikutnya.fetch lagi dan berhasil.
  const hasil = await ambilTablebase("fen-gagal", { fetchImpl });
  assert.equal(percobaan, 2);
  assert.equal(hasil.category, "draw");
  bersihkanCacheTablebase();
});

/* ------------------------------ UCI_Elo ------------------------------ */

test("RENTANG_ELO is the Stockfish 16.1+ range with a sane default", () => {
  assert.equal(RENTANG_ELO.min, 1320);
  assert.equal(RENTANG_ELO.max, 3190);
  assert.ok(RENTANG_ELO.bawaan >= RENTANG_ELO.min && RENTANG_ELO.bawaan <= RENTANG_ELO.max);
});

test("startup sends UCI_LimitStrength false by default and no UCI_Elo", async (tes) => {
  const workers = pasangWorker(tes);
  const mesin = new EngineCatur({ hash: 16 });
  const janji = mesin.mulai();
  workers[0].kirim("readyok");
  await janji;
  assert.ok(workers[0].perintah.includes("setoption name UCI_LimitStrength value false"));
  assert.equal(workers[0].perintah.some((p) => p.startsWith("setoption name UCI_Elo")), false);
  mesin.tamat();
});

test("limitStrength startup sends both UCI_LimitStrength true and UCI_Elo", async (tes) => {
  const workers = pasangWorker(tes);
  const mesin = new EngineCatur({ hash: 16, limitStrength: true, elo: 1500 });
  const janji = mesin.mulai();
  workers[0].kirim("readyok");
  await janji;
  assert.ok(workers[0].perintah.includes("setoption name UCI_LimitStrength value true"));
  assert.ok(workers[0].perintah.includes("setoption name UCI_Elo value 1500"));
  mesin.tamat();
});

test("terapkanElo toggles strength live without rebuilding the worker", async (tes) => {
  const workers = pasangWorker(tes);
  const mesin = new EngineCatur({ hash: 16 });
  const janji = mesin.mulai();
  workers[0].kirim("readyok");
  await janji;
  const worker = workers[0];
  mesin.terapkanElo({ limitStrength: true, elo: 1800 });
  assert.equal(mesin.limitStrength, true);
  assert.equal(mesin.elo, 1800);
  assert.ok(worker.perintah.includes("setoption name UCI_LimitStrength value true"));
  assert.ok(worker.perintah.includes("setoption name UCI_Elo value 1800"));
  mesin.terapkanElo({ limitStrength: false });
  assert.equal(worker.perintah.at(-1), "setoption name UCI_LimitStrength value false");
  assert.equal(workers.length, 1, "worker tidak dibuat ulang");
  mesin.tamat();
});

/* ------------------------------ WDL (FormatEval) ------------------------------ */

function muatFormatEval(tulisan) {
  const modul = kompilasi("../src/halaman/Analisa/komponen/menu/analysis/moves/comments.jsx", {
    "../../../svg/rating.jsx": { default: () => null },
    "../../../../../../lib/i18n.jsx": { useI18n: () => ({ t: (k) => k }) },
    "../../../../../../modul/analisis/evaluasi.js": { apakahMateTerminal: (e) => e?.[0] === "mate" && (e[1] === "0" || e[1] === undefined) },
    "../../../../../../modul/sesi/preferensi.js": { ConfigContext, tulis: (k, v) => tulisan.push([k, v]) },
  });
  return modul.FormatEval;
}

test("FormatEval shows centipawn by default and toggles to WDL on click", async () => {
  const tulisan = [];
  const FormatEval = muatFormatEval(tulisan);
  let renderer;
  function Harness() {
    const [evalDisplay, setEvalDisplay] = React.useState("cp");
    return React.createElement(ConfigContext.Provider, { value: { evalDisplay: [evalDisplay, setEvalDisplay] } },
      React.createElement(FormatEval, { evaluation: ["cp", "150"], white: true, wdl: [600, 300, 100] }));
  }
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  // Mode cp: teks +1.50, aria-pressed false.
  let badge = renderer.root.findByProps({ role: "button" });
  assert.equal(badge.props["aria-pressed"], false);
  assert.ok(badge.children.some((c) => typeof c === "string" && c.includes("1.50")));
  // Klik → wdl.
  await act(async () => { badge.props.onClick(); });
  assert.deepEqual(tulisan.at(-1), ["evalDisplay", "wdl"]);
  badge = renderer.root.findByProps({ role: "button" });
  assert.equal(badge.props["aria-pressed"], true);
  // Tiga segmen 60/30/10 dari sudut pandang putih.
  const segmen = badge.findAllByType("span");
  assert.equal(segmen.length, 3);
  assert.equal(segmen[0].props.style.width, "60%");
  assert.equal(segmen[1].props.style.width, "30%");
  assert.equal(segmen[2].props.style.width, "10%");
  await act(async () => { renderer.unmount(); });
});

test("FormatEval WDL normalises to white perspective when black is to move", async () => {
  const FormatEval = muatFormatEval([]);
  let renderer;
  function Harness() {
    return React.createElement(ConfigContext.Provider, { value: { evalDisplay: ["wdl", noop] } },
      React.createElement(FormatEval, { evaluation: ["cp", "-150"], white: false, wdl: [600, 300, 100] }));
  }
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  const segmen = renderer.root.findByProps({ role: "button" }).findAllByType("span");
  // wdl mentah [600,300,100] relatif pihak bergilir (hitam) → putih [100,300,600].
  assert.deepEqual(segmen.map((s) => s.props.style.width), ["10%", "30%", "60%"]);
  await act(async () => { renderer.unmount(); });
});

test("FormatEval falls back to mate text even in WDL mode (no WDL for mate)", async () => {
  const FormatEval = muatFormatEval([]);
  let renderer;
  function Harness() {
    return React.createElement(ConfigContext.Provider, { value: { evalDisplay: ["wdl", noop] } },
      React.createElement(FormatEval, { evaluation: ["mate", "3"], white: true, wdl: [900, 100, 0] }));
  }
  await act(async () => { renderer = TestRenderer.create(React.createElement(Harness)); });
  const badge = renderer.root.findByProps({ role: "button" });
  assert.equal(badge.findAllByType("span").length, 0, "tidak ada bar WDL untuk mate");
  assert.ok(badge.children.some((c) => typeof c === "string" && c.includes("M3")));
  await act(async () => { renderer.unmount(); });
});

/* ------------------------------ Katalog & i18n & CSP ------------------------------ */

test("catalog registers formatSkor and tablebase rows in the evaluation group (29 general rows)", () => {
  // Katalog hanya memuat pengaturan UMUM. Preferensi latihan teka-teki bersifat
  // personal untuk fitur itu dan tinggal di dalam layarnya, bukan di sini.
  assert.equal(BARIS_STATIS.length, 29);
  for (const kunci of ["puzzleRentangRating", "puzzleTema", "puzzleProgresif", "puzzleSembunyiRating", "puzzleLompatCepat", "puzzleCatatWaktu"]) {
    assert.equal(BARIS_STATIS.find((b) => b.kunci === kunci), undefined, `${kunci} tidak terdaftar di katalog umum`);
  }
  for (const kunci of ["formatSkor", "tablebase"]) {
    const baris = BARIS_STATIS.find((b) => b.kunci === kunci);
    assert.ok(baris, kunci);
    assert.equal(baris.grup, "penilaian");
  }
  assert.ok(GRUP_META.some((g) => g.id === "penilaian"));
});

test("F1 labels exist in both languages (score format, tablebase, Elo limit)", () => {
  for (const kamus of [analisaId, analisaEn]) {
    const p = kamus.pengaturan;
    for (const kunci of ["formatSkor", "klikEval", "tablebase", "batasiElo", "batasiEloDeskripsi", "batasiEloAktif"]) {
      assert.equal(typeof p[kunci], "string", kunci);
    }
    assert.equal(typeof p.opsiEval.cp, "string");
    assert.equal(typeof p.opsiEval.wdl, "string");
    assert.equal(typeof p.deskripsi.formatSkor, "string");
    assert.equal(typeof p.deskripsi.tablebase, "string");
    const tb = kamus.tablebase;
    for (const kunci of ["judul", "memuat", "gagal", "putihMenang", "hitamMenang", "seri", "tidakDiketahui", "aturan50", "dtm", "dtz", "langkahAria", "tanpaLangkah"]) {
      assert.equal(typeof tb[kunci], "string", kunci);
    }
  }
});

test("CSP connect-src permits the Lichess tablebase host", () => {
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const header = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy");
  assert.ok(header, "header CSP ada");
  const connect = header.value.split(";").map((s) => s.trim()).find((s) => s.startsWith("connect-src"));
  assert.ok(connect.includes("https://tablebase.lichess.org"), "host tablebase diizinkan");
  assert.ok(connect.includes("https://lichess.org"), "host lichess tetap ada");
});
