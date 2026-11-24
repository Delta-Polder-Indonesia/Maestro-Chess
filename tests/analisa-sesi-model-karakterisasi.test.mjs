import assert from "node:assert/strict";
import test from "node:test";
import * as model from "../src/halaman/Analisa/tabKerja.js";
import { tangkapGalatDiuji } from "./bantuGalat.mjs";

function storageMemori(awal = null) {
  const nilai = new Map();
  const tulisan = [];
  if (awal !== null) nilai.set(model.KUNCI_SESI_TAB, awal);
  return {
    nilai,
    tulisan,
    getItem: (key) => nilai.get(key) ?? null,
    setItem(key, value) { tulisan.push([key, value]); nilai.set(key, value); },
  };
}

function gantiGlobal(tes, nama, nilai) {
  const lama = Object.getOwnPropertyDescriptor(globalThis, nama);
  Object.defineProperty(globalThis, nama, { configurable: true, writable: true, value: nilai });
  tes.after(() => {
    if (lama) Object.defineProperty(globalThis, nama, lama);
    else delete globalThis[nama];
  });
}

test("original tab model exposes twelve named exports and generates tab-prefixed IDs", (tes) => {
  assert.deepEqual(Object.keys(model).sort(), [
    "KUNCI_SESI_TAB", "aktifkanTab", "bacaSesiTab", "hapusPilihanAkun", "hapusTabLain", "idTabBaru",
    "normalisasiAkunTab", "perbaruiTab", "sesiBaru", "simpanSesiTab", "tabBaru", "tambahTab",
  ].sort());
  gantiGlobal(tes, "crypto", { randomUUID: () => "fixed-uuid" });
  assert.equal(model.idTabBaru(), "tab:fixed-uuid");
  assert.deepEqual(model.tabBaru(undefined, { platform: "lichessOrg", username: " Alice " }), {
    id: "tab:fixed-uuid", tampilan: "papan", tampilanPapan: "papan", laporanId: null, drafId: null,
    akun: { platform: "lichessOrg", username: "Alice" },
  });
  const sesi = model.sesiBaru();
  assert.equal(sesi.daftar.length, 1);
  assert.equal(sesi.aktifId, sesi.daftar[0].id);
  assert.equal(sesi.aktifId, "tab:fixed-uuid");
});

test("ID fallback uses timestamp and random when randomUUID is absent", (tes) => {
  gantiGlobal(tes, "crypto", undefined);
  const tanggal = Date.now;
  const acak = Math.random;
  Date.now = () => 36;
  Math.random = () => 0.5;
  tes.after(() => { Date.now = tanggal; Math.random = acak; });
  assert.equal(model.idTabBaru(), "tab:10-i");
});

test("the writer uses the v1 session key and serializes tab objects without projecting extra fields", () => {
  const storage = storageMemori();
  const tab = { ...model.tabBaru("tab:1"), drafId: "draf:1", tambahan: "nilai yang ikut tersimpan" };
  const sesi = { daftar: [tab], aktifId: "tab:1", tambahanSesi: "tidak disalin" };
  assert.equal(model.KUNCI_SESI_TAB, "maestro-analisa-tab-v1");
  assert.equal(model.simpanSesiTab(storage, sesi), true);
  const json = JSON.stringify({ versi: 1, daftar: [tab], aktifId: "tab:1" });
  assert.deepEqual(storage.tulisan, [["maestro-analisa-tab-v1", json]]);
  assert.deepEqual(model.bacaSesiTab(storage), {
    daftar: [{ ...model.tabBaru("tab:1"), drafId: "draf:1" }],
    aktifId: "tab:1",
  }, "the reader projects known tab fields even though the writer copies the supplied tab object");
  assert.equal(model.simpanSesiTab(null, sesi), false);
  assert.equal(model.simpanSesiTab({}, sesi), false);
});

