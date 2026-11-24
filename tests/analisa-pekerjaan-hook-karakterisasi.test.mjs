import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer from "react-test-renderer";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import {
  ID_DRAF_IMPOR, daftarkanPembacaLaporan, pekerjaan, simpanDrafImpor, simpanLaporanAktif,
} from "../src/halaman/Analisa/pekerjaan.js";
import { catatFitur } from "../src/halaman/Analisa/riwayatFitur.js";
import { usePekerjaan } from "../src/halaman/Analisa/usePekerjaan.js";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("the singleton hook, active reader, and default draft/history writers share one store", async (tes) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  const factory = new IDBFactory();
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: factory });
  tes.after(() => {
    if (original) Object.defineProperty(globalThis, "indexedDB", original);
    else delete globalThis.indexedDB;
  });
  let current;
  let renders = 0;
  function Probe() {
    current = usePekerjaan();
    renders++;
    return React.createElement("span", null, `${current.siap}:${current.daftar.length}`);
  }
  assert.equal(renderToString(React.createElement(Probe)), "<span>false:0</span>");
  assert.equal(pekerjaan.snapshot().siap, false);
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe));
    await pekerjaan.init();
    await flush();
  });
  assert.equal(current.siap, true);
  assert.equal(current.tersedia, true);
  assert.strictEqual(current, pekerjaan.snapshot());

  const recordA = { id: "laporan:a", jenis: "laporan", judul: "A", status: "selesai", waktu: 1 };
  const recordB = { id: "laporan:b", jenis: "laporan", judul: "B", status: "selesai", waktu: 2 };
  let bacaA = 0;
  let bacaB = 0;
  const lepasA = daftarkanPembacaLaporan(() => { bacaA++; return recordA; });
  const lepasB = daftarkanPembacaLaporan(() => { bacaB++; return recordB; });
  lepasA(); // a stale cleanup must not unregister the newer reader
  await act(async () => {
    simpanLaporanAktif();
    simpanDrafImpor({ tipe: "pgn", pgn: "1. e4 *" });
    catatFitur("impor", ID_DRAF_IMPOR, undefined, 3);
    await pekerjaan.tungguTulis();
    await flush();
  });
  assert.equal(bacaA, 0);
  assert.equal(bacaB, 1);
  assert.equal(await pekerjaan.ambil("laporan:a"), null);
  assert.equal((await pekerjaan.ambil("laporan:b")).judul, "B");
  assert.equal((await pekerjaan.ambil(ID_DRAF_IMPOR)).isi.pgn, "1. e4 *");
  assert.equal((await pekerjaan.ambil(`fitur:impor:${ID_DRAF_IMPOR}`)).targetId, ID_DRAF_IMPOR);
  assert.strictEqual(current, pekerjaan.snapshot());
  assert.deepEqual(new Set(current.daftar.map((item) => item.id)), new Set(["laporan:b", ID_DRAF_IMPOR, `fitur:impor:${ID_DRAF_IMPOR}`]));
  lepasB();
  simpanLaporanAktif();
  assert.equal(bacaB, 1);
  act(() => renderer.unmount());
  const sesudahUnmount = renders;
  pekerjaan.hapus("laporan:b");
  await pekerjaan.tungguTulis();
  assert.equal(renders, sesudahUnmount);
  assert.equal(await pekerjaan.ambil("laporan:b"), null);
});
