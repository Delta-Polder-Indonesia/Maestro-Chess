import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { storageMemori } from "./bantuStorage.mjs";

const kunci = "maestro-analisa-db-snapshot-v2";
const game = { id: "known", koleksiId: "chessCom:alice", platform: "chessCom", username: "Alice", timestamp: 1, pgn: "1. e4 *" };
const storage = storageMemori([[kunci, JSON.stringify({ koleksi: [{ id: game.koleksiId }], partai: [game] })]]);
globalThis.localStorage = storage;
globalThis.window = { indexedDB };
globalThis.IDBKeyRange = IDBKeyRange;
const migrasi = await import("../src/halaman/Analisa/database/migrasi.js");

test("recovery cannot delete an unreadable snapshot that changed after the tab loaded", async () => {
  storage.setItem(kunci, "{broken");
  assert.ok(await migrasi.bukaDB());
  assert.equal(storage.getItem(kunci), "{broken");
});
