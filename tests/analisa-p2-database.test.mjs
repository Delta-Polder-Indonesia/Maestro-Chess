import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { storageMemori } from "./bantuStorage.mjs";
import { tanggalDariHeaderPgn } from "../src/halaman/Analisa/database/tanggalPgn.js";
import { formatTanggal } from "../src/halaman/Analisa/komponen/nav/database/formatDatabase.js";

const namaDb = "maestro_chess_database_v1";
globalThis.localStorage = storageMemori();
globalThis.window = { indexedDB };
globalThis.IDBKeyRange = IDBKeyRange;
const dbV2 = await new Promise((resolve, reject) => {
  const req = indexedDB.open(namaDb, 2);
  req.onupgradeneeded = () => {
    const store = req.result.createObjectStore("partai", { keyPath: "id" });
    for (const [name, key] of [
      ["platform", "platform"], ["username", "username"], ["kombinasi", ["platform", "username"]],
      ["timestamp", "timestamp"], ["platformWaktu", ["platform", "timestamp"]],
      ["usernameWaktu", ["username", "timestamp"]], ["kombinasiWaktu", ["platform", "username", "timestamp"]],
      ["koleksiWaktu", ["koleksiId", "timestamp"]],
    ]) store.createIndex(name, key);
    req.result.createObjectStore("koleksi", { keyPath: "id" });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
await new Promise((resolve, reject) => {
  const tx = dbV2.transaction(["partai", "koleksi"], "readwrite");
  const partai = tx.objectStore("partai");
  const imported = { platform: "impor", username: "impor", koleksiId: "impor:impor", timestamp: Date.UTC(2026, 10, 1) };
  partai.put({ ...imported, id: "legacy-valid", pgn: '[Date "1999.12.31"]\n\n1. e4 e5 *' });
  partai.put({ ...imported, id: "legacy-unknown", pgn: '[Date "????.??.??"]\n\n1. d4 d5 *' });
  partai.put({ ...imported, id: "legacy-utc", pgn: '[Date "2024.02.28"]\n[UTCDate "2024.02.29"]\n\n1. c4 e5 *' });
  partai.put({ ...imported, id: "already-repaired", timestamp: 0, tanggalPgn: "", pgn: "1. Nf3 *" });
  partai.put({ id: "legacy-no-time", platform: "chessCom", username: "Alice", koleksiId: "chessCom:alice", pgn: "1. e4 *" });
  partai.put({ id: "legacy-string-time", platform: "chessCom", username: "Alice", koleksiId: "chessCom:alice", timestamp: "42", pgn: "1. d4 *" });
  tx.objectStore("koleksi").put({ id: "impor:impor", platform: "impor", username: "impor", jumlahPartai: 4 });
  tx.objectStore("koleksi").put({ id: "chessCom:alice", platform: "chessCom", username: "Alice", jumlahPartai: 2 });
  tx.oncomplete = resolve;
  tx.onerror = () => reject(tx.error);
});
dbV2.close();
const basis = await import("../src/halaman/Analisa/basisData.js");
const migrasi = await import("../src/halaman/Analisa/database/migrasi.js");

test("PGN dates require a complete, valid calendar date and prefer a valid UTCDate", () => {
  assert.equal(tanggalDariHeaderPgn({ UTCDate: "2024.02.29", Date: "2024.02.28" }).tanggalPgn, "2024-02-29");
  assert.equal(tanggalDariHeaderPgn({ UTCDate: "2023.02.29", Date: "1999.12.31" }).tanggalPgn, "1999-12-31");
  assert.equal(tanggalDariHeaderPgn({ Date: "0001.01.01" }).tanggalPgn, "0001-01-01");
  for (const date of ["????.??.??", "2026.??.12", "2026.13.01", "2026.04.31", "0000.01.01", "2026-01-02", ""]) {
    assert.deepEqual(tanggalDariHeaderPgn({ Date: date }), { timestamp: 0, tanggalPgn: "" });
  }
  const parsed = tanggalDariHeaderPgn({ Date: "2024.01.02" });
  assert.equal(parsed.timestamp, Date.UTC(2024, 0, 2, 12));
  const timezone = process.env.TZ;
  try {
    for (const zone of ["Pacific/Kiritimati", "Pacific/Honolulu", "Asia/Jakarta"]) {
      process.env.TZ = zone;
      assert.equal(formatTanggal(parsed.timestamp, "en-US", parsed.tanggalPgn), "Jan 2, 2024");
      assert.equal(formatTanggal(0, "en-US"), "");
    }
  } finally {
    if (timezone === undefined) delete process.env.TZ; else process.env.TZ = timezone;
  }
});

test("v2 IndexedDB upgrades imported dates atomically, keeps IDs, and indexes unknown timestamps", async () => {
  const db = await migrasi.bukaDB();
  assert.equal(db.version, 3);
  const valid = await basis.ambilPartai("legacy-valid");
  assert.equal(valid.timestamp, Date.UTC(1999, 11, 31, 12));
  assert.equal(valid.tanggalPgn, "1999-12-31");
  assert.equal((await basis.ambilPartai("legacy-unknown")).timestamp, 0);
  assert.equal((await basis.ambilPartai("legacy-unknown")).tanggalPgn, "");
  assert.equal((await basis.ambilPartai("legacy-utc")).tanggalPgn, "2024-02-29");
  assert.equal((await basis.ambilPartai("already-repaired")).timestamp, 0);
  assert.equal((await basis.ambilPartai("legacy-string-time")).timestamp, 42);
  assert.equal((await basis.ambilPartai("legacy-no-time")).timestamp, 0);
  const semua = await basis.ambilDaftarPartai({ koleksiId: "impor:impor" });
  assert.equal(semua.total, 4);
  assert.deepEqual(new Set(semua.partai.map((p) => p.id)), new Set(["legacy-valid", "legacy-unknown", "legacy-utc", "already-repaired"]));
  assert.equal((await basis.ambilDaftarPartai({ koleksiId: "chessCom:alice" })).total, 2);
  assert.equal((await basis.ambilDaftarPartai({ koleksiId: "impor:impor", sejak: Date.UTC(2020, 0, 1) })).total, 1);
});

test("new imports use PGN dates and unknown dates instead of the import time", async () => {
  const one = '[Event "Known"]\n[Date "2010.04.17"]\n[White "Ann"]\n[Black "Ben"]\n\n1. e4 e5 *';
  const two = '[Event "Unknown"]\n[Date "2010.??.??"]\n[White "Ann"]\n[Black "Ben"]\n\n1. d4 d5 *';
  const hasil = await basis.imporPgnKeBasisData(`${one}\n\n${two}`);
  assert.equal(hasil.diproses, 2);
  assert.equal(hasil.tersimpan, 2);
  const known = (await basis.ambilDaftarPartai({ koleksiId: "impor:impor", cari: "Known" })).partai.find((p) => p.event === "Known");
  const unknown = (await basis.ambilDaftarPartai({ koleksiId: "impor:impor", cari: "Unknown" })).partai[0];
  assert.equal(known.timestamp, Date.UTC(2010, 3, 17, 12));
  assert.equal(known.tanggalPgn, "2010-04-17");
  assert.equal(unknown.timestamp, 0);
  assert.equal(unknown.tanggalPgn, "");
  assert.equal((await basis.imporPgnKeBasisData(one)).total, hasil.total, "reimport keeps the deterministic ID");
});

test("whole-collection query paginates, sorts and searches PGN beyond 400 records", async () => {
  const games = Array.from({ length: 425 }, (_, i) => ({
    id: `summary-${String(i).padStart(3, "0")}`,
    pgn: `[Event "Tournament ${i % 2}"]\n[Annotator "${i === 424 ? "UniquePGNNeedle" : "nobody"}"]\n\n1. e4 e5 *`,
    whiteName: `White${String(424 - i).padStart(3, "0")}`,
    blackName: `Black${String(i).padStart(3, "0")}`,
    event: `Tournament ${i % 2}`,
    site: `Site${i}`,
    timestamp: Date.UTC(2025, 0, 1) + i * 86400000,
    plyCount: 2 + i,
    result: i % 2 ? "white" : "draw",
    timeClass: i % 2 ? "blitz" : "rapid",
  }));
  assert.equal((await basis.simpanBanyakPartai(games, { platform: "chessCom", username: "Summary" })).tersimpan, 425);
  const options = { koleksiId: "chessCom:summary", sertakanPgn: false };
  const tail = await basis.ambilDaftarPartai({ ...options, limit: 10, offset: 420 });
  assert.equal(tail.total, 425);
  assert.equal(tail.partai.length, 5);
  assert.equal(tail.partai.at(-1).id, "summary-000");
  assert.ok(!("pgn" in tail.partai[0]));
  const pgn = await basis.ambilDaftarPartai({ ...options, cari: "uniquepgnneedle" });
  assert.equal(pgn.total, 1);
  assert.equal(pgn.partai[0].id, "summary-424");
  assert.ok(!("pgn" in pgn.partai[0]));
  assert.equal((await basis.ambilDaftarPartai({ ...options, cari: "site424" })).total, 1);
  assert.equal((await basis.ambilDaftarPartai({ ...options, cari: "tournament 1" })).total, 212);
  const sortedWhite = await basis.ambilDaftarPartai({ ...options, urut: "putih", arah: "asc", limit: 10, offset: 400 });
  assert.equal(sortedWhite.total, 425);
  assert.equal(sortedWhite.partai[0].whiteName, "White400");
  const sortedBlack = await basis.ambilDaftarPartai({ ...options, urut: "hitam", arah: "desc", limit: 1 });
  assert.equal(sortedBlack.partai[0].blackName, "Black424");
  const sortedMoves = await basis.ambilDaftarPartai({ ...options, urut: "langkah", arah: "asc", limit: 1 });
  assert.equal(sortedMoves.partai[0].plyCount, 2);
  const filtered = await basis.ambilDaftarPartai({ ...options, hasil: "white", timeClass: "blitz", sejak: Date.UTC(2026, 0, 1) });
  const expected = games.filter((g) => g.result === "white" && g.timeClass === "blitz" && g.timestamp >= Date.UTC(2026, 0, 1));
  assert.equal(filtered.total, expected.length);
  const full = await basis.ambilDaftarPartai({ ...options, urut: "putih", arah: "asc", limit: 1, sertakanPgn: true });
  assert.match(full.partai[0].pgn, /UniquePGNNeedle/);
});
