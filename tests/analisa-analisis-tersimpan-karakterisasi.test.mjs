import assert from "node:assert/strict";
import React, { useRef, useState } from "react";
import TestRenderer from "react-test-renderer";
import test from "node:test";
import * as analisisTersimpan from "../src/halaman/Analisa/mesin/analisisTersimpan.js";
import { ringkasAnalisis } from "../src/halaman/Analisa/mesin/ringkasanAnalisis.js";
import { hashPgn } from "../src/lib/pgnRingan.js";
import { useMuatPartai } from "../src/halaman/Analisa/komponen/game/useMuatPartai.js";

const { act } = TestRenderer;
const noop = () => {};
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("analisisTersimpan exposes exact six named exports without default", () => {
  assert.deepEqual(Object.keys(analisisTersimpan).sort(), [
    "ambilPetaAnalisis",
    "bersihkanAnalisis",
    "catatAnalisis",
    "hapusAnalisis",
    "jumlahAnalisis",
    "langgananAnalisis",
  ]);
  assert.equal(Object.hasOwn(analisisTersimpan, "default"), false);
});

test("catatAnalisis trims keys, requires complete status and ignores rejected inputs silently", (t) => {
  const { catatAnalisis, bersihkanAnalisis, ambilPetaAnalisis, jumlahAnalisis, langgananAnalisis } = analisisTersimpan;
  t.after(() => bersihkanAnalisis());
  bersihkanAnalisis();

  let notifikasi = 0;
  const berhenti = langgananAnalisis(() => { notifikasi++; });
  t.after(berhenti);

  for (const id of ["", "   ", null, undefined]) {
    catatAnalisis(id, { status: "complete" });
  }
  catatAnalisis("kunci-1", null);
  catatAnalisis("kunci-1", undefined);
  catatAnalisis("kunci-1", { status: "loading" });
  catatAnalisis("kunci-1", { status: "error" });
  catatAnalisis("kunci-1", {});

  assert.equal(jumlahAnalisis(), 0);
  assert.deepEqual(ambilPetaAnalisis(), {});
  assert.equal(notifikasi, 0);

  const pertama = { status: "complete", totalPlies: 4 };
  catatAnalisis("  partai-a  ", pertama);
  assert.equal(jumlahAnalisis(), 1);
  assert.equal(notifikasi, 1);
  assert.strictEqual(ambilPetaAnalisis()["partai-a"], pertama);

  const kedua = { status: "complete", totalPlies: 8 };
  catatAnalisis("partai-a", kedua);
  assert.equal(jumlahAnalisis(), 1);
  assert.equal(notifikasi, 2);
  assert.strictEqual(ambilPetaAnalisis()["partai-a"], kedua);
});

test("hapusAnalisis and bersihkanAnalisis preserve no-op guards and fire listeners only on real changes", (t) => {
  const { catatAnalisis, hapusAnalisis, bersihkanAnalisis, ambilPetaAnalisis, jumlahAnalisis, langgananAnalisis } = analisisTersimpan;
  t.after(() => bersihkanAnalisis());
  bersihkanAnalisis();

  let notifikasi = 0;
  const berhenti = langgananAnalisis(() => { notifikasi++; });
  t.after(berhenti);

  bersihkanAnalisis();
  hapusAnalisis("");
  hapusAnalisis("   ");
  hapusAnalisis("tidak-ada");
  assert.equal(notifikasi, 0);

  catatAnalisis("p1", { status: "complete", n: 1 });
  catatAnalisis("p2", { status: "complete", n: 2 });
  assert.equal(notifikasi, 2);

  hapusAnalisis("tidak-ada");
  assert.equal(notifikasi, 2);
  hapusAnalisis("  p1  ");
  assert.equal(notifikasi, 3);
  assert.equal(jumlahAnalisis(), 1);
  assert.deepEqual(Object.keys(ambilPetaAnalisis()), ["p2"]);

  bersihkanAnalisis();
  assert.equal(notifikasi, 4);
  assert.equal(jumlahAnalisis(), 0);
  assert.deepEqual(ambilPetaAnalisis(), {});

  bersihkanAnalisis();
  assert.equal(notifikasi, 4);
});

test("ambilPetaAnalisis creates a fresh object per call while keeping entry value references", (t) => {
  const { catatAnalisis, bersihkanAnalisis, ambilPetaAnalisis } = analisisTersimpan;
  t.after(() => bersihkanAnalisis());
  bersihkanAnalisis();

  const hasil = { status: "complete", summary: { w: {}, b: {} } };
  catatAnalisis("kunci", hasil);

  const snap1 = ambilPetaAnalisis();
  const snap2 = ambilPetaAnalisis();
  assert.notStrictEqual(snap1, snap2);
  assert.deepEqual(snap1, snap2);
  assert.strictEqual(snap1.kunci, hasil);
  assert.strictEqual(snap2.kunci, hasil);
});

