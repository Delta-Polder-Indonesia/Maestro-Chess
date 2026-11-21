import assert from "node:assert/strict";
import test from "node:test";
import { muatPartaiChessCom, muatPartaiLichess } from "../src/halaman/Analisa/akun/muatPartaiAkun.js";
import { ambilDaftarPartai, hapusKoleksi, simpanBanyakPartai } from "../src/halaman/Analisa/basisData.js";

const isAbort = (error) => error?.name === "AbortError";
const pgn = '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 *';

test("cancellation while opening storage prevents a late write", async () => {
  const controller = new AbortController();
  const koleksiId = "chessCom:cancel-storage";
  const saving = simpanBanyakPartai([{ pgn }], {
    platform: "chessCom", username: "cancel-storage", signal: controller.signal,
  });
  // bukaDB() yields even when it falls back to memory.
  controller.abort();
  await assert.rejects(saving, isAbort);
  assert.equal((await ambilDaftarPartai({ koleksiId, limit: 0 })).total, 0);
  await hapusKoleksi(koleksiId);
});

test("canceled account fetches never save responses that arrive late", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await t.test("Chess.com archives", async () => {
    const controller = new AbortController();
    const koleksiId = "chessCom:cancel-chess";
    globalThis.fetch = async (url) => {
      if (url.endsWith("/archives")) {
        return { ok: true, json: async () => ({ archives: ["https://api.chess.com/pub/player/cancel-chess/games/2026/11"] }) };
      }
      return {
        ok: true,
        json: async () => {
          // Simulate a response completing even though its caller has canceled.
          controller.abort();
          return { games: [{ pgn, white: { username: "Alice" }, black: { username: "Bob" }, end_time: 1700000000 }] };
        },
      };
    };
    await assert.rejects(muatPartaiChessCom("cancel-chess", { signal: controller.signal, paksa: true }), isAbort);
    assert.equal((await ambilDaftarPartai({ koleksiId, limit: 0 })).total, 0);
    await hapusKoleksi(koleksiId);
  });

  await t.test("Lichess NDJSON fallback", async () => {
    const controller = new AbortController();
    const koleksiId = "lichessOrg:cancel-lichess";
    globalThis.fetch = async () => ({
      ok: true,
      body: null,
      text: async () => {
        controller.abort();
        return JSON.stringify({ id: "abcdefgh", pgn, players: { white: {}, black: {} }, status: "started" });
      },
    });
    await assert.rejects(muatPartaiLichess("cancel-lichess", { signal: controller.signal, paksa: true }), isAbort);
    assert.equal((await ambilDaftarPartai({ koleksiId, limit: 0 })).total, 0);
    await hapusKoleksi(koleksiId);
  });
});
