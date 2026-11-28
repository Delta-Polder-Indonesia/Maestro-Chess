import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import TestRenderer from "react-test-renderer";
import { ConfigContext, defaultUsedRatings } from "../src/halaman/Analisa/konteks/configKonteks.js";
import { boardThemes } from "../src/halaman/Analisa/komponen/pengaturan/boardThemes.js";
import { buatPemuatJsx } from "./bantuImporJsx.mjs";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";

const { act } = TestRenderer;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const namaRating = ["brilliant", "great", "best", "critical", "excellent", "good", "book", "inaccuracy", "mistake", "miss", "blunder", "forced"];

function pasangStorage(tes, awal = []) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map(awal);
  const tulisan = [];
  const storage = {
    data, tulisan,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, nilai) { tulisan.push([key, nilai]); data.set(key, String(nilai)); },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, "localStorage", lama);
    else delete globalThis.localStorage;
  });
  return storage;
}

function pemuat(tiruan = {}) {
  // Pekerjaan tidak dipakai oleh Config; tiruan ini hanya diperlukan jika
  // jalur kompatibilitas mengarah ke fasad Sesi yang juga mengekspor Tab Kerja.
  return buatPemuatJsx({
    "src/modul/pekerjaan/index.js": { KUNCI_FITUR: {}, ID_DRAF_IMPOR: "draf:impor", pekerjaan: {}, buatIdDrafImpor: () => "draf:uji" },
    ...tiruan,
  });
}

function siapkanConfig(tes, muat = pemuat(), children = null) {
  const legacy = muat("src/halaman/Analisa/konteks/config.jsx");
  const konteks = muat("src/halaman/Analisa/konteks/configKonteks.js");
  const amatan = {};
  let renderer;
  function Probe() { amatan.nilai = React.useContext(konteks.ConfigContext); return null; }
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  return {
    legacy, konteks, amatan,
    async mount() {
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(legacy.default, null, React.createElement(Probe), children));
        await flush();
      });
    },
    async unmount() { if (renderer) { await act(async () => { renderer.unmount(); await flush(); }); renderer = null; } },
    get renderer() { return renderer; },
  };
}

test("theme definitions and rating defaults retain their order, values and mutable identities", () => {
  assert.deepEqual(boardThemes, [
    { kunci: "hijau", label: "Green", black: "#779556", white: "#ebecd0", highlight: "#ffff33" },
    { kunci: "cokelat", label: "Brown", black: "#b58863", white: "#f0d9b5", highlight: "#ffff33" },
    { kunci: "biru", label: "Blue", black: "#4d6d92", white: "#ececd7", highlight: "#00a5ff" },
    { kunci: "abu", label: "Gray", black: "#4f4f4f", white: "#e3e3e3", highlight: "#ffff33" },
    { kunci: "merah", label: "Red", black: "#ba5546", white: "#f0d8bf", highlight: "#f8f893" },
    { kunci: "ungu", label: "Purple", black: "#8877b7", white: "#efefef", highlight: "#7dacc9" },
    { kunci: "oranye", label: "Orange", black: "#d08b18", white: "#fce4b2", highlight: "#ffff33" },
  ]);
  assert.deepEqual(Object.keys(defaultUsedRatings), namaRating);
  assert.ok(Object.values(defaultUsedRatings).every((nilai) => nilai === true));
  assert.equal(Object.isFrozen(boardThemes), false);
  assert.equal(Object.isFrozen(boardThemes[0]), false);
  assert.equal(Object.isFrozen(defaultUsedRatings), false);
});

test("ConfigContext outside a provider retains neutral default pairs and the shared rating object", () => {
  let nilai;
  function Probe() { nilai = React.useContext(ConfigContext); return null; }
  assert.equal(renderToString(React.createElement(Probe)), "");
  assert.equal(nilai.openedMenu[0], null);
  assert.equal(nilai.boardTheme[0], 0);
  assert.strictEqual(nilai.usedRatings[0], defaultUsedRatings);
  for (const nama of ["highlightByRating", "showArrows", "arrowAfterMove", "showLegalMoves", "animateMoves", "boardSounds"]) {
    assert.equal(nilai[nama][0], true, nama);
    assert.equal(typeof nilai[nama][1], "function", nama);
    assert.doesNotThrow(() => nilai[nama][1](false));
  }
  assert.deepEqual(nilai.boardMenuSettingsRef, { current: null });
});

