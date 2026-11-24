import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import * as titipan from "../src/lib/titipanAnalisa.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function pasangStorage(tes, awal = []) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const data = new Map(awal);
  const operasi = [];
  const storage = {
    data, operasi,
    getItem(key) { operasi.push(["get", key]); return data.get(key) ?? null; },
    setItem(key, value) { operasi.push(["set", key, String(value)]); data.set(key, String(value)); },
    removeItem(key) { operasi.push(["remove", key]); data.delete(key); },
  };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: storage });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, "sessionStorage", lama);
    else delete globalThis.sessionStorage;
  });
  return storage;
}

test("the original handoff module exposes its three names and exact session key", () => {
  assert.deepEqual(Object.keys(titipan).sort(), ["KUNCI_PGN_TITIPAN", "adaPgnTitipan", "ambilPgnTitipan"]);
  assert.equal(titipan.KUNCI_PGN_TITIPAN, "maestro-analisa-impor-awal");
});

test("presence checks never consume the exact PGN; the first take removes it and the next take is empty", (tes) => {
  const pgn = "[Event \"Uji\"]\n\n1. e4 e5 *\n";
  const kunci = titipan.KUNCI_PGN_TITIPAN;
  const storage = pasangStorage(tes, [[kunci, pgn]]);
  assert.equal(titipan.adaPgnTitipan(), true);
  assert.equal(titipan.adaPgnTitipan(), true);
  assert.equal(storage.data.get(kunci), pgn);
  assert.equal(titipan.ambilPgnTitipan(), pgn);
  assert.equal(titipan.adaPgnTitipan(), false);
  assert.equal(titipan.ambilPgnTitipan(), "");
  assert.deepEqual(storage.operasi, [["get", kunci], ["get", kunci], ["get", kunci], ["remove", kunci], ["get", kunci], ["get", kunci]]);
});

test("empty and absent values are not removed, while non-empty strings are consumed without validation", (tes) => {
  const kunci = titipan.KUNCI_PGN_TITIPAN;
  const storage = pasangStorage(tes, [[kunci, ""]]);
  assert.equal(titipan.adaPgnTitipan(), false);
  assert.equal(titipan.ambilPgnTitipan(), "");
  assert.equal(storage.data.has(kunci), true, "nilai kosong tetap tersimpan");
  assert.equal(storage.operasi.some(([op]) => op === "remove"), false);
  for (const raw of [" ", "0", "bukan PGN", "1. e4 *\n"]) {
    storage.data.set(kunci, raw);
    assert.equal(titipan.adaPgnTitipan(), true, raw);
    assert.equal(titipan.ambilPgnTitipan(), raw, raw);
    assert.equal(storage.data.has(kunci), false, raw);
  }
  assert.equal(storage.operasi.filter(([op]) => op === "set").length, 0);
});

test("missing sessionStorage and a blocked global getter fail silently", (tes) => {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const errorAsli = console.error;
  const galat = [];
  console.error = (...args) => galat.push(args);
  tes.after(() => {
    console.error = errorAsli;
    if (lama) Object.defineProperty(globalThis, "sessionStorage", lama);
    else delete globalThis.sessionStorage;
  });
  delete globalThis.sessionStorage;
  assert.equal(titipan.adaPgnTitipan(), false);
  assert.equal(titipan.ambilPgnTitipan(), "");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("access blocked"); } });
  assert.equal(titipan.adaPgnTitipan(), false);
  assert.equal(titipan.ambilPgnTitipan(), "");
  assert.deepEqual(galat, []);
});

test("read errors are silent and do not attempt removal", (tes) => {
  const kunci = titipan.KUNCI_PGN_TITIPAN;
  const storage = pasangStorage(tes, [[kunci, "1. e4 *"]]);
  storage.getItem = (key) => { storage.operasi.push(["get", key]); throw new Error("read blocked"); };
  const errorAsli = console.error;
  const galat = [];
  console.error = (...args) => galat.push(args);
  tes.after(() => { console.error = errorAsli; });
  assert.equal(titipan.adaPgnTitipan(), false);
  assert.equal(titipan.ambilPgnTitipan(), "");
  assert.deepEqual(storage.operasi, [["get", kunci], ["get", kunci]]);
  assert.equal(storage.data.get(kunci), "1. e4 *");
  assert.deepEqual(galat, []);
});

test("a removal error makes the take return empty even though this storage still retains the PGN", (tes) => {
  const kunci = titipan.KUNCI_PGN_TITIPAN;
  const storage = pasangStorage(tes, [[kunci, "1. e4 *"]]);
  storage.removeItem = (key) => { storage.operasi.push(["remove", key]); throw new Error("remove blocked"); };
  assert.equal(titipan.ambilPgnTitipan(), "");
  assert.equal(storage.data.get(kunci), "1. e4 *");
  assert.equal(titipan.adaPgnTitipan(), true);
  assert.deepEqual(storage.operasi, [["get", kunci], ["remove", kunci], ["get", kunci]]);
});

test("the real ImportProvider checks the handoff on mount without consuming it", async (tes) => {
  const kunci = titipan.KUNCI_PGN_TITIPAN;
  const storage = pasangStorage(tes, [[kunci, "1. e4 *"]]);
  let nomor = 0;
  const muat = buatPemuatJsx({
    "src/modul/pekerjaan/index.js": {
      buatIdPekerjaan: () => `laporan:uji-${++nomor}`,
      pekerjaan: { snapshot: () => ({ daftar: [], aktif: {} }) },
      simpanLaporanAktif: () => {},
    },
  });
  const { ImportProvider } = muat("src/halaman/Analisa/konteks/import.jsx");
  const { ImportContext } = muat("src/halaman/Analisa/konteks/importKonteks.js");
  let nilai;
  function Probe() { nilai = React.useContext(ImportContext); return null; }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(ImportProvider, null, React.createElement(Probe))); await flush(); });
  assert.equal(nilai.pageState[0], "loading");
  assert.equal(storage.data.get(kunci), "1. e4 *");
  assert.equal(storage.operasi.some(([op]) => op === "remove"), false);
  assert.equal(titipan.ambilPgnTitipan(), "1. e4 *");
  assert.equal(nilai.pageState[0], "loading", "presence is only read by the lazy initializer");
  await act(async () => { renderer.unmount(); renderer = TestRenderer.create(React.createElement(ImportProvider, null, React.createElement(Probe))); await flush(); });
  assert.equal(nilai.pageState[0], "default");
  assert.equal(storage.data.has(kunci), false);
});
