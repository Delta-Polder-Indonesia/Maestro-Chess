import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer from "react-test-renderer";
import * as pembuatPesan from "../src/halaman/Analisa/komponen/errors/pushPageError.js";
import { ErrorsContext } from "../src/halaman/Analisa/konteks/errorsKonteks.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function kolektor() {
  let daftar = [];
  return {
    setErrors: (ubah) => { daftar = ubah(daftar); },
    get daftar() { return daftar; },
  };
}

test("error helpers expose the original named exports and append synchronously while returning promises", async () => {
  assert.deepEqual(Object.keys(pembuatPesan).sort(), ["pushPageError", "pushPageWarning"]);
  const hasil = kolektor();
  const deskripsi = { pesan: "rincian" };
  const janji = pembuatPesan.pushPageError(hasil.setErrors, "Judul", deskripsi);
  assert.ok(janji instanceof Promise);
  assert.equal(hasil.daftar.length, 1, "setErrors dipanggil sebelum promise diselesaikan");
  assert.equal(await janji, undefined);
  const pertama = hasil.daftar[0];
  assert.deepEqual(pertama, { title: "Judul", description: deskripsi, type: "error", errorKey: pertama.errorKey });
  assert.strictEqual(pertama.description, deskripsi);
  assert.equal(typeof pertama.errorKey, "number");
  assert.equal(await pembuatPesan.pushPageWarning(hasil.setErrors, "Awas", "rincian"), undefined);
  assert.deepEqual(hasil.daftar[1], { title: "Awas", description: "rincian", type: "warning", errorKey: pertama.errorKey + 1, persisten: false });
  assert.equal(await pembuatPesan.pushPageWarning(hasil.setErrors, "Tetap", "isi", { persisten: true }), undefined);
  assert.deepEqual(hasil.daftar[2], { title: "Tetap", description: "isi", type: "warning", errorKey: pertama.errorKey + 2, persisten: true });
});

test("warning persistence and optional fields are passed through without normalization", async () => {
  const hasil = kolektor();
  await pembuatPesan.pushPageWarning(hasil.setErrors, undefined, null, { persisten: "manual", diabaikan: 1 });
  const item = hasil.daftar[0];
  assert.deepEqual(item, { title: undefined, description: null, type: "warning", errorKey: item.errorKey, persisten: "manual" });
});

test("a setter error rejects the async helper after advancing the shared counter", async () => {
  const hasil = kolektor();
  await pembuatPesan.pushPageError(hasil.setErrors, "awal", "");
  const kunci = hasil.daftar[0].errorKey;
  const kegagalan = new Error("setter gagal");
  await assert.rejects(pembuatPesan.pushPageError(() => { throw kegagalan; }, "gagal", ""), (error) => error === kegagalan);
  await pembuatPesan.pushPageWarning(hasil.setErrors, "berikut", "");
  assert.equal(hasil.daftar[1].errorKey, kunci + 2);
});

test("null warning options reject before the shared counter advances", async () => {
  const hasil = kolektor();
  await pembuatPesan.pushPageError(hasil.setErrors, "awal", "");
  const kunci = hasil.daftar[0].errorKey;
  await assert.rejects(pembuatPesan.pushPageWarning(hasil.setErrors, "gagal", "", null), TypeError);
  await pembuatPesan.pushPageError(hasil.setErrors, "berikut", "");
  assert.equal(hasil.daftar[1].errorKey, kunci + 1);
});

test("deferred updater functions read the latest shared key rather than capturing a per-call key", async () => {
  const tertunda = [];
  const setErrors = (updater) => tertunda.push(updater);
  await pembuatPesan.pushPageError(setErrors, "satu", "pertama");
  await pembuatPesan.pushPageWarning(setErrors, "dua", "kedua");
  assert.equal(tertunda.length, 2);
  const pertama = tertunda[0]([]);
  const keduanya = tertunda[1](pertama);
  assert.equal(keduanya[0].errorKey, keduanya[1].errorKey);
  assert.deepEqual(keduanya.map((item) => item.type), ["error", "warning"]);
});

test("ErrorsContext outside a provider has the original neutral mutable value and no-op setter", () => {
  let nilai;
  function Probe() { nilai = React.useContext(ErrorsContext); return null; }
  assert.equal(renderToString(React.createElement(Probe)), "");
  assert.deepEqual(Object.keys(nilai), ["errors"]);
  assert.deepEqual(nilai.errors[0], []);
  assert.equal(typeof nilai.errors[1], "function");
  assert.equal(nilai.errors[1](() => ["tidak disimpan"]), undefined);
  const awal = nilai.errors[0];
  renderToString(React.createElement(Probe));
  assert.strictEqual(nilai.errors[0], awal);
  assert.equal(Object.isFrozen(nilai), false);
  assert.equal(Object.isFrozen(awal), false);
});

