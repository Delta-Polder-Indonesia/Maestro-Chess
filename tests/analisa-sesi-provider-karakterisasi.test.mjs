import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer from "react-test-renderer";
import { ID_DRAF_IMPOR, KUNCI_FITUR } from "../src/modul/pekerjaan/index.js";
import { KUNCI_PGN_TITIPAN } from "../src/lib/titipanAnalisa.js";
import { KUNCI_SESI_TAB } from "../src/halaman/Analisa/tabKerja.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function pasangStorage(tes, awal = {}) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const nilai = new Map(Object.entries(awal));
  const tulisan = [];
  const hapusan = [];
  const storage = {
    nilai, tulisan, hapusan,
    getItem: (key) => nilai.get(key) ?? null,
    setItem(key, value) { tulisan.push([key, value]); nilai.set(key, value); },
    removeItem(key) { hapusan.push(key); nilai.delete(key); },
  };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: storage });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, "sessionStorage", lama);
    else delete globalThis.sessionStorage;
  });
  return storage;
}

function storePalsu() {
  return {
    initCalls: 0,
    drafAktif: [],
    keadaan: { terakhirDrafId: null, daftar: [] },
    async init() { this.initCalls++; },
    snapshot() { return this.keadaan; },
    tetapkanDrafAktif(id) { this.drafAktif.push(id); },
  };
}

function siapkanProvider(tes, store = storePalsu()) {
  let nomorDraf = 0;
  const muat = buatPemuatJsx({
    "src/modul/pekerjaan/index.js": {
      ID_DRAF_IMPOR, KUNCI_FITUR, pekerjaan: store, buatIdDrafImpor: () => `draf:generated-${++nomorDraf}`,
    },
  });
  const api = muat("src/halaman/Analisa/konteks/tabKerja.jsx");
  const papan = muat("src/halaman/Analisa/konteks/boardKonteks.js");
  const amatan = {};
  let renderer;
  function Probe() { amatan.tab = api.useTabKerja(); return null; }
  function Pembungkus() {
    const [tampilan, setTampilan] = React.useState("papan");
    amatan.tampilan = tampilan;
    amatan.setTampilan = setTampilan;
    return React.createElement(papan.TampilanContext.Provider, { value: tampilan },
      React.createElement(papan.SetTampilanContext.Provider, { value: setTampilan },
        React.createElement(api.TabKerjaProvider, null, React.createElement(Probe))));
  }
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  return {
    api, amatan, store,
    async mount() { await act(async () => { renderer = TestRenderer.create(React.createElement(Pembungkus)); await flush(); }); },
    get nomorDraf() { return nomorDraf; },
  };
}

test("provider exposes its two named exports and rejects the hook without a provider", (tes) => {
  const { api } = siapkanProvider(tes);
  assert.deepEqual(Object.keys(api).sort(), ["TabKerjaProvider", "useTabKerja"]);
  function Probe() { api.useTabKerja(); return null; }
  assert.throws(() => renderToString(React.createElement(Probe)), /TabKerjaProvider is missing/);
});

test("a recovered session is not overwritten until recovery is finished", async (tes) => {
  const tersimpan = JSON.stringify({ versi: 1, aktifId: "tab:saved", daftar: [
    { id: "tab:saved", tampilan: "akun", laporanId: "laporan:1", akun: { platform: "chessCom", username: " Alice " } },
  ] });
  const storage = pasangStorage(tes, { [KUNCI_SESI_TAB]: tersimpan });
  const { amatan, mount } = siapkanProvider(tes);
  await mount();
  assert.equal(amatan.tab.perluPulih, true);
  assert.equal(amatan.tab.sesiTersedia, true);
  assert.equal(amatan.tab.aktifId, "tab:saved");
  assert.equal(amatan.tab.daftar[0].tampilanPapan, "bermain");
  assert.equal(amatan.tab.daftar[0].akun.username, "Alice");
  assert.equal(storage.tulisan.length, 0);
  await act(async () => { amatan.tab.catat("tab:saved", { drafId: "draf:changed" }); await flush(); });
  assert.equal(storage.nilai.get(KUNCI_SESI_TAB), tersimpan);
  assert.equal(storage.tulisan.length, 0);
  await act(async () => { amatan.tab.selesaiPulih(); await flush(); });
  assert.equal(amatan.tab.perluPulih, false);
  assert.equal(storage.tulisan.length, 1);
  assert.deepEqual(JSON.parse(storage.nilai.get(KUNCI_SESI_TAB)), {
    versi: 1, daftar: amatan.tab.daftar, aktifId: "tab:saved",
  });
});

