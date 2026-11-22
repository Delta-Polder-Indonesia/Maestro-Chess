import assert from "node:assert/strict";
import test from "node:test";
import {
  ambilDaftarPartai,
  eksporPgnKoleksi,
  hapusKoleksi,
  hapusPartai,
  hitungStatistikBasisData,
  imporPgnKeBasisData,
  simpanBanyakPartai,
} from "../src/halaman/Analisa/basisData.js";
import { normalisasiDataPartai, normalisasiHasil } from "../src/halaman/Analisa/database/partai.js";
import { statusHasil } from "../src/halaman/Analisa/komponen/nav/database/formatDatabase.js";
import { infoPartaiUntuk, rekapPembukaan, ringkasanOverview } from "../src/halaman/Analisa/akun/statsAkun.js";
import { hitungHasil, hitungPembukaanTeratas, hitungTrenRating } from "../src/halaman/Analisa/mesin/wawasan.js";
import { olahPartaiChessCom, olahPartaiLichess, akurasiTerbitanLichess } from "../src/halaman/Analisa/akun/muatPartaiAkun.js";
import { olahPartaiChessCom as olahPemilihChessCom } from "../src/halaman/Analisa/komponen/menu/analyze/selectChessComData.js";
import { hasilDariPgn } from "../src/lib/hasilPartai.js";

const pgn = [
  '[Event "Unfinished"]\n[White "Alice"]\n[Black "Bob"]\n[WhiteElo "1500"]\n[Result "*"]\n\n1. e4 e5 *',
  '[Event "Drawn"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1/2-1/2"]\n\n1. d4 d5 1/2-1/2',
  '[Event "Decided"]\n[White "Bob"]\n[Black "Alice"]\n[Result "0-1"]\n\n1. c4 e5 0-1',
  '[Event "No result header"]\n[White "Alice"]\n[Black "Bob"]\n\n1. e4 *',
].join("\n\n");

test("unknown PGN results remain distinct from draws throughout the local database", async () => {
  assert.deepEqual(
    ["1-0", "0-1", "1/2-1/2", "½-½", "draw", "*", "", undefined, "unrecognized"].map(normalisasiHasil),
    ["white", "black", "draw", "draw", "draw", "unknown", "unknown", "unknown", "unknown"],
  );
  const koleksiId = "impor:impor";
  assert.deepEqual(await imporPgnKeBasisData(pgn), { tersimpan: 0, total: 4, sementara: 4, media: "memori", diproses: 4 });
  const { partai, total } = await ambilDaftarPartai({ koleksiId, limit: 0 });
  assert.equal(total, 4);
  assert.equal(partai.filter((p) => p.result === "unknown").length, 2);
  assert.equal((await ambilDaftarPartai({ koleksiId, limit: 0, hasil: "draw" })).total, 1);
  assert.equal((await ambilDaftarPartai({ koleksiId, limit: 0, hasil: "black" })).total, 1);
  const stats = await hitungStatistikBasisData();
  assert.equal(stats.totalPartai, 4);
  assert.equal(stats.seri, 1);
  assert.equal(stats.hitamMenang, 1);
  const unknown = partai.find((p) => p.result === "unknown");
  assert.equal(statusHasil(unknown), "unknown");
  assert.equal(statusHasil(partai.find((p) => p.result === "draw")), "draw");
  assert.equal(infoPartaiUntuk(unknown, "Alice").outcome, null);
  assert.deepEqual(
    (({ total, w, d, l }) => ({ total, w, d, l }))(ringkasanOverview(partai, "Alice")),
    { total: 2, w: 1, d: 1, l: 0 },
  );
  assert.equal(rekapPembukaan(partai, "Alice").putih.reduce((sum, p) => sum + p.jumlah, 0), 1);
  assert.deepEqual(hitungHasil(partai, "Alice"), { wins: 1, losses: 0, draws: 1, total: 2, winRate: 50 });
  assert.equal(hitungPembukaanTeratas(partai, "Alice", "all").reduce((sum, p) => sum + p.played, 0), 2);
  assert.equal(hitungTrenRating(partai, "Alice")[0].result, null);
  const exported = await eksporPgnKoleksi({ koleksiId });
  assert.match(exported, /\[Event "Unfinished"\]/);
  assert.match(exported, /1\. e4 e5 \*/);
  await hapusPartai(unknown.id);
  assert.equal((await ambilDaftarPartai({ koleksiId, limit: 0 })).total, 3);
  await hapusKoleksi(koleksiId);
});