test("the original provider has a default export and keeps setter identity across state changes", async (tes) => {
  const muat = buatPemuatJsx();
  const provider = muat("src/halaman/Analisa/konteks/errors.jsx");
  const { ErrorsContext: konteks } = muat("src/halaman/Analisa/konteks/errorsKonteks.js");
  const helper = muat("src/halaman/Analisa/komponen/errors/pushPageError.js");
  assert.deepEqual(Object.keys(provider), ["default"]);
  let nilai;
  function Probe() { nilai = React.useContext(konteks); return React.createElement("span", null, "anak"); }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(provider.default, null, React.createElement(Probe))); await flush(); });
  assert.deepEqual(nilai.errors[0], []);
  assert.equal(renderer.root.findByType("span").children[0], "anak");
  const setter = nilai.errors[1];
  await act(async () => { await helper.pushPageError(setter, "Satu", "Isi"); await flush(); });
  assert.strictEqual(nilai.errors[1], setter);
  assert.equal(nilai.errors[0][0].title, "Satu");
  await act(async () => { setter([]); await flush(); });
  assert.deepEqual(nilai.errors[0], []);
  assert.strictEqual(nilai.errors[1], setter);
});

test("provider instances keep separate lists while the helper counter is shared across instances and remounts", async (tes) => {
  const muat = buatPemuatJsx();
  const Provider = muat("src/halaman/Analisa/konteks/errors.jsx").default;
  const { ErrorsContext: konteks } = muat("src/halaman/Analisa/konteks/errorsKonteks.js");
  const helper = muat("src/halaman/Analisa/komponen/errors/pushPageError.js");
  const nilai = {};
  function Probe({ nama }) { nilai[nama] = React.useContext(konteks); return null; }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(Provider, null, React.createElement(Probe, { nama: "satu" })),
      React.createElement(Provider, null, React.createElement(Probe, { nama: "dua" }))));
    await flush();
  });
  assert.notStrictEqual(nilai.satu.errors[0], nilai.dua.errors[0]);
  await act(async () => { await helper.pushPageError(nilai.satu.errors[1], "pertama", ""); await flush(); });
  assert.equal(nilai.dua.errors[0].length, 0);
  const kunci = nilai.satu.errors[0][0].errorKey;
  await act(async () => { await helper.pushPageWarning(nilai.dua.errors[1], "kedua", ""); await flush(); });
  assert.equal(nilai.dua.errors[0][0].errorKey, kunci + 1);
  assert.equal(nilai.satu.errors[0].length, 1);
  await act(async () => { renderer.unmount(); renderer = TestRenderer.create(React.createElement(Provider, null, React.createElement(Probe, { nama: "baru" }))); await flush(); });
  assert.deepEqual(nilai.baru.errors[0], []);
  await act(async () => { await helper.pushPageError(nilai.baru.errors[1], "ketiga", ""); await flush(); });
  assert.equal(nilai.baru.errors[0][0].errorKey, kunci + 2);
});

test("the real page notification component consumes provider state and keeps existing dismissal timers", async (tes) => {
  const waktuAsli = globalThis.setTimeout;
  const hapusAsli = globalThis.clearTimeout;
  const dokumenAsli = Object.getOwnPropertyDescriptor(globalThis, "document");
  const timers = [];
  globalThis.setTimeout = (callback, ms) => { const timer = { callback, ms, dibatalkan: false }; timers.push(timer); return timer; };
  globalThis.clearTimeout = (timer) => { timer.dibatalkan = true; };
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: { querySelector: () => null } });
  tes.after(() => {
    globalThis.setTimeout = waktuAsli;
    globalThis.clearTimeout = hapusAsli;
    if (dokumenAsli) Object.defineProperty(globalThis, "document", dokumenAsli);
    else delete globalThis.document;
  });
  const muat = buatPemuatJsx({ "src/lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) } });
  const Provider = muat("src/halaman/Analisa/konteks/errors.jsx").default;
  const { ErrorsContext: konteks } = muat("src/halaman/Analisa/konteks/errorsKonteks.js");
  const helper = muat("src/halaman/Analisa/komponen/errors/pushPageError.js");
  const PageErrors = muat("src/halaman/Analisa/komponen/errors/pageErrors.jsx").default;
  let nilai;
  function Probe() { nilai = React.useContext(konteks); return null; }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => { renderer = TestRenderer.create(React.createElement(Provider, null, React.createElement(Probe), React.createElement(PageErrors))); await flush(); });
  await act(async () => { await helper.pushPageWarning(nilai.errors[1], "Peringatan", "Tetap", { persisten: true }); await flush(); });
  assert.equal(timers.filter((item) => item.ms === 7500).length, 0);
  await act(async () => { await helper.pushPageError(nilai.errors[1], "Galat", "Sementara"); await flush(); });
  const alert = renderer.root.findAllByProps({ role: "alert" });
  assert.equal(alert.length, 2);
  assert.deepEqual(alert.map((item) => item.props.style.backgroundColor), ["var(--warning)", "var(--error)"]);
  assert.equal(timers.filter((item) => item.ms === 7500).length, 1);
  const tombol = renderer.root.findByProps({ "aria-label": "analisa.status.tutupPeringatan" });
  act(() => tombol.props.onClick());
  const manual = timers.find((item) => item.ms === 150);
  assert.ok(manual);
  act(() => manual.callback());
  assert.deepEqual(nilai.errors[0].map((item) => item.title), ["Galat"]);
  act(() => timers.find((item) => item.ms === 7500).callback());
  const tertunda = timers.filter((item) => item.ms === 150);
  assert.equal(tertunda.length, 2);
  act(() => tertunda[1].callback());
  assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 0);
  assert.deepEqual(nilai.errors[0], []);
});