test("PGN handoff creates a new tab inheriting the active account without consuming the handoff", async (tes) => {
  const tersimpan = JSON.stringify({ versi: 1, aktifId: "tab:saved", daftar: [
    { id: "tab:saved", tampilan: "akun", akun: { platform: "lichessOrg", username: " Alice " } },
  ] });
  const storage = pasangStorage(tes, { [KUNCI_SESI_TAB]: tersimpan, [KUNCI_PGN_TITIPAN]: "1. e4 *" });
  const { amatan, mount } = siapkanProvider(tes);
  await mount();
  assert.equal(amatan.tab.perluPulih, false);
  assert.equal(amatan.tab.daftar.length, 2);
  assert.equal(amatan.tab.daftar[0].id, "tab:saved");
  assert.notEqual(amatan.tab.aktifId, "tab:saved");
  assert.equal(amatan.tab.daftar[1].id, amatan.tab.aktifId);
  assert.equal(amatan.tab.daftar[1].tampilan, "papan");
  assert.deepEqual(amatan.tab.daftar[1].akun, { platform: "lichessOrg", username: "Alice" });
  assert.equal(storage.nilai.get(KUNCI_PGN_TITIPAN), "1. e4 *");
  assert.deepEqual(storage.hapusan, []);
  assert.deepEqual(JSON.parse(storage.nilai.get(KUNCI_SESI_TAB)).daftar, amatan.tab.daftar);
});

test("a blocked storage getter reports failure while in-memory tab operations still work", async (tes) => {
  const galat = tangkapGalatDiuji(tes, "Gagal mengakses penyimpanan sesi tab:");
  const lama = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("access blocked"); } });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, "sessionStorage", lama);
    else delete globalThis.sessionStorage;
  });
  const { amatan, mount } = siapkanProvider(tes);
  await mount();
  assert.equal(amatan.tab.perluPulih, false);
  assert.equal(amatan.tab.sesiTersedia, false);
  const pertama = amatan.tab.aktifId;
  await act(async () => { amatan.tab.tambah(); await flush(); });
  assert.equal(amatan.tab.daftar.length, 2);
  assert.notEqual(amatan.tab.aktifId, pertama);
  assert.equal(amatan.tab.sesiTersedia, false);
  assert.ok(galat.length >= 2);
  assert.ok(galat.every(([pesan, error]) => pesan === "Gagal mengakses penyimpanan sesi tab:" && /access blocked/.test(String(error))));
});

test("provider adds, selects and removes tabs while account selections remain per-tab", async (tes) => {
  const storage = pasangStorage(tes);
  const { amatan, mount } = siapkanProvider(tes);
  await mount();
  const idSatu = amatan.tab.aktifId;
  await act(async () => { amatan.tab.catat(idSatu, { akun: { platform: "lichessOrg", username: " Alice " } }); await flush(); });
  let baru;
  await act(async () => { baru = amatan.tab.tambah(); await flush(); });
  const idDua = amatan.tab.aktifId;
  assert.equal(baru.id, idDua);
  assert.deepEqual(baru.akun, { platform: "lichessOrg", username: "Alice" });
  assert.deepEqual(amatan.tab.daftar[1].akun, baru.akun);
  await act(async () => { amatan.tab.catat(idDua, { akun: { platform: "chessCom", username: "Bob" } }); await flush(); });
  assert.equal(amatan.tab.daftar[0].akun.username, "Alice");
  await act(async () => { amatan.tab.hapusAkunTerpilih("lichessOrg", "ALICE", { platform: "chessCom", username: " Bob " }); await flush(); });
  assert.deepEqual(amatan.tab.daftar.map((tab) => tab.akun), [
    { platform: "chessCom", username: "Bob" }, { platform: "chessCom", username: "Bob" },
  ]);
  await act(async () => { amatan.tab.aktifkan(idSatu); await flush(); });
  await act(async () => { amatan.tab.hapusLain(idSatu); await flush(); });
  assert.equal(amatan.tab.daftar.length, 2, "the active tab is not removed by hapusLain");
  await act(async () => { amatan.tab.hapusLain(idDua); await flush(); });
  assert.deepEqual(amatan.tab.daftar.map((tab) => tab.id), [idSatu]);
  assert.deepEqual(JSON.parse(storage.nilai.get(KUNCI_SESI_TAB)).daftar, amatan.tab.daftar);
});

test("board opener delegates to the latest registration and ignores stale cleanup", async (tes) => {
  pasangStorage(tes);
  const { amatan, mount } = siapkanProvider(tes);
  await mount();
  await act(async () => { amatan.setTampilan("akun"); await flush(); });
  let callsA = 0;
  let callsB = 0;
  const lepasA = amatan.tab.daftarkanPembukaPapan(() => { callsA++; return "A"; });
  const lepasB = amatan.tab.daftarkanPembukaPapan(() => { callsB++; return "B"; });
  lepasA();
  assert.equal(amatan.tab.bukaPapan(), "B");
  assert.equal(callsA, 0);
  assert.equal(callsB, 1);
  assert.equal(amatan.tampilan, "akun");
  lepasB();
  let hasil;
  await act(async () => { hasil = amatan.tab.bukaPapan(); await flush(); });
  assert.equal(hasil, undefined);
  assert.equal(amatan.tampilan, "papan");
});

