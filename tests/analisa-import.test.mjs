import assert from "node:assert/strict";
import test from "node:test";
import {
  BATAS_IMPOR,
  KODE_GALAT,
  ambilPgn,
  susunPgnDariTcn,
  uraikanTautanPartai,
  validasiFen,
  validasiPgn,
} from "../src/halaman/Analisa/komponen/nav/validasiImpor.js";
import { analisa as indonesia } from "../src/lib/terjemahan/id/analisa.js";
import { analisa as english } from "../src/lib/terjemahan/en/analisa.js";

const errorCode = (code) => (error) => error?.code === code;

test("PGN and FEN validation uses the analysis parser", () => {
  const parsed = validasiPgn("1. e4 e5 *");
  assert.equal(parsed.riwayat.length, 2);
  assert.deepEqual(parsed.metadata.players.map((player) => player.name), ["", ""]);
  const unknown = validasiPgn('[White "?"]\n[Black "?"]\n\n1. e4 e5 *');
  assert.deepEqual(unknown.metadata.players.map((player) => player.name), ["", ""]);
  assert.throws(() => validasiPgn("1. e4 totally-invalid"), errorCode(KODE_GALAT.PGN));
  assert.throws(() => validasiPgn("x".repeat(BATAS_IMPOR.bytePGN + 1)), errorCode(KODE_GALAT.UKURAN));
  const fen = "8/4k3/8/8/8/8/4P3/4K3 w - - 0 1";
  assert.equal(validasiFen(`  ${fen}  `), fen);
  assert.throws(() => validasiFen("not a FEN"), errorCode(KODE_GALAT.FEN));
});

test("online imports accept only official HTTPS game URLs", () => {
  assert.deepEqual(uraikanTautanPartai("https://lichess.org/abcd1234/black"), { platform: "lichess", id: "abcd1234" });
  assert.deepEqual(uraikanTautanPartai("https://www.chess.com/game/daily/12345"), { platform: "chesscom", tipe: "daily", id: "12345" });
  for (const url of [
    "http://lichess.org/abcd1234",
    "https://lichess.org.evil.example/abcd1234",
    "https://lichess.org@evil.example/abcd1234",
    "https://lichess.org:444/abcd1234",
    "https://chess.com/member/alice",
    "not-a-url",
  ]) assert.throws(() => uraikanTautanPartai(url), errorCode(KODE_GALAT.TAUTAN), url);
});

test("Chess.com TCN conversion validates moves and headers", () => {
  const pgn = susunPgnDariTcn({ White: "Alice", Black: "Bob", Result: "1-0" }, "mC0K");
  assert.match(pgn, /1\. e4 e5 1-0/);
  assert.equal(validasiPgn(pgn).riwayat.length, 2);
  assert.throws(() => susunPgnDariTcn({}, "m"), errorCode(KODE_GALAT.TCN));
  assert.throws(() => susunPgnDariTcn({ White: "Alice\nInjected" }, "mC"), errorCode(KODE_GALAT.RESPONS));
  assert.throws(() => susunPgnDariTcn({ Result: "not-a-result" }, "mC"), errorCode(KODE_GALAT.RESPONS));
});

test("network imports request official endpoints and handle invalid or oversized responses", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith("https://lichess.org/")) return new Response("1. e4 e5 *");
    return new Response(JSON.stringify({ game: { pgnHeaders: { White: "Alice", Result: "*" }, moveList: "mC0K" } }));
  };
  assert.equal(await ambilPgn("https://lichess.org/abcd1234"), "1. e4 e5 *");
  assert.match(await ambilPgn("https://www.chess.com/game/live/123"), /1\. e4 e5/);
  assert.deepEqual(calls.map((call) => call.url), [
    "https://lichess.org/game/export/abcd1234",
    "https://www.chess.com/callback/live/game/123",
  ]);
  assert.ok(calls.every((call) => call.options.redirect === "error"));
  globalThis.fetch = async () => new Response("bad", { status: 503 });
  await assert.rejects(ambilPgn("https://lichess.org/abcd1234"), errorCode(KODE_GALAT.JARINGAN));
  globalThis.fetch = async () => new Response("invalid JSON");
  await assert.rejects(ambilPgn("https://chess.com/game/live/123"), errorCode(KODE_GALAT.RESPONS));
  globalThis.fetch = async () => new Response("x", { headers: { "content-length": String(BATAS_IMPOR.byteRespons + 1) } });
  await assert.rejects(ambilPgn("https://lichess.org/abcd1234"), errorCode(KODE_GALAT.UKURAN));
});

function keys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, item]) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? keys(item, `${prefix}${key}.`)
      : [`${prefix}${key}`]);
}

test("Indonesian and English analysis dictionaries expose the same keys", () => {
  assert.deepEqual(keys(indonesia).sort(), keys(english).sort());
});