test("reader requires a v1 envelope and a valid surviving active tab", () => {
  for (const nilai of [
    null,
    {},
    { versi: "1", daftar: [{ id: "tab:1", tampilan: "papan" }], aktifId: "tab:1" },
    { versi: 2, daftar: [{ id: "tab:1", tampilan: "papan" }], aktifId: "tab:1" },
    { versi: 1, daftar: {}, aktifId: "tab:1" },
    { versi: 1, daftar: [{ id: "tab:1", tampilan: "papan" }], aktifId: "" },
    { versi: 1, daftar: [{ id: "tab:1", tampilan: "papan" }], aktifId: "x".repeat(201) },
    { versi: 1, daftar: [{ id: "tab:1", tampilan: "unknown" }], aktifId: "tab:1" },
    { versi: 1, daftar: [{ id: "tab:2", tampilan: "papan" }], aktifId: "tab:1" },
  ]) assert.equal(model.bacaSesiTab(storageMemori(JSON.stringify(nilai))), null);
  assert.equal(model.bacaSesiTab(null), null);
});

test("reader filters invalid and duplicate tabs, projects known fields and preserves first valid ID", () => {
  const panjang = "x".repeat(200);
  const storage = storageMemori(JSON.stringify({ versi: 1, aktifId: "tab:1", daftar: [
    null,
    { id: "", tampilan: "papan" },
    { id: "tab:1", tampilan: "__proto__" },
    { id: "tab:1", tampilan: "akun", laporanId: 1, drafId: "draf:1", akun: { platform: "lichessOrg", username: " Alice " }, ekstra: "discarded" },
    { id: "tab:1", tampilan: "engine", drafId: "draf:duplicate" },
    { id: panjang, tampilan: "bermain", laporanId: "l".repeat(200), drafId: "d".repeat(201) },
    { id: "y".repeat(201), tampilan: "papan" },
  ] }));
  assert.deepEqual(model.bacaSesiTab(storage), { aktifId: "tab:1", daftar: [
    { id: "tab:1", tampilan: "akun", tampilanPapan: "papan", laporanId: null, drafId: "draf:1", akun: { platform: "lichessOrg", username: "Alice" } },
    { id: panjang, tampilan: "bermain", tampilanPapan: "bermain", laporanId: "l".repeat(200), drafId: null, akun: { platform: "chessCom", username: "" } },
  ] });
});

test("reader chooses explicit board destinations before legacy report fallback", () => {
  const daftar = [
    { id: "papan", tampilan: "papan", tampilanPapan: "bermain", laporanId: "laporan:1" },
    { id: "bermain", tampilan: "bermain", tampilanPapan: "papan" },
    { id: "fitur", tampilan: "engine", tampilanPapan: "papan", laporanId: "laporan:1" },
    { id: "fitur-lama", tampilan: "akun", laporanId: "laporan:1" },
    { id: "fitur-kosong", tampilan: "database", laporanId: "", tampilanPapan: "lain" },
  ];
  const hasil = model.bacaSesiTab(storageMemori(JSON.stringify({ versi: 1, daftar, aktifId: "papan" })));
  assert.deepEqual(hasil.daftar.map((tab) => tab.tampilanPapan), ["papan", "bermain", "papan", "bermain", "papan"]);
  assert.equal(hasil.daftar[4].laporanId, null);
});

test("account normalization checks the original length, trims, and defaults unsupported platforms", () => {
  assert.deepEqual(model.normalisasiAkunTab(null), { platform: "chessCom", username: "" });
  assert.deepEqual(model.normalisasiAkunTab({ platform: "LICHESSORG", username: 123 }), { platform: "chessCom", username: "" });
  assert.deepEqual(model.normalisasiAkunTab({ platform: "lichessOrg", username: ` ${"x".repeat(199)}` }), { platform: "lichessOrg", username: "x".repeat(199) });
  assert.deepEqual(model.normalisasiAkunTab({ platform: "lichessOrg", username: ` ${"x".repeat(200)}` }), { platform: "lichessOrg", username: "" });
});

