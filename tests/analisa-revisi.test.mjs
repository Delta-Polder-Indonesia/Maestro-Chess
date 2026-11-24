import assert from "node:assert/strict";
import test from "node:test";
import * as basis from "../src/halaman/Analisa/basisData.js";
import * as database from "../src/halaman/Analisa/database/index.js";
import { revisiBasis } from "../src/halaman/Analisa/database/index.js";

const eksporFasad = [
  "bacaRevisiBasis",
  "langgananRevisi",
  "buatIdPartai",
  "normalisasiHasil",
  "normalisasiDataPartai",
  "hitungStatistikKoleksiRingan",
  "simpanBanyakPartai",
  "pastikanKoleksi",
  "ambilSemuaKoleksi",
  "ambilDaftarPartai",
  "ambilPartai",
  "hapusPartai",
  "hapusKoleksi",
  "gabungkanPemain",
  "bersihkanBasisData",
  "hitungStatistikBasisData",
  "eksporPgnKoleksi",
  "imporPgnKeBasisData",
].sort();

test("database facade preserves exactly its 18 named exports", () => {
  assert.deepEqual(Object.keys(basis).sort(), eksporFasad);
  for (const nama of eksporFasad) assert.equal(basis[nama], database[nama], nama);
  assert.equal("revisiBasis" in basis, false);
  assert.equal("naikkanRevisi" in basis, false);
});

test("the internal barrel and private revision module share one live bus", async () => {
  const bus = await import("../src/halaman/Analisa/database/revisiBasis.js");
  assert.equal(database.bacaRevisiBasis, bus.bacaRevisiBasis);
  assert.equal(database.langgananRevisi, bus.langgananRevisi);
  assert.equal(database.naikkanRevisi, bus.naikkanRevisi);
  const awal = revisiBasis;
  bus.naikkanRevisi();
  assert.equal(revisiBasis, awal + 1);
  assert.equal(database.revisiBasis, bus.revisiBasis);
});

test("revision is a live ESM binding and notifications are synchronous", (t) => {
  const awal = revisiBasis;
  const peristiwa = [];
  const berhenti = basis.langgananRevisi((nilai) => {
    peristiwa.push([nilai, revisiBasis, database.revisiBasis, basis.bacaRevisiBasis()]);
  });
  t.after(berhenti);

  database.naikkanRevisi();
  assert.equal(revisiBasis, awal + 1);
  assert.deepEqual(peristiwa, [[awal + 1, awal + 1, awal + 1, awal + 1]]);
  berhenti();
  berhenti();
  database.naikkanRevisi();
  assert.equal(revisiBasis, awal + 2);
  assert.equal(peristiwa.length, 1);
});

test("listeners retain order and a snapshot even when subscriptions change or throw", (t) => {
  const peristiwa = [];
  let berhentiTerlambat;
  const terlambat = () => peristiwa.push("terlambat");
  const berhentiPertama = basis.langgananRevisi(() => {
    peristiwa.push("pertama");
    berhentiKedua();
    if (!berhentiTerlambat) berhentiTerlambat = basis.langgananRevisi(terlambat);
  });
  const berhentiKedua = basis.langgananRevisi(() => peristiwa.push("kedua"));
  const berhentiGalat = basis.langgananRevisi(() => {
    peristiwa.push("galat");
    throw new Error("listener gagal");
  });
  const berhentiTerakhir = basis.langgananRevisi(() => peristiwa.push("terakhir"));
  t.after(() => {
    berhentiPertama();
    berhentiKedua();
    berhentiGalat();
    berhentiTerakhir();
    berhentiTerlambat?.();
  });

  assert.doesNotThrow(() => database.naikkanRevisi());
  assert.deepEqual(peristiwa, ["pertama", "kedua", "galat", "terakhir"]);
  peristiwa.length = 0;
  assert.doesNotThrow(() => database.naikkanRevisi());
  assert.deepEqual(peristiwa, ["pertama", "galat", "terakhir", "terlambat"]);
});

test("duplicate and invalid subscribers retain existing Set and unsubscribe semantics", (t) => {
  let panggilan = 0;
  const pendengar = () => { panggilan++; };
  const berhenti = basis.langgananRevisi(pendengar);
  const berhentiDuplikat = basis.langgananRevisi(pendengar);
  const berhentiTidakValid = basis.langgananRevisi(null);
  t.after(() => { berhenti(); berhentiDuplikat(); });

  assert.equal(typeof berhentiTidakValid, "function");
  assert.doesNotThrow(berhentiTidakValid);
  database.naikkanRevisi();
  assert.equal(panggilan, 1);
  berhentiDuplikat();
  database.naikkanRevisi();
  assert.equal(panggilan, 1);
});