test("API conversions distinguish unknown results and absent accuracy from draws and 0%", () => {
  const chessGame = { pgn: "1. e4 e5 *", white: {}, black: {} };
  const lichessGame = { pgn: "1. e4 e5 *", players: { white: {}, black: {} }, status: "started" };
  for (const convert of [olahPartaiChessCom, olahPemilihChessCom]) {
    assert.equal(convert(chessGame).result, "unknown");
    assert.equal(convert({ ...chessGame, pgn: "1. e4 e5 1/2-1/2" }).result, "draw");
    assert.equal(convert({ ...chessGame, white: { result: "agreed" } }).result, "draw");
    assert.equal(convert({ ...chessGame, black: { result: "win" } }).result, "black");
  }
  assert.equal(olahPartaiLichess(lichessGame).result, "unknown");
  assert.equal(olahPartaiLichess({ ...lichessGame, status: "draw" }).result, "draw");
  assert.equal(olahPartaiLichess({ ...lichessGame, winner: "white" }).result, "white");
  assert.equal(olahPartaiLichess({ ...lichessGame, pgn: "1. e4 e5 1/2-1/2" }).result, "draw");
  assert.deepEqual([olahPartaiLichess(lichessGame).whiteName, olahPartaiLichess(lichessGame).blackName], ["", ""]);
  assert.equal(akurasiTerbitanLichess({ players: { white: { accuracy: null }, black: { accuracy: "" } } }), undefined);
  assert.deepEqual(akurasiTerbitanLichess({ players: { white: { accuracy: 0 }, black: { accuracy: 96.1 } } }), { white: 0, black: 96.1 });
  assert.equal(hasilDariPgn("1. e4 (1. d4 1-0) e5 1/2-1/2 {final comment}"), "draw");
  assert.equal(hasilDariPgn("[Result \"*\"]\n\n1. e4 e5 *"), "unknown");
});

test("normalization respects explicit metadata and PGN results without treating missing results as draws", async () => {
  assert.equal(normalisasiDataPartai({ pgn: "1. e4 *" }).result, "unknown");
  assert.equal(normalisasiDataPartai({ pgn: "1. e4" }).result, "unknown");
  assert.equal(normalisasiDataPartai({ pgn: '1. e4 1/2-1/2' }).result, "draw");
  assert.equal(normalisasiDataPartai({ pgn: '[Result "1-0"]\n\n1. e4' }).result, "white");
  await imporPgnKeBasisData('[White "?"]\n\n1. e4 e5 *');
  const imported = await ambilDaftarPartai({ koleksiId: "impor:impor", limit: 0 });
  assert.deepEqual([imported.partai[0].whiteName, imported.partai[0].blackName], ["", ""]);
  await hapusKoleksi("impor:impor");
  const koleksiId = "lichessOrg:regression-test";
  await simpanBanyakPartai([{
    id: "game-with-metadata",
    pgn: '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5',
    whiteName: "Alice",
    blackName: "Bob",
    result: "white",
    timestamp: 1,
  }], { platform: "lichessOrg", username: "regression-test" });
  const { partai } = await ambilDaftarPartai({ koleksiId, limit: 0 });
  assert.equal(partai.length, 1);
  assert.equal(partai[0].result, "white");
  await hapusKoleksi(koleksiId);
});
