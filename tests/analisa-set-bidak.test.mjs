/**
 * Karakterisasi fitur set bidak + dropdown ringkas pengaturan.
 *
 * - Registri setBidak: pemetaan URL aset (SVG/PNG/Chessnut/Chess.com), fallback
 *   set tak dikenal, dan base path ekspor statis.
 * - PilihRingkas: trigger tertutup menampilkan pilihan aktif; membuka popover
 *   listbox; memilih memanggil onChange dan menutup; Escape menutup.
 * - Themes: memilih set bidak persist ke localStorage lewat konteks provider.
 */
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer from "react-test-renderer";
import {
  DAFTAR_SET_BIDAK, SET_BAWAAN, BIDAK_PRATINJAU, idSetBidak, urlBidak,
} from "../src/halaman/Analisa/komponen/pengaturan/setBidak.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const PilihRingkas = buatPemuatJsx()("src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx").default;

test("registri memuat set bawaan cburnett dan daftar lengkap ChessClub", () => {
  assert.equal(SET_BAWAAN, "cburnett");
  assert.ok(DAFTAR_SET_BIDAK.some((s) => s.id === "cburnett"));
  assert.ok(DAFTAR_SET_BIDAK.some((s) => s.id === "cardinal"));
  assert.ok(DAFTAR_SET_BIDAK.some((s) => s.id === "bidak" && s.nama === "Chessnut"));
  assert.ok(DAFTAR_SET_BIDAK.some((s) => s.id === "3d_wood" && s.png === true));
  assert.deepEqual(BIDAK_PRATINJAU, ["K", "Q", "R", "B", "N", "P"]);
});

test("idSetBidak jatuh ke bawaan untuk set tak dikenal", () => {
  assert.equal(idSetBidak("cardinal"), "cardinal");
  assert.equal(idSetBidak("tidak-ada"), "cburnett");
  assert.equal(idSetBidak(undefined), "cburnett");
  assert.equal(idSetBidak(null), "cburnett");
});

test("urlBidak memetakan SVG, PNG, Chessnut, dan Chess.com dengan benar", () => {
  assert.equal(urlBidak("cburnett", "K"), "/bidak/cburnett/wK.svg");
  assert.equal(urlBidak("cburnett", "p"), "/bidak/cburnett/bP.svg");
  assert.equal(urlBidak("alpha", "N"), "/bidak/alpha/wN.svg");
  assert.equal(urlBidak("3d_wood", "Q"), "/bidak/3d_wood/wq.png");
  assert.equal(urlBidak("chesscom", "k"), "/bidak/ChessCom/bk.png");
  assert.equal(urlBidak("bidak", "K"), "/bidak/bidak/raja-putih.svg");
  assert.equal(urlBidak("bidak", "n"), "/bidak/bidak/kuda-hitam.svg");
  assert.equal(urlBidak("cburnett", "X"), null);
  // Set tak dikenal jatuh ke cburnett, bukan null.
  assert.equal(urlBidak("aneh", "K"), "/bidak/cburnett/wK.svg");
});

test("urlBidak menghormati base path ekspor statis", () => {
  const lama = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "/maestro/";
  try {
    assert.equal(urlBidak("cburnett", "K"), "/maestro/bidak/cburnett/wK.svg");
  } finally {
    if (lama === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = lama;
  }
});

const pilihanUji = [
  { id: "satu", label: "Satu", preview: null },
  { id: "dua", label: "Dua", preview: null },
  { id: "tiga", label: "Tiga", preview: null },
];

function pasangDocument(tes) {
  const lama = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  tes.after(() => { if (lama === undefined) delete globalThis.document; else globalThis.document = lama; });
}

test("PilihRingkas tertutup menampilkan pilihan aktif dan aria-expanded false", () => {
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(PilihRingkas, { nilai: "dua", pilihan: pilihanUji, onChange: () => {}, ariaLabel: "Set bidak" })); });
  const trigger = renderer.root.findByProps({ "aria-haspopup": "listbox" });
  assert.equal(trigger.props["aria-expanded"], false);
  assert.equal(trigger.props["aria-label"], "Set bidak");
  assert.match(JSON.stringify(renderer.toJSON()), /Dua/);
  assert.equal(renderer.root.findAllByProps({ role: "listbox" }).length, 0);
  act(() => renderer.unmount());
});