test("the original provider exposes only a default export and initializes defaults without writes", async (tes) => {
  const storage = pasangStorage(tes);
  const config = siapkanConfig(tes);
  assert.deepEqual(Object.keys(config.legacy), ["default"]);
  await config.mount();
  const nilai = config.amatan.nilai;
  assert.equal(nilai.openedMenu[0], null);
  assert.equal(nilai.boardTheme[0], 0);
  assert.strictEqual(nilai.usedRatings[0], config.konteks.defaultUsedRatings);
  for (const nama of ["highlightByRating", "showArrows", "arrowAfterMove", "showLegalMoves", "animateMoves", "boardSounds"]) assert.equal(nilai[nama][0], true, nama);
  assert.deepEqual(nilai.boardMenuSettingsRef, { current: null });
  assert.deepEqual(storage.tulisan, []);
});

test("the provider loads current values and the twelve ratings bits in existing key order", async (tes) => {
  const storage = pasangStorage(tes, [
    ["maestro-analisa-boardTheme", "2"], ["maestro-analisa-usedRatings", "101001011010"],
    ["maestro-analisa-highlightByRating", "0"], ["maestro-analisa-showArrows", "2"],
    ["maestro-analisa-arrowAfterMove", "-1"], ["maestro-analisa-showLegalMoves", "0"],
    ["maestro-analisa-animateMoves", "1"], ["maestro-analisa-boardSounds", "0"],
  ]);
  const config = siapkanConfig(tes);
  await config.mount();
  const nilai = config.amatan.nilai;
  assert.equal(nilai.boardTheme[0], 2);
  assert.deepEqual(nilai.usedRatings[0], Object.fromEntries(namaRating.map((nama, i) => [nama, "101001011010"[i] === "1"])));
  assert.notStrictEqual(nilai.usedRatings[0], config.konteks.defaultUsedRatings);
  assert.deepEqual([nilai.highlightByRating[0], nilai.showArrows[0], nilai.arrowAfterMove[0], nilai.showLegalMoves[0], nilai.animateMoves[0], nilai.boardSounds[0]], [false, true, true, false, true, false]);
  assert.deepEqual(storage.tulisan, []);
});

test("legacy settings and eleven-bit ratings are read without rewriting them", async (tes) => {
  const storage = pasangStorage(tes, [["boardTheme", "4"], ["usedRatings", "10101010101"], ["showArrows", "0"]]);
  const config = siapkanConfig(tes);
  await config.mount();
  assert.equal(config.amatan.nilai.boardTheme[0], 4);
  assert.equal(config.amatan.nilai.showArrows[0], false);
  assert.deepEqual(config.amatan.nilai.usedRatings[0], Object.fromEntries(namaRating.map((nama, i) => [nama, "101101010101"[i] === "1"])));
  assert.equal(storage.data.get("usedRatings"), "10101010101");
  assert.deepEqual(storage.tulisan, []);
});

test("invalid theme indices and rating strings use defaults; finite numeric syntax is retained", async (tes) => {
  const storage = pasangStorage(tes, [["maestro-analisa-usedRatings", "10101010101"]]);
  const config = siapkanConfig(tes);
  for (const [mentah, hasil] of [["-1", 0], ["7", 0], ["1.5", 0], ["invalid", 0], ["Infinity", 0], ["0x2", 2], ["6", 6]]) {
    storage.data.set("maestro-analisa-boardTheme", mentah);
    await config.mount();
    assert.equal(config.amatan.nilai.boardTheme[0], hasil, mentah);
    assert.strictEqual(config.amatan.nilai.usedRatings[0], config.konteks.defaultUsedRatings);
    await config.unmount();
  }
  assert.deepEqual(storage.tulisan, []);
});

test("state setters and the settings ref remain local and do not persist automatically", async (tes) => {
  const storage = pasangStorage(tes, [["maestro-analisa-boardTheme", "1"]]);
  const config = siapkanConfig(tes);
  await config.mount();
  const awal = config.amatan.nilai;
  const ref = awal.boardMenuSettingsRef;
  const setter = awal.boardTheme[1];
  storage.data.set("maestro-analisa-boardTheme", "5");
  await act(async () => {
    awal.boardTheme[1](3);
    awal.openedMenu[1]("pengaturan");
    awal.boardSounds[1](false);
    await flush();
  });
  assert.equal(config.amatan.nilai.boardTheme[0], 3);
  assert.equal(config.amatan.nilai.openedMenu[0], "pengaturan");
  assert.equal(config.amatan.nilai.boardSounds[0], false);
  assert.strictEqual(config.amatan.nilai.boardMenuSettingsRef, ref);
  assert.strictEqual(config.amatan.nilai.boardTheme[1], setter);
  assert.deepEqual(storage.tulisan, []);
  await config.unmount();
  await config.mount();
  assert.equal(config.amatan.nilai.boardTheme[0], 5, "remount reads the stored value rather than the prior provider state");
  assert.equal(config.amatan.nilai.boardSounds[0], true);
});