test("draft preparation reuses pointers, avoids other tabs, and chooses the existing fallbacks", async (tes) => {
  const tersimpan = JSON.stringify({ versi: 1, aktifId: "tab:2", daftar: [
    { id: "tab:1", tampilan: "papan", drafId: "draf:last" },
    { id: "tab:2", tampilan: "papan" },
  ] });
  pasangStorage(tes, { [KUNCI_SESI_TAB]: tersimpan });
  const persiapan = siapkanProvider(tes);
  const { amatan, store, mount } = persiapan;
  store.keadaan = { terakhirDrafId: "draf:last", daftar: [{ id: "draf:list", jenis: "draf" }] };
  await mount();
  let id;
  await act(async () => { id = await amatan.tab.siapkanImpor("tab:2"); await flush(); });
  assert.equal(id, "draf:generated-1");
  assert.equal(amatan.tab.daftar[1].drafId, id);
  assert.equal(persiapan.nomorDraf, 1);
  await act(async () => { id = await amatan.tab.siapkanImpor("tab:2"); await flush(); });
  assert.equal(id, "draf:generated-1");
  await act(async () => { id = await amatan.tab.siapkanImpor("tab:2", "draf:explicit"); await flush(); });
  assert.equal(id, "draf:explicit");
  assert.equal(amatan.tab.daftar[1].drafId, id);
  await act(async () => { amatan.tab.catat("tab:2", { drafId: null }); await flush(); });
  store.keadaan = { terakhirDrafId: null, daftar: [{ id: "laporan:1", jenis: "laporan" }, { id: "draf:list", jenis: "draf" }] };
  await act(async () => { id = await amatan.tab.siapkanImpor("tab:2"); await flush(); });
  assert.equal(id, "draf:list");
  await act(async () => { amatan.tab.catat("tab:2", { drafId: null }); await flush(); });
  store.keadaan = { terakhirDrafId: null, daftar: [] };
  await act(async () => { id = await amatan.tab.siapkanImpor("tab:2"); await flush(); });
  assert.equal(id, ID_DRAF_IMPOR);
  assert.deepEqual(store.drafAktif, ["draf:generated-1", "draf:generated-1", "draf:explicit", "draf:list", ID_DRAF_IMPOR]);
  assert.equal(await amatan.tab.siapkanImpor("tab:missing"), null);
  assert.equal(await amatan.tab.siapkanImpor("tab:1", null, () => false), null);
  assert.equal(store.initCalls, 7, "initialization precedes lookup and cancellation");
  assert.equal(store.drafAktif.length, 5);
});

test("opening import navigates only when the pending request is still current", async (tes) => {
  pasangStorage(tes);
  const store = storePalsu();
  let lanjut;
  store.init = () => new Promise((resolve) => { lanjut = resolve; });
  const { amatan, mount } = siapkanProvider(tes, store);
  await mount();
  const idTab = amatan.tab.aktifId;
  let permintaan;
  await act(async () => { permintaan = amatan.tab.bukaImpor(); await flush(); });
  assert.equal(typeof lanjut, "function");
  await act(async () => { amatan.setTampilan("database"); await flush(); });
  await act(async () => { amatan.setTampilan("papan"); await flush(); });
  await act(async () => { lanjut(); await flush(); });
  assert.equal(await permintaan, false);
  assert.equal(amatan.tampilan, "papan");
  assert.equal(amatan.tab.daftar.find((tab) => tab.id === idTab).drafId, null);
  assert.deepEqual(store.drafAktif, []);
  store.init = async () => {};
  let berhasil;
  await act(async () => { berhasil = await amatan.tab.bukaImpor("draf:chosen"); await flush(); });
  assert.equal(berhasil, true);
  assert.equal(amatan.tampilan, "impor");
  assert.equal(amatan.tab.daftar.find((tab) => tab.id === idTab).drafId, "draf:chosen");
  assert.deepEqual(store.drafAktif, ["draf:chosen"]);
});

test("a rejected job-store initialization propagates rather than navigating", async (tes) => {
  pasangStorage(tes);
  const store = storePalsu();
  store.init = async () => { throw new Error("init gagal"); };
  const { amatan, mount } = siapkanProvider(tes, store);
  await mount();
  await assert.rejects(amatan.tab.bukaImpor(), /init gagal/);
  assert.equal(amatan.tampilan, "papan");
  assert.equal(amatan.tab.daftar[0].drafId, null);
  assert.deepEqual(store.drafAktif, []);
});