test("PilihRingkas membuka listbox, memilih memanggil onChange dan menutup", (tes) => {
  pasangDocument(tes);
  const dipilih = [];
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(PilihRingkas, { nilai: "satu", pilihan: pilihanUji, onChange: (id) => dipilih.push(id), ariaLabel: "Set bidak" })); });
  const trigger = () => renderer.root.findByProps({ "aria-haspopup": "listbox" });
  act(() => trigger().props.onClick());
  assert.equal(trigger().props["aria-expanded"], true);
  const listbox = renderer.root.findByProps({ role: "listbox" });
  const opsi = listbox.findAllByProps({ role: "option" });
  assert.equal(opsi.length, 3);
  assert.equal(opsi[0].props["aria-selected"], true);
  const tombolOpsi = opsi[2].findByType("button");
  act(() => tombolOpsi.props.onClick());
  assert.deepEqual(dipilih, ["tiga"]);
  assert.equal(trigger().props["aria-expanded"], false);
  act(() => renderer.unmount());
});

test("PilihRingkas menutup dengan Escape", (tes) => {
  pasangDocument(tes);
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(PilihRingkas, { nilai: "satu", pilihan: pilihanUji, onChange: () => {}, ariaLabel: "Set bidak" })); });
  const trigger = () => renderer.root.findByProps({ "aria-haspopup": "listbox" });
  act(() => trigger().props.onClick());
  assert.equal(trigger().props["aria-expanded"], true);
  const listbox = renderer.root.findByProps({ role: "listbox" });
  act(() => listbox.props.onKeyDown({ key: "Escape", preventDefault() {} }));
  assert.equal(trigger().props["aria-expanded"], false);
  act(() => renderer.unmount());
});

test("Themes mempersist set bidak yang dipilih lewat konteks provider", async (tes) => {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map();
  const tulisan = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: {
    getItem: (k) => data.get(k) ?? null,
    setItem(k, v) { tulisan.push([k, v]); data.set(k, String(v)); },
  } });
  tes.after(() => { if (lama) Object.defineProperty(globalThis, "localStorage", lama); else delete globalThis.localStorage; });

  function Baris({ judul, children }) { return React.createElement("div", null, judul, children); }
  function Pilih({ nilai, pilihan, onChange, ariaLabel }) {
    return React.createElement("div", null, pilihan.map((p) => React.createElement("button", {
      key: p.id, "data-uji": "opsi-ringkas", "data-grup": ariaLabel, "data-id": p.id,
      "aria-selected": p.id === nilai, onClick: () => onChange(p.id),
    })));
  }
  const muat = buatPemuatJsx({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "src/halaman/Analisa/komponen/pengaturan/barisPengaturan.jsx": { default: Baris },
    "src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx": { default: Pilih },
  });
  const Themes = muat("src/halaman/Analisa/komponen/pengaturan/themes.jsx").default;
  const Provider = muat("src/halaman/Analisa/konteks/config.jsx").default;
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Provider, null, React.createElement(Themes))); await flush(); });
  const opsiBidak = () => renderer.root.findAllByProps({ "data-uji": "opsi-ringkas", "data-grup": "analisa.pengaturan.setBidak" });
  assert.equal(opsiBidak().length, DAFTAR_SET_BIDAK.length);
  assert.equal(opsiBidak()[0].props["aria-selected"], true); // bawaan cburnett
  await act(async () => { opsiBidak().find((n) => n.props["data-id"] === "cardinal").props.onClick(); await flush(); });
  assert.deepEqual(tulisan.at(-1), ["maestro-analisa-pieceSet", "cardinal"]);
  assert.equal(opsiBidak().find((n) => n.props["data-id"] === "cardinal").props["aria-selected"], true);
  await act(async () => { renderer.unmount(); });
});
