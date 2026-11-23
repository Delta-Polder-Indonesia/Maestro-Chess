import assert from "node:assert/strict";
import test from "node:test";
import { storageMemori } from "./bantuStorage.mjs";

const snapshot = "maestro-analisa-db-snapshot-v2";
const storage = storageMemori([[snapshot, JSON.stringify({
  koleksi: [{ id: "impor:impor", platform: "impor", username: "impor", jumlahPartai: 2 }],
  partai: [
    { id: "backup-known", platform: "impor", username: "impor", koleksiId: "impor:impor", pgn: '[Date "2000.02.29"]\n\n1. e4 *', timestamp: Date.UTC(2026, 0, 1) },
    { id: "backup-unknown", platform: "impor", username: "impor", koleksiId: "impor:impor", pgn: '[Date "2001.02.29"]\n\n1. d4 *', timestamp: Date.UTC(2026, 0, 1) },
  ],
})]]);
globalThis.localStorage = storage;
globalThis.window = {};
const basis = await import("../src/halaman/Analisa/basisData.js");

test("legacy fallback imports are repaired on read and remain repaired after the next save", async () => {
  const known = await basis.ambilPartai("backup-known");
  const unknown = await basis.ambilPartai("backup-unknown");
  assert.equal(known.tanggalPgn, "2000-02-29");
  assert.equal(known.timestamp, Date.UTC(2000, 1, 29, 12));
  assert.equal(unknown.tanggalPgn, "");
  assert.equal(unknown.timestamp, 0);
  const hasil = await basis.imporPgnKeBasisData('[Date "2022.03.04"]\n[White "A"]\n\n1. e4 *');
  assert.equal(hasil.media, "localStorage");
  const persisted = JSON.parse(storage.getItem(snapshot)).partai;
  assert.equal(persisted.find((p) => p.id === "backup-known").tanggalPgn, "2000-02-29");
  assert.equal(persisted.find((p) => p.id === "backup-unknown").timestamp, 0);
  assert.equal(persisted.find((p) => p.id.startsWith("impor:")).tanggalPgn, "2022-03-04");
});

test("fallback queries also include more than 400 games in pagination, search, sorting and period filters", async () => {
  const games = Array.from({ length: 405 }, (_, i) => ({
    id: `fallback-p2-${i}`,
    pgn: `[Annotator "${i === 404 ? "RareFallbackMarker" : "Other"}"]\n\n1. e4 *`,
    whiteName: `Player${String(404 - i).padStart(3, "0")}`,
    blackName: "Bob", plyCount: 1,
    timestamp: Date.UTC(2025, 0, 1) + i * 86400000,
  }));
  const hasil = await basis.simpanBanyakPartai(games, { platform: "chessCom", username: "Fallback" });
  assert.equal(hasil.tersimpan, 405);
  assert.equal(hasil.media, "localStorage");
  const opts = { koleksiId: "chessCom:fallback", sertakanPgn: false };
  const last = await basis.ambilDaftarPartai({ ...opts, limit: 10, offset: 400 });
  assert.equal(last.total, 405);
  assert.equal(last.partai.length, 5);
  assert.equal(last.partai.at(-1).id, "fallback-p2-0");
  const search = await basis.ambilDaftarPartai({ ...opts, cari: "rarefallbackmarker" });
  assert.equal(search.total, 1);
  assert.equal(search.partai[0].id, "fallback-p2-404");
  assert.ok(!("pgn" in search.partai[0]));
  const sorted = await basis.ambilDaftarPartai({ ...opts, urut: "putih", arah: "asc", limit: 1, offset: 400 });
  assert.equal(sorted.partai[0].whiteName, "Player400");
  assert.equal((await basis.ambilDaftarPartai({ ...opts, sejak: Date.UTC(2026, 0, 1) })).total, 40);
});