test("two provider instances have separate state but initially share the default ratings object", async (tes) => {
  pasangStorage(tes);
  const muat = pemuat();
  const provider = muat("src/halaman/Analisa/konteks/config.jsx").default;
  const konteks = muat("src/halaman/Analisa/konteks/configKonteks.js");
  const nilai = {};
  function Probe({ nama }) { nilai[nama] = React.useContext(konteks.ConfigContext); return null; }
  let renderer;
  tes.after(() => { if (renderer) act(() => renderer.unmount()); });
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(React.Fragment, null,
      React.createElement(provider, null, React.createElement(Probe, { nama: "satu" })),
      React.createElement(provider, null, React.createElement(Probe, { nama: "dua" }))));
    await flush();
  });
  assert.notStrictEqual(nilai.satu, nilai.dua);
  assert.strictEqual(nilai.satu.usedRatings[0], konteks.defaultUsedRatings);
  assert.strictEqual(nilai.dua.usedRatings[0], konteks.defaultUsedRatings);
  await act(async () => { nilai.satu.usedRatings[1]({ ...nilai.satu.usedRatings[0], best: false }); await flush(); });
  assert.equal(nilai.satu.usedRatings[0].best, false);
  assert.equal(nilai.dua.usedRatings[0].best, true);
});

test("blocked reads log failures and the provider keeps its default state", async (tes) => {
  const galat = tangkapGalatDiuji(tes, "Gagal membaca pengaturan Analisa:");
  const storage = pasangStorage(tes);
  storage.getItem = () => { throw new Error("read blocked"); };
  const config = siapkanConfig(tes);
  await config.mount();
  assert.equal(config.amatan.nilai.boardTheme[0], 0);
  assert.strictEqual(config.amatan.nilai.usedRatings[0], config.konteks.defaultUsedRatings);
  assert.equal(config.amatan.nilai.boardSounds[0], true);
  // 25 preferensi UMUM dibaca (pieceSet + Tier 1 koordinat/sorotLangkah/
  // autoPromosi/hapusPanah + Tier 2 volume/kecepatanAnimasi/material/notasi +
  // Tier 3 pratinjauHover/gulirLangkah/koleksiSuara/ukuranFont/warnaAksen + tema
  // terang/gelap + format skor WDL + tablebase); semuanya gagal saat storage
  // diblokir. Preferensi latihan teka-teki tidak lagi di sini — ia milik fitur.
  assert.equal(galat.length, 25);
  assert.ok(galat.every(([, error]) => /read blocked/.test(String(error))));
});

test("real theme settings use the provider context and persist the chosen index", async (tes) => {
  const storage = pasangStorage(tes, [["maestro-analisa-boardTheme", "2"]]);
  function Baris({ judul, children }) { return React.createElement("div", null, judul, children); }
  // Tema kini dropdown ringkas; stub ini memetakan tiap pilihan ke tombol uji
  // per grup agar indeks tema dan persistensinya tetap terarakterisasi.
  function Pilih({ nilai, pilihan, onChange, ariaLabel }) {
    return React.createElement("div", null, pilihan.map((p) => React.createElement("button", {
      key: p.id, "data-uji": "opsi-ringkas", "data-grup": ariaLabel, "data-id": p.id,
      "aria-selected": p.id === nilai, onClick: () => onChange(p.id),
    })));
  }
  const muat = pemuat({
    "src/lib/i18n.jsx": { useI18n: () => ({ t: (key) => key }) },
    "src/halaman/Analisa/komponen/pengaturan/barisPengaturan.jsx": { default: Baris },
    "src/halaman/Analisa/komponen/pengaturan/pilihRingkas.jsx": { default: Pilih },
  });
  const Themes = muat("src/halaman/Analisa/komponen/pengaturan/themes.jsx").default;
  const config = siapkanConfig(tes, muat, React.createElement(Themes));
  await config.mount();
  assert.equal(config.amatan.nilai.boardTheme[0], 2);
  assert.deepEqual(storage.tulisan, []);
  const opsiTema = () => config.renderer.root.findAllByProps({ "data-uji": "opsi-ringkas", "data-grup": "analisa.pengaturan.temaPapan" });
  assert.equal(opsiTema().length, 7);
  assert.equal(opsiTema()[2].props["aria-selected"], true);
  await act(async () => { opsiTema()[6].props.onClick(); await flush(); });
  assert.equal(config.amatan.nilai.boardTheme[0], 6);
  assert.deepEqual(storage.tulisan.at(-1), ["maestro-analisa-boardTheme", "6"]);
  assert.equal(opsiTema()[6].props["aria-selected"], true);
  await config.unmount();
  await config.mount();
  assert.equal(config.amatan.nilai.boardTheme[0], 6);
});