test("langgananAnalisis guards non-functions, uses Set semantics, snapshots listeners and isolates exceptions", (t) => {
  const { catatAnalisis, bersihkanAnalisis, langgananAnalisis } = analisisTersimpan;
  t.after(() => bersihkanAnalisis());
  bersihkanAnalisis();

  const batalNonFungsi = langgananAnalisis("bukan-fungsi");
  assert.equal(typeof batalNonFungsi, "function");
  assert.doesNotThrow(() => batalNonFungsi());

  const urutan = [];
  let batalB = noop;
  const cbA = () => {
    urutan.push("A");
    batalB();
  };
  const cbRusak = () => {
    urutan.push("rusak");
    throw new Error("pendengar gagal");
  };
  const cbB = () => {
    urutan.push("B");
  };

  const batalA = langgananAnalisis(cbA);
  const batalADuplikat = langgananAnalisis(cbA);
  const batalRusak = langgananAnalisis(cbRusak);
  batalB = langgananAnalisis(cbB);
  t.after(() => {
    batalA();
    batalADuplikat();
    batalRusak();
    batalB();
  });

  // Snapshot Array.from(pendengar) memastikan cbB tetap menerima putaran saat ini
  // meski dibatalkan oleh cbA, lalu tidak terpanggil pada putaran berikutnya;
  // cbA hanya terpanggil sekali (Set) dan error cbRusak ditelan.
  catatAnalisis("g1", { status: "complete", ronde: 1 });
  assert.deepEqual(urutan, ["A", "rusak", "B"]);

  urutan.length = 0;
  catatAnalisis("g2", { status: "complete", ronde: 2 });
  assert.deepEqual(urutan, ["A", "rusak"]);

  batalA();
  urutan.length = 0;
  catatAnalisis("g3", { status: "complete", ronde: 3 });
  assert.deepEqual(urutan, ["rusak"]);
});

test("useMuatPartai records PGN analysis results into analisisTersimpan and notifies subscribers", async (t) => {
  const { ambilPetaAnalisis, bersihkanAnalisis, jumlahAnalisis, langgananAnalisis } = analisisTersimpan;
  t.after(() => bersihkanAnalisis());
  bersihkanAnalisis();

  const fetchAsli = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  t.after(() => { globalThis.fetch = fetchAsli; });

  const notifikasi = [];
  const berhenti = langgananAnalisis(() => notifikasi.push(ambilPetaAnalisis()));
  t.after(berhenti);

  const pgnText = '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 *';
  const expectedKey = hashPgn(pgnText);
  const engine = {
    gameBaru: noop,
    setop: noop,
    async cari() {
      return { staticEval: ["cp", "15"], bestMove: undefined, daftarKandidat: [] };
    },
  };

  let recordedMoves = null;
  function Harness({ data }) {
    const [controller, setController] = useState(() => new AbortController());
    const boardSoundsRef = useRef(false);
    useMuatPartai({
      data, depth: 6, boardSoundsRef, t: (k) => k, siapkan: async () => engine,
      analyzeController: controller, setAnalyzeController: setController,
      setPageState: noop, setPlayers: noop, setGame: (v) => { recordedMoves = v; }, setErrors: noop,
      setTab: noop, setProgress: noop, setLangkahSementara: noop, setTime: noop,
      setResult: noop, setAnimation: noop, setArrows: noop, setCustomLine: noop,
      setAnalyzingMove: noop, setMoveNumber: noop, setWhite: noop, setPlaying: noop,
    });
    return null;
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness, { data: { format: "pgn", string: pgnText } }));
    await flush();
  });
  t.after(() => renderer.unmount());

  assert.equal(jumlahAnalisis(), 1);
  assert.equal(notifikasi.length, 1);
  const tersimpan = ambilPetaAnalisis()[expectedKey];
  assert.ok(tersimpan);
  assert.equal(tersimpan.status, "complete");
  assert.equal(tersimpan.totalPlies, 2);
  assert.equal(tersimpan.summary.w.eligibleMoves, 1);
  assert.equal(tersimpan.summary.b.eligibleMoves, 1);
  assert.deepEqual(tersimpan, ringkasAnalisis(recordedMoves));
});