test("tab edits preserve original objects for no-op changes, including untracked fields", () => {
  const satu = model.tabBaru("tab:1", { platform: "chessCom", username: "Alice" });
  const dua = model.tabBaru("tab:2");
  const sesi = { daftar: [satu, dua], aktifId: "tab:1" };
  assert.strictEqual(model.perbaruiTab(sesi, "tidak-ada", { drafId: "draf:x" }), sesi);
  assert.strictEqual(model.perbaruiTab(sesi, "tab:1", { akun: { platform: "chessCom", username: " Alice " } }), sesi);
  assert.strictEqual(model.perbaruiTab(sesi, "tab:1", { tambahan: "saja" }), sesi);
  const berubah = model.perbaruiTab(sesi, "tab:1", { tampilan: "bermain", laporanId: "laporan:1", tambahan: "ikut" });
  assert.notStrictEqual(berubah, sesi);
  assert.strictEqual(berubah.daftar[1], dua);
  assert.equal(berubah.daftar[0].tambahan, "ikut");
  assert.equal(berubah.daftar[0].tampilanPapan, "bermain");
  assert.equal(satu.laporanId, null);
  const fitur = model.perbaruiTab(berubah, "tab:1", { tampilan: "akun" });
  assert.equal(fitur.daftar[0].tampilanPapan, "bermain");
  const tujuan = model.perbaruiTab(fitur, "tab:1", { tampilanPapan: "papan" });
  assert.equal(tujuan.daftar[0].tampilanPapan, "papan");
});

test("selection, replacement and shared account deletion retain their original identity semantics", () => {
  const a = model.tabBaru("tab:a", { platform: "chessCom", username: "Alice" });
  const b = model.tabBaru("tab:b", { platform: "lichessOrg", username: "ALICE" });
  const sesi = { daftar: [a, b], aktifId: a.id };
  assert.strictEqual(model.aktifkanTab(sesi, "missing"), sesi);
  assert.strictEqual(model.aktifkanTab(sesi, b.id, b.id), sesi);
  assert.strictEqual(model.hapusTabLain(sesi, a.id), sesi);
  assert.strictEqual(model.hapusTabLain(sesi, "missing"), sesi);
  const aktifLagi = model.aktifkanTab(sesi, a.id);
  assert.notStrictEqual(aktifLagi, sesi);
  assert.strictEqual(aktifLagi.daftar, sesi.daftar);
  const pindah = model.aktifkanTab(sesi, b.id, a.id);
  assert.deepEqual(pindah, { daftar: [b], aktifId: b.id });
  const baru = model.tambahTab(sesi, model.tabBaru("tab:c"), a.id);
  assert.deepEqual(baru.daftar.map((tab) => tab.id), ["tab:b", "tab:c"]);
  assert.equal(baru.aktifId, "tab:c");
  assert.strictEqual(model.hapusPilihanAkun(sesi, "chessCom", "  "), sesi);
  const hapus = model.hapusPilihanAkun(sesi, "chessCom", " alice ", { platform: "lichessOrg", username: " Bob " });
  assert.deepEqual(hapus.daftar[0].akun, { platform: "lichessOrg", username: "Bob" });
  assert.strictEqual(hapus.daftar[1], b);
  assert.equal(sesi.daftar[0].akun.username, "Alice");
});

test("malformed and blocked storage return null/false and report the existing errors", (tes) => {
  const galat = tangkapGalatDiuji(tes, ["Gagal membaca sesi tab Analisa:", "Gagal menyimpan sesi tab Analisa:"]);
  assert.equal(model.bacaSesiTab(storageMemori("{")), null);
  const rusak = { getItem() { throw new Error("baca blocked"); }, setItem() { throw new Error("tulis blocked"); } };
  assert.equal(model.bacaSesiTab(rusak), null);
  assert.equal(model.simpanSesiTab(rusak, { daftar: [], aktifId: "tab:1" }), false);
  assert.deepEqual(galat.map(([pesan]) => pesan), [
    "Gagal membaca sesi tab Analisa:", "Gagal membaca sesi tab Analisa:", "Gagal menyimpan sesi tab Analisa:",
  ]);
});
