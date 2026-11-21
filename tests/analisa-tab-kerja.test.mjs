import assert from "node:assert/strict";
import test from "node:test";
import {
  aktifkanTab, bacaSesiTab, hapusTabLain, KUNCI_SESI_TAB, perbaruiTab,
  simpanSesiTab, tabBaru, tambahTab,
} from "../src/halaman/Analisa/tabKerja.js";

function storageMemori() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("session keeps separate feature, report and draft pointers through tab operations", () => {
  const first = tabBaru("tab:1");
  const second = tabBaru("tab:2");
  let sesi = { daftar: [first], aktifId: first.id };
  sesi = perbaruiTab(sesi, first.id, { tampilan: "bermain", laporanId: "laporan:1" });
  sesi = tambahTab(sesi, second);
  sesi = perbaruiTab(sesi, second.id, { tampilan: "impor", drafId: "draf:2" });
  sesi = aktifkanTab(sesi, first.id);
  assert.deepEqual(sesi.daftar, [
    { id: "tab:1", tampilan: "bermain", laporanId: "laporan:1", drafId: null },
    { id: "tab:2", tampilan: "impor", laporanId: null, drafId: "draf:2" },
  ]);
  assert.equal(sesi.aktifId, first.id);

  const storage = storageMemori();
  simpanSesiTab(storage, sesi);
  assert.deepEqual(bacaSesiTab(storage), sesi);
  assert.equal(storage.getItem(KUNCI_SESI_TAB).includes("snapshot"), false);
  assert.equal(storage.getItem(KUNCI_SESI_TAB).includes("pgn"), false);
  assert.equal(hapusTabLain(sesi, first.id), sesi); // active tab cannot be removed as an inactive tab
  sesi = hapusTabLain(sesi, second.id);
  assert.deepEqual(sesi.daftar.map((tab) => tab.id), [first.id]);
  sesi = tambahTab(sesi, tabBaru("tab:3"), first.id);
  assert.deepEqual(sesi.daftar.map((tab) => tab.id), ["tab:3"]);
  assert.equal(sesi.aktifId, "tab:3");
});

test("damaged or blocked session storage does not break a fresh workspace", () => {
  const storage = storageMemori();
  storage.setItem(KUNCI_SESI_TAB, "not JSON");
  assert.equal(bacaSesiTab(storage), null);
  storage.setItem(KUNCI_SESI_TAB, JSON.stringify({ versi: 2, daftar: [], aktifId: "tab:1" }));
  assert.equal(bacaSesiTab(storage), null);
  storage.setItem(KUNCI_SESI_TAB, JSON.stringify({
    versi: 1,
    aktifId: "tab:1",
    daftar: [
      { id: "tab:1", tampilan: "database", laporanId: 8, drafId: "draf:1", pgn: "private" },
      { id: "tab:1", tampilan: "akun" },
      { id: "tab:2", tampilan: "unknown" },
    ],
  }));
  assert.deepEqual(bacaSesiTab(storage), {
    aktifId: "tab:1",
    daftar: [{ id: "tab:1", tampilan: "database", laporanId: null, drafId: "draf:1" }],
  });
  const terblokir = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(bacaSesiTab(terblokir), null);
  assert.doesNotThrow(() => simpanSesiTab(terblokir, { daftar: [tabBaru("tab:1")], aktifId: "tab:1" }));
});
